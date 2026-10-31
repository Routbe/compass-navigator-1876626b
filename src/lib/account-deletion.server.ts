import { sql } from "@/lib/neon";
import { isDue, purgeAfter, type DeletionRow } from "./account-deletion-rules";

type Row = Record<string, unknown>;
const enc = new TextEncoder();

function toRow(r: Row | undefined): DeletionRow | null {
  if (!r) return null;
  const t = (v: unknown) => (v == null ? null : new Date(String(v)).getTime());
  return { requestedAt: t(r["requested_at"])!, purgeAfter: t(r["purge_after"])!, cancelledAt: t(r["cancelled_at"]), completedAt: t(r["completed_at"]) };
}

async function auditSecret(): Promise<string> {
  const s = process.env["APP_SESSION_SECRET"];
  if (s) return s;
  const { resolveAuthSecret } = await import("./better-auth.server");
  const r = resolveAuthSecret();
  if (!r) throw new Error("audit_secret_missing");
  return r.secret;
}

/** Signed audit row: user id only as SHA-256, signature = HMAC(secret, hash || event || ts). */
async function writeAudit(userId: string, event: "requested" | "cancelled" | "purged") {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(userId)));
  const ts = new Date().toISOString();
  const key = await crypto.subtle.importKey("raw", enc.encode(await auditSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${hex}|${event}|${ts}`)));
  const sigHex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  await sql`insert into public.account_deletion_audit (user_id_hash, event, signature, created_at)
    values (decode(${hex}, 'hex'), ${event}, decode(${sigHex}, 'hex'), ${ts})`;
}

export async function getDeletion(userId: string) {
  const rows = (await sql`select * from public.account_deletions where user_id = ${userId}`) as Row[];
  return toRow(rows[0]);
}

export async function requestDeletion(userId: string) {
  const now = Date.now();
  const after = new Date(purgeAfter(now)).toISOString();
  await sql.transaction([
    sql`insert into public.account_deletions (user_id, requested_at, purge_after)
      values (${userId}, ${new Date(now).toISOString()}, ${after})
      on conflict (user_id) do update set requested_at = excluded.requested_at, purge_after = excluded.purge_after,
        cancelled_at = null, completed_at = null
      where public.account_deletions.completed_at is null`,
    sql`update public.users set account_status = 'pending_deletion' where id = ${userId} and account_status = 'active'`,
  ]);
  await writeAudit(userId, "requested");
  return getDeletion(userId);
}

export async function cancelDeletion(userId: string): Promise<boolean> {
  const res = (await sql.transaction([
    sql`update public.account_deletions set cancelled_at = now()
      where user_id = ${userId} and cancelled_at is null and completed_at is null and purge_after > now() returning user_id`,
    sql`update public.users set account_status = 'active' where id = ${userId} and account_status = 'pending_deletion'`,
  ])) as Row[][];
  const ok = (res[0]?.length ?? 0) > 0;
  if (ok) await writeAudit(userId, "cancelled");
  return ok;
}

/** Idempotent purge of due requests; personal data cascades from public.users and the login identity. */
export async function purgeDueDeletions(limit = 25) {
  const due = (await sql`select * from public.account_deletions
    where cancelled_at is null and completed_at is null and purge_after <= now()
    order by purge_after limit ${limit}`) as Row[];
  let purged = 0;
  for (const r of due) {
    const row = toRow(r);
    if (!isDue(row, Date.now())) continue;
    const userId = String(r["user_id"]);
    const users = (await sql`select user_metadata->>'neon_auth_id' as auth_id from public.users where id = ${userId}`) as Row[];
    const authId = (users[0]?.["auth_id"] as string | null) ?? userId;
    await sql.transaction([
      sql`delete from public.admin_bootstrap_tokens where consumed_by = ${userId}`,
      sql`delete from public.users where id = ${userId}`,
      sql`delete from neon_auth."user" where id::text = ${authId}`,
      sql`update public.account_deletions set completed_at = now() where user_id = ${userId}`,
    ]);
    await writeAudit(userId, "purged");
    purged++;
  }
  return { checked: due.length, purged };
}
