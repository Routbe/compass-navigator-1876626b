# Neon security update verification

Migrations 0140–0144 applied individually after explicit approval; all ledger checksums match source.

All booking tokens are present, unique and 64-character hex strings. Pairwise backfill has no eligible null sector IDs.

## Live schema comparison
Historical comparison below predates 0149. On 2026-10-31, approved 0149 reconciled all eight grants to the updated replay, disabled rout_app bypass and enabled Mastodon RLS. The active neondb_owner connection still bypasses RLS. Current full comparison has 14 missing/different schema objects from unapplied 0145–0148 and no grant differences; see strict-rls-final-verification.md.
- ~ grants public.account_deletion_audit differ
- ~ grants public.account_deletions differ
- ~ grants public.identity_disclosure_logs differ
- ~ grants public.mastodon_app_registrations differ
- ~ grants public.merged_auth_account_archive differ
- ~ grants public.security_audit_checkpoints differ
- ~ grants public.verified_identities differ
- ~ grants public.webhook_deliveries differ

## Grant detail
- public.account_deletion_audit: expected {"rout_app":["INSERT","SELECT"]}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.account_deletions: expected {"rout_app":["INSERT","SELECT","UPDATE"]}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.identity_disclosure_logs: expected {"rout_app":["INSERT","SELECT"]}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.mastodon_app_registrations: expected {}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.merged_auth_account_archive: expected {"rout_app":["INSERT","SELECT"]}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.security_audit_checkpoints: expected {}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.verified_identities: expected {"rout_app":["INSERT","SELECT","UPDATE"]}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}
- public.webhook_deliveries: expected {"rout_app":["INSERT","SELECT","UPDATE"]}; live {"rout_app":["DELETE","INSERT","SELECT","UPDATE"]}

## Security limitations
- rout_app has BYPASSRLS enabled; current connector uses neondb_owner. No role flags were changed.
- mastodon_app_registrations inherits rout_app CRUD privileges and has RLS disabled. Original 0144 was preserved; it does not revoke these privileges.
- Historical 91_shadowban checksum drift remains unchanged.

## Checks
- 199 test files and 1186 tests passed.
- Manual TypeScript check passed after editor changes.
- Schema replay completed successfully; committed structure is not replaced with live drift.
- Authenticated profile saving and editor visual validation remain blocked by absence of a ROUT preview session; browser reached /auth/sign-in. No test accounts or session bypass were created on the live database.
