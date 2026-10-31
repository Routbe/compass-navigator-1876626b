import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { accountPurgeStatements, PURGE_OWNER_TABLES } from "./account-purge";

const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let db: PGlite | undefined;
afterEach(async () => { await db?.close(); });

async function fixture() {
  db = new PGlite();
  await db.exec(`create schema neon_auth;
    create table public.users (id uuid primary key, email text);
    create table public.profiles (id uuid references users(id) on delete cascade, username text);
    create table public.alias_profiles (user_id uuid references users(id) on delete cascade, handle text);
    create table public.account_deletions (user_id uuid primary key, cancelled_at timestamptz, completed_at timestamptz, purge_after timestamptz);
    create table public.newsletter_subscribers (email text, handle text);
    create table public.onboarding_drafts (email text);
    create table public.webhook_endpoints (owner_user_id uuid);
    create table public.oauth_clients (owner_user_id uuid, workspace_id uuid);
    create table public.approved_handles (user_id uuid);
    create table public.custom_badges (owner_user_id uuid);
    create table public.sepa_review_queue (user_id uuid);
    create table public.admin_bootstrap_tokens (consumed_by uuid);
    create table neon_auth."user" (id uuid primary key, email text);
    create table neon_auth.verification (identifier text);
    create table public.oauth_access_tokens (user_id uuid references users(id) on delete cascade, token text);
    create table public.oauth_refresh_tokens (user_id uuid references users(id) on delete cascade, token text);`);
  for (const table of PURGE_OWNER_TABLES) await db.exec(`create table public.${table} (user_id uuid, secret text)`);
  for (const table of ["passkey", "twoFactor", "session", "account"]) await db.exec(`create table neon_auth."${table}" ("userId" text, secret text)`);
  for (const id of [user, other]) {
    await db.query("insert into users values ($1, $2)", [id, `${id}@example.com`]);
    await db.query('insert into neon_auth."user" values ($1, $2)', [id, `${id}@example.com`]);
    await db.query("insert into profiles values ($1,$2)", [id, id]);
    await db.query("insert into account_deletions values ($1,null,null,now()-interval '1 day')", [id]);
    for (const table of PURGE_OWNER_TABLES) await db.query(`insert into ${table} values ($1,'sensitive')`, [id]);
    for (const table of ["passkey", "twoFactor", "session", "account"]) await db.query(`insert into neon_auth."${table}" values ($1,'credential')`, [id]);
    for (const table of ["oauth_access_tokens", "oauth_refresh_tokens"]) await db.query(`insert into ${table} values ($1,'token')`, [id]);
  }
  return db;
}

describe("irreversible credential purge", () => {
  it("hard-deletes account, OIDC tokens, passkeys and app email assignments while preserving another account", async () => {
    const conn = await fixture();
    await conn.transaction(async (tx) => {
      for (const s of accountPurgeStatements(user, user)) await tx.query(s.query, s.params);
    });
    for (const table of ["users", "oauth_access_tokens", "oauth_refresh_tokens", "app_email_assignments", "account_deletions"]) {
      const column = table === "users" ? "id" : "user_id";
      expect((await conn.query(`select * from ${table} where ${column}=$1`, [user])).rows).toHaveLength(0);
      expect((await conn.query(`select * from ${table} where ${column}=$1`, [other])).rows).toHaveLength(1);
    }
    for (const table of ["passkey", "twoFactor", "session", "account"]) {
      expect((await conn.query(`select * from neon_auth."${table}" where "userId"=$1`, [user])).rows).toHaveLength(0);
      expect((await conn.query(`select * from neon_auth."${table}" where "userId"=$1`, [other])).rows).toHaveLength(1);
    }
  });
  it("cancelled requests roll back without destroying credentials", async () => {
    const conn = await fixture();
    await conn.query("update account_deletions set cancelled_at=now() where user_id=$1", [user]);
    await expect(conn.transaction(async (tx) => { for (const s of accountPurgeStatements(user,user)) await tx.query(s.query,s.params); })).rejects.toThrow();
    expect((await conn.query('select * from neon_auth.passkey where "userId"=$1',[user])).rows).toHaveLength(1);
  });
});