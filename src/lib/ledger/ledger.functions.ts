import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";

const envelope = z.object({ v: z.literal(1), source: z.enum(["recovery", "prf"]), salt: z.string().max(100), iv: z.string().max(40), ciphertext: z.string().min(100).max(12000), credentialId: z.string().max(2048).optional() }).strict();
const publicKey = z.object({ kty: z.literal("RSA"), n: z.string().min(512).max(1024), e: z.literal("AQAB"), alg: z.literal("RSA-OAEP-256").optional(), ext: z.boolean().optional(), key_ops: z.array(z.literal("encrypt")).optional() }).strict();

export const getLedgerKeys = createServerFn({ method: "GET" }).middleware([requireAuth]).handler(async ({ context }) => {
  const { sql } = await import("@/lib/neon");
  return sql`select key_id, ledger_public_key, encrypted_ledger_private_key, retired_at from public.user_ledger_keys
    where user_id = ${context.userId} order by created_at desc limit 100`;
});

/** Normal authenticated account access suffices to reset LOST ledger keys, not account credentials. */
export const saveLedgerKeys = createServerFn({ method: "POST" }).middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ publicKey, envelopes: z.array(envelope).min(1).max(2), expectedKeyId: z.string().nullable() }).strict().parse(d))
  .handler(async ({ data, context }) => {
    if (!data.envelopes.some((e) => e.source === "recovery")) throw new Error("Een lokale herstelcode is verplicht.");
    const { publicKeyId } = await import("./crypto");
    const keyId = await publicKeyId(data.publicKey);
    const { runBatch } = await import("@/lib/neon");
    await runBatch([
      { query: "select id from public.users where id = $1 for update", params: [context.userId] },
      { query: `select public.rout_merge_assert(coalesce((select key_id from public.user_ledger_keys where user_id = $1 and retired_at is null), '') = coalesce($2, ''), 'ledger_key_conflict')`, params: [context.userId, data.expectedKeyId] },
      { query: "update public.user_ledger_keys set retired_at = now() where user_id = $1 and retired_at is null", params: [context.userId] },
      { query: `insert into public.user_ledger_keys(user_id, key_id, ledger_public_key, encrypted_ledger_private_key) values ($1, $2, $3::jsonb, $4::jsonb)`, params: [context.userId, keyId, JSON.stringify(data.publicKey), JSON.stringify(data.envelopes)] },
    ]);
    return { keyId };
  });

export const listEncryptedLedger = createServerFn({ method: "GET" }).middleware([requireAuth])
  .inputValidator((d: unknown) => z.object({ cursor: z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sql } = await import("@/lib/neon");
    return data.cursor
      ? sql`select id, key_id, encrypted_payload, to_json(created_at) as created_at from public.user_encrypted_audit_logs
          where user_id = ${context.userId} and (created_at, id) < (${data.cursor.createdAt}::timestamptz, ${data.cursor.id}::uuid)
          order by created_at desc, id desc limit 50`
      : sql`select id, key_id, encrypted_payload, to_json(created_at) as created_at from public.user_encrypted_audit_logs
          where user_id = ${context.userId} order by created_at desc, id desc limit 50`;
  });