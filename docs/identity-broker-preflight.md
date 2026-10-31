# Identity broker preflight — 2026-10-31

## Verified and completed
- Existing Neon connection linked and read through the generated app credential path.
- Existing 0136–0138 migrations already recorded; existing 0139 applied, without duplicate tables or editing migration history.
- Per-app email selectors, consent UI and bulk wizard already existed; corrected connected-app query to use `granted_at` (the actual consent column).
- App primary assignments now retain their consented address until explicitly updated. Removed aliases and unavailable private choices never disclose primary instead.
- Sensitive UserInfo responses fail closed when their audit write fails.
- Webhook registration/delivery reuse public DNS host validation; redirects remain disabled. This is not a claim of complete DNS-rebinding protection.
- Added four UserInfo/privacy regressions and two persisted bulk-update/rollback regressions; all 1,110 tests pass. Manual `tsgo --noEmit` exits 0.
- Official GNU AGPL v3 license text added verbatim; package and README declare AGPL-3.0-or-later. About/Manifesto translations and sovereignty/trust labels explain network copyleft. Footer checked at desktop and 384px mobile widths.
- `/data-deletion` exists with metadata; the initial background audit's claim that it was missing was incorrect.

## Unresolved, not certified
- Legacy public-subject clients still emit internal UUID subjects. Changing these subjects without a coordinated app-account migration would break existing bindings; the broker is not yet universally pairwise.
- `allowed_scopes` added by 0139 is not yet an authoritative runtime permission boundary; existing `scopes` checks remain.
- Current national-ID gate uses strict ACR, not proven biometric step-up; raw registry numbers are intentionally not retained or disclosed. No claim of completed national-ID selective disclosure.
- Account merging needs explicit, atomic ownership/credential/identity conflict handling; existing generic move/delete logic is not certified safe.
- Fresh session age is not sufficient evidence of passkey authentication. Step-up proof needs server-verified WebAuthn completion, bound to the session and consumed once.
- Existing webhook dispatcher is best-effort, not a durable delivery guarantee; subject compatibility and versioned webhook KEK rotation remain unresolved.
- Snapshot is generated from migration replay, not normalized to live drift. Live comparison reports nine grant differences and an audit sequence difference. Historical `91_shadowban.sql` checksum differs; left untouched.
- Only Neon and managed platform/cron credentials are configured. Existing live pairwise/relay secret, signing KEK, Sybil pepper, auth secrets, social login credentials, mail credentials, Wallet certificates and Last.fm credential remain missing. Do not replace existing identity/signing secrets with random new values.
- Real authenticated consent, primary-email change and cross-app delivery have not been exercised. No production user data was modified for tests.
- Production residency, zero-tracking/retention guarantees and GitHub repository metadata require external evidence/access; existing text is not evidence of those guarantees.