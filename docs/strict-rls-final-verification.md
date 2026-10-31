# Strict RLS and final deletion verification

## Implemented
- `0149_strict_rls_enforcement.sql` is the append-only successor; 0145 already contains ledger schema and remains immutable.
- Eight explicit grants are reconciled against a freshly replayed snapshot. DELETE on account_deletions and merge archives is intentional for irreversible purge, not copied from drift.
- Mastodon registration credentials remain server-only with deny-by-default RLS; unrestricted tenant CRUD policies would disclose OAuth client secrets. A separate reviewed service path is still required before switching runtime roles.
- Due-request atomic purge explicitly deletes primary-user archives, step-up challenges, step-up codes and email assignments. Per-table PGlite tests preserve another account.
- QR UI requests three real AI suggestions, renders selectable pills below the editable label, and applies label/CTA without enabling tracking.
- Mastodon profile fallback and account-menu metadata use a first-party avatar handler; it validates lookup DNS/response limits and uses the existing secure media cache. Missing object storage returns 503, never a direct provider image fallback.

## Live evidence, 2026-10-31
- Linked Neon connection: current_user = neondb_owner, BYPASSRLS = true, owns 152 public tables.
- After explicit user approval, all statements of 0149 were applied as one Neon gateway transaction (HTTP 200). Readback confirms rout_app BYPASSRLS = false and zero owned public tables.
- Mastodon registration RLS is enabled live. Eight role grant sets and archive DELETE policy match the replay.
- Full read-only live catalog comparison has no remaining grant differences; 14 differences remain from unapplied 0145–0148 (ledger/email/chain schema and audit guard). Live schema is not fully synchronized.
- oauth_step_up_challenges has ON DELETE CASCADE. Merge archive, codes and app_email_assignments have no user FK and need explicit purge.
- Browser: three actual AI suggestions appeared; selecting the second updated Label and applying succeeded; zero page errors.
- Browser: invalid avatar handle returned 400; valid handle returned 503 because persistent storage is unavailable.
- Live deletion and authenticated saving are not verified without an authorized disposable ROUT account.

## Required before claiming live enforcement
1. 0149 role/RLS/grants applied and read back; final tests: 1,271 passing, manual tsgo exit 0.
2. Provision/link a non-owner runtime connection without inherited bypass membership and review public/auth/cron service access. Removing bypass only from the unused role cannot enforce current runtime isolation.
3. Apply/review previously pending 0145–0148 separately and compare the whole live catalog with the replay; 0149 alone cannot eliminate missing earlier ledger/email schema.
4. Verify real signed-in own/foreign reads and due account purge under the final runtime role.