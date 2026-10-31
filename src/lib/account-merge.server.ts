import { sql } from "@/lib/neon";
import { generateToken, hashToken } from "@/lib/auth/password.server";

/**
 * Sovereign account merge.
 *
 * A — the primary (kept) account mints a 5-minute pin + QR token.
 * B — the second account enters the pin and gets a preview of both accounts;
 *     a 6-digit code is e-mailed to that account's address.
 * C — with the code it chooses which handle and which card design to keep.
 *     Everything (links, sign-ins, passkeys, badges, data) moves to the primary
 *     account without duplicates; the other design becomes a saved template.
 */

const TICKET_TTL_MINUTES = 5;
type Row = Record<string, unknown>;
export type MergeSide = "primary" | "secondary";

export type MergeAccountSummary = {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  verified: boolean;
  email: string | null;
  providers: string[];
};

function randomPin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export async function createMergeTicket(primaryUserId: string) {
  const pin = randomPin();
  const token = generateToken(24);
  const [pinHash, tokenHash] = await Promise.all([hashToken(pin), hashToken(token)]);
  await sql`update public.account_merge_tickets set used_at = now()
     where primary_user_id = ${primaryUserId} and used_at is null`;
  const rows = (await sql`
    insert into public.account_merge_tickets (primary_user_id, pin_hash, token_hash, expires_at)
    values (${primaryUserId}, ${pinHash}, ${tokenHash}, now() + make_interval(mins => ${TICKET_TTL_MINUTES}))
    returning id, expires_at`) as Row[];
  const expiresAt = String(rows[0]?.["expires_at"]);
  try {
    const { notifyUser } = await import("./notifications.server");
    await notifyUser(primaryUserId, "merge_verification", { ticket_id: rows[0]?.["id"], expires_at: expiresAt },
      { EXPIRES_AT: expiresAt, TTL_MINUTES: TICKET_TTL_MINUTES });
  } catch (error) {
    console.error("[merge] notify failed", error);
  }
  return { pin, token, ticketId: rows[0]?.["id"] as string, expiresAt };
}

/** Failed redeem attempts in the window; null when unknown (callers fail closed). */
async function countMergeFailures(userId: string): Promise<number | null> {
  try {
    const { sha256Hex } = await import("./rate-limit-db.server");
    const bucket = `merge-redeem-fail:${await sha256Hex(userId)}`;
    const rows = (await sql`select coalesce(sum(hits), 0)::int as hits from public.rate_limits
       where bucket = ${bucket} and window_start > now() - make_interval(mins => ${TICKET_TTL_MINUTES * 2})`) as Row[];
    return Number(rows[0]?.["hits"] ?? 0);
  } catch (error) {
    console.error("[merge] failure counter unavailable", (error as Error)?.message);
    return null;
  }
}

async function findTicket(pin: string | null, token: string | null) {
  const hash = await hashToken((pin ?? token ?? "").trim());
  const rows = (await sql`select id, primary_user_id, preview_user_id, expires_at from public.account_merge_tickets
     where used_at is null and expires_at > now() and (pin_hash = ${hash} or token_hash = ${hash})
     order by created_at desc limit 1`) as Row[];
  return rows[0] ?? null;
}

async function resolveTicket(secondaryUserId: string, pin: string | null, token: string | null) {
  const { hitRateLimit } = await import("./rate-limit-db.server");
  const { mergeAttemptAllowed } = await import("./account-merge-rules");
  if (!mergeAttemptAllowed(await countMergeFailures(secondaryUserId))) return { error: "rate_limited" as const };
  const ticket = await findTicket(pin, token);
  if (!ticket) {
    await hitRateLimit("merge-redeem-fail", secondaryUserId, { limit: 5, windowSec: TICKET_TTL_MINUTES * 60 });
    return { error: "invalid_or_expired" as const };
  }
  if (ticket["primary_user_id"] === secondaryUserId) return { error: "same_account" as const };
  return { ticket };
}

async function summary(userId: string): Promise<MergeAccountSummary> {
  const rows = (await sql`select p.username, p.display_name, p.avatar_url, p.verified, u.email
    from public.users u left join public.profiles p on p.id = u.id where u.id = ${userId} limit 1`) as Row[];
  const r = rows[0] ?? {};
  let providers: string[] = [];
  try {
    const { linkedAccountsOf } = await import("@/lib/oauth/provider.server");
    providers = [...new Set((await linkedAccountsOf(userId)).map((a) => a.provider))];
  } catch {
    /* summary stays usable without providers */
  }
  const { maskEmail } = await import("./security-code.server");
  return {
    handle: (r["username"] as string | null) ?? null,
    displayName: (r["display_name"] as string | null) ?? null,
    avatarUrl: (r["avatar_url"] as string | null) ?? null,
    verified: Boolean(r["verified"]),
    email: r["email"] ? maskEmail(String(r["email"])) : null,
    providers,
  };
}

/** Step B: validate the pin, show both accounts and e-mail a confirmation code. */
export async function previewMerge(input: { secondaryUserId: string; pin?: string | null; token?: string | null; request?: Request | null }) {
  const found = await resolveTicket(input.secondaryUserId, input.pin ?? null, input.token ?? null);
  if ("error" in found) return { ok: false as const, reason: found.error };
  const ticket = found.ticket!;
  // Bind the ticket to the first account that previews it; nobody else can redeem it.
  const bound = (await sql`update public.account_merge_tickets set preview_user_id = ${input.secondaryUserId}
    where id = ${ticket["id"] as string} and used_at is null
      and (preview_user_id is null or preview_user_id = ${input.secondaryUserId}) returning id`) as Row[];
  if (!bound.length) return { ok: false as const, reason: "invalid_or_expired" as const };
  const { issueSecurityCode } = await import("./security-code.server");
  const sent = await issueSecurityCode(input.secondaryUserId, "merge", input.request);
  if (!sent.ok) return { ok: false as const, reason: sent.reason };
  const [primary, secondary] = await Promise.all([summary(ticket["primary_user_id"] as string), summary(input.secondaryUserId)]);
  return { ok: true as const, primary, secondary, codeSentTo: sent.sentTo };
}

// ---------------------------------------------------------------------------
// Data transfer: one transaction, explicit table allowlist (account-merge-rules.ts)
// ---------------------------------------------------------------------------

type Stmt = { query: string; params: unknown[] };

/** Better Auth sign-ins: same-provider collisions are archived, never forced into a unique index. */
async function authStatements(primaryId: string, secondaryId: string): Promise<Stmt[]> {
  const ids = (await sql`select id, coalesce(auth_user_id::text, user_metadata->>'neon_auth_id') as ba from public.users
    where id in (${primaryId}, ${secondaryId})`) as Row[];
  const pBa = (ids.find((r) => r["id"] === primaryId)?.["ba"] as string | null) ?? null;
  const sBa = (ids.find((r) => r["id"] === secondaryId)?.["ba"] as string | null) ?? null;
  if (!sBa || sBa === pBa) return [];
  if (!pBa) {
    // Primary has no Better Auth user yet: adopt the secondary's, without touching its e-mail.
    return [
      { query: `delete from neon_auth.session where "userId"::text = $1`, params: [sBa] },
      {
        query: `update public.users set user_metadata = coalesce(user_metadata, '{}'::jsonb) || jsonb_build_object('neon_auth_id', $2::text)
          where id = $1`,
        params: [primaryId, sBa],
      },
    ];
  }
  const collide = (sec: string, prim: string) => `from neon_auth.account s where s."userId"::text = ${sec} and exists (
      select 1 from neon_auth.account p where p."userId"::text = ${prim} and p."providerId" = s."providerId")`;
  return [
    {
      query: `insert into public.merged_auth_account_archive
        (primary_user_id, secondary_auth_user_id, provider_id, provider_account_id, original_created_at)
        select $1, $2, s."providerId", s."accountId", s."createdAt" ${collide("$2", "$3")}`,
      params: [primaryId, sBa, pBa],
    },
    { query: `delete ${collide("$1", "$2")}`, params: [sBa, pBa] },
    { query: `update neon_auth.account set "userId" = $1::uuid, "updatedAt" = now() where "userId"::text = $2`, params: [pBa, sBa] },
    { query: `update neon_auth.passkey set "userId" = $1 where "userId"::text = $2`, params: [pBa, sBa] },
    { query: `delete from neon_auth."twoFactor" where "userId"::text = $1`, params: [sBa] },
    { query: `delete from neon_auth.session where "userId"::text = $1`, params: [sBa] },
    { query: `delete from neon_auth."user" where id::text = $1`, params: [sBa] },
  ];
}

const PROFILE_FLAGS_SQL = `update public.profiles p
     set verified = p.verified or s.verified,
         verified_at = coalesce(p.verified_at, s.verified_at),
         verified_legal_name = coalesce(p.verified_legal_name, s.verified_legal_name),
         tier = case when s.tier = 'verified' or p.tier = 'verified' then 'verified' else p.tier end,
         is_paid = p.is_paid or s.is_paid,
         is_early_believer = p.is_early_believer or s.is_early_believer,
         is_business = coalesce(p.is_business, false) or coalesce(s.is_business, false),
         is_influencer = coalesce(p.is_influencer, false) or coalesce(s.is_influencer, false),
         updated_at = now()
    from public.profiles s
   where p.id = $1 and s.id = $2`;

/** Step C: code + choices → merge, all or nothing. */
export async function redeemMergeTicket(input: {
  secondaryUserId: string;
  pin?: string | null;
  token?: string | null;
  code: string;
  keepHandle: MergeSide;
  keepDesign: MergeSide;
}) {
  const rules = await import("./account-merge-rules");
  const keepHandle = rules.parseMergeSide(input.keepHandle);
  const keepDesign = rules.parseMergeSide(input.keepDesign);
  const found = await resolveTicket(input.secondaryUserId, input.pin ?? null, input.token ?? null);
  if ("error" in found) return { ok: false as const, reason: found.error };
  const ticket = found.ticket!;
  if (ticket["preview_user_id"] !== input.secondaryUserId) return { ok: false as const, reason: "invalid_or_expired" as const };
  const { consumeSecurityCode } = await import("./security-code.server");
  if (!(await consumeSecurityCode(input.secondaryUserId, "merge", input.code))) {
    const { hitRateLimit } = await import("./rate-limit-db.server");
    await hitRateLimit("merge-redeem-fail", input.secondaryUserId, { limit: 5, windowSec: TICKET_TTL_MINUTES * 60 });
    return { ok: false as const, reason: "bad_code" as const };
  }

  const ticketId = ticket["id"] as string;
  const primaryId = ticket["primary_user_id"] as string;
  const secondaryId = input.secondaryUserId;
  const design = await import("./design-templates.server");
  const [pSnap, sSnap] = await Promise.all([design.snapshotDesign(primaryId), design.snapshotDesign(secondaryId)]);
  const handles = (await sql`select id, username from public.profiles where id in (${primaryId}, ${secondaryId})`) as Row[];
  const pHandle = (handles.find((h) => h["id"] === primaryId)?.["username"] as string | null) ?? null;
  const sHandle = (handles.find((h) => h["id"] === secondaryId)?.["username"] as string | null) ?? null;

  const statements: Stmt[] = [
    // 1. Claim: only this transaction can set used_at = now(); a replay or a parallel run claims nothing and aborts.
    {
      query: `update public.account_merge_tickets set used_at = now(), secondary_user_id = $2
        where id = $3 and primary_user_id = $1 and preview_user_id = $2 and used_at is null and expires_at > now()`,
      params: [primaryId, secondaryId, ticketId],
    },
    rules.assertStatement(
      `exists (select 1 from public.account_merge_tickets where id = $1 and secondary_user_id = $2 and used_at = now())`,
      "merge_ticket_not_claimable",
      [ticketId, secondaryId],
    ),
    // 2. Data, by the reviewed allowlist.
    ...rules.transferStatements(primaryId, secondaryId),
    ...(await authStatements(primaryId, secondaryId)),
    { query: PROFILE_FLAGS_SQL, params: [primaryId, secondaryId] },
  ];
  // 3. Designs: the one not kept is saved as a template.
  if (keepDesign === "secondary" && sSnap) {
    if (pSnap) statements.push(design.templateInsertStatement(primaryId, `Ontwerp van @${pHandle ?? "hoofdaccount"}`, pSnap));
    statements.push(...design.designWriteStatements(primaryId, sSnap));
  }
  if (sSnap) statements.push(design.templateInsertStatement(primaryId, `Ontwerp van @${sHandle ?? "tweede account"}`, sSnap));
  // 4. Remove the secondary account, then (optionally) take over its handle.
  statements.push(
    { query: `delete from public.profiles where id = $1`, params: [secondaryId] },
    { query: `delete from public.users where id = $1`, params: [secondaryId] },
  );
  if (keepHandle === "secondary" && sHandle) {
    statements.push({ query: `update public.profiles set username = $2, updated_at = now() where id = $1`, params: [primaryId, sHandle] });
  }

  const { runBatch } = await import("@/lib/neon");
  try {
    await runBatch(statements);
  } catch (error) {
    console.error("[merge] rolled back", (error as Error)?.message);
    const reason = rules.mergeFailureReason(error);
    return { ok: false as const, reason };
  }
  try {
    const { recordSecurityEvent } = await import("./audit-log.server");
    await recordSecurityEvent({ eventType: "account.merged", userId: primaryId, payload: { ticket_id: ticketId } });
  } catch (error) {
    console.error("[merge] audit", error);
  }
  return { ok: true as const, primaryUserId: primaryId };
}

export async function verifyOwnPassword(userId: string, password: string) {
  const { checkPassword } = await import("@/lib/security-code.server");
  return checkPassword(userId, password);
}
