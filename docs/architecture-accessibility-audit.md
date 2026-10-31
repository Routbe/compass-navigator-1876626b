# ROUT architecture and accessibility audit — 2026-10-31

## Implemented and checked
- No Google Analytics, Meta Pixel, Hotjar or commercial tracking SDK detected in dependencies or runtime references. No cookie banner added.
- Removed Google-hosted font requests and payment-logo CDN requests; fonts and license-compatible icons are bundled locally.
- Referral identifiers no longer persist in cookies/localStorage. Historical attribution storage is cleared on entry; attribution no longer survives reload/OAuth.
- Shared primary keyboard focus, larger shared buttons, QR field labels/error associations, keyboard-operable uploads and menu navigation, consent label associations, wallet disabled semantics and live card context improved.
- Dark canvas uses #0B0B0C. Print-white QR preview has independent light tokens. Axe reported zero WCAG A/AA violations on the public QR page in both light and dark states after fixes.
- QR layers carry profile-context accessible names, including the instant SVG layer. Decorative equalizers stay hidden because adjacent text already communicates the status.
- Hard purge explicitly deletes passkeys, 2FA secrets, Better Auth sessions/provider tokens, OIDC codes/consents and non-FK app email assignments. Due-request lock/guard, rollback and atomic pseudonymous audit are implemented. A completed request no longer retains its raw user UUID.
- All 38 purge SQL statements were validated with EXPLAIN against live Neon; EXPLAIN did not delete any live account. Isolated PostgreSQL tests verify hard deletion, another account remaining intact and cancelled-request rollback.
- Central Brevo sender now enforces optional notification preferences and signed, recipient-bound RFC8058 headers across template/fallback sends. GET is non-mutating; forged POST returns 403. Necessary identity/security/billing mail is deliberately not made suppressible.
- Full regression run: 204 files / 1,236 tests passed. Manual typecheck exited 0; automatic checks had timed out.

## Remaining findings and limitations
**Critical/high review items:** complete all-page keyboard/screen-reader review; legacy verification progress widget misses required ARIA; live account purge and valid-recipient unsubscribe/mail delivery are not end-to-end tested. No live accounts were destroyed for testing.

**Warnings:** source-wide jsx-a11y inventory still contains 27 findings before the final small labels patch: 11 autofocus usages (many modal/OTP), 5 roving-radio container warnings, 3 label associations, 3 legacy interactive-role findings, 2 focusable informational tooltip warnings, 1 required-ARIA finding and 2 shared-primitive content false positives. Custom Input/Checkbox/Switch components are now correctly recognized, avoiding 34 false label findings. This is not an EAA certification or an assertion that every screen is accessible.

Studio and OAuth consent cannot be verified in a real account session here: Studio redirects to sign-in after authentication resolves; consent requires a registered client and session. Do not substitute a managed Cloud session for ROUT's original Better Auth identity.

Strictly session-only cookie architecture is not established: language/onboarding/OAuth-state cookies exist for functional purposes. No blanket legal exemption is claimed. Third-party maps, payments, identity providers and optional newsletter synchronization are functional integrations, not analytics SDKs.

No external stock photo loads were identified. Unsplash/Pexels remain allowed for explicit member-provided gallery links through ROUT's privacy proxy; not used as built-in placeholder imagery. Existing local raster media and uploaded member photos were not converted to SVG or deleted. Asset license provenance is not fully verified.

OIDC fields reviewed serve scope consent, identity verification, app publishing or security; no clearly redundant mandatory field was proven. Optional profile/contact fields were not removed from unrelated product features. No destructive schema changes applied.

Hard deletion does not imply cryptographic erasure of database backups or object-storage replicas. File/object purge, immutable legacy audit pseudonyms and embedded/shared audit payload retention still require a separately reviewed retention implementation. Existing grace period remains seven days; no production migration files were rewritten.

Mail sender actually lives in src/emails/send.server.ts, not the requested nonexistent brevo.server.ts. Headers apply to optional member notifications, not every essential transactional message. Newsletter campaigns managed in Brevo require their own provider unsubscribe configuration; provider-side delivery/settings remain unverified.

Route metadata inventory found some legacy leaf pages without complete individual metadata; these are documented separately and not treated as a compliance fix.