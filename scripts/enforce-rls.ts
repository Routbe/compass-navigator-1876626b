/**
 * Switches rout_app to NOBYPASSRLS — run only after:
 *   1. the deployed app propagates rout.user_id (src/lib/neon.ts withDbContext),
 *   2. db/0126 is applied,
 *   3. server-only paths (sign-in lookups, cron, public pages) run as a role
 *      that may bypass RLS, otherwise they return no rows.
 * Usage: bun scripts/enforce-rls.ts --confirm
 * Undo:  alter role rout_app bypassrls;  (as neondb_owner)
 */
import { runQuery } from "../src/lib/neon";

if (!process.argv.includes("--confirm")) {
  console.error("Refusing without --confirm. Read the checklist at the top of this file.");
  process.exit(1);
}
const missing = await runQuery(
  "select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
);
if (Number(missing.rows[0]?.["n"]) > 0) {
  console.error(`${missing.rows[0]?.["n"]} public tables still lack RLS; apply db/0126 first.`);
  process.exit(1);
}
await runQuery("alter role rout_app nobypassrls");
console.log("rout_app now obeys RLS.");
