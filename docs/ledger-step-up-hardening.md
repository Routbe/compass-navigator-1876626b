# Ledger and step-up hardening

## Delivered
- Browser-generated RSA-OAEP 3072-bit keys; AES-256-GCM event envelopes with authenticated key IDs and random per-event keys/IVs.
- Client-only private-key envelopes under independently generated 256-bit recovery codes and optional WebAuthn PRF. Neither KEK is submitted to ROUT. Runtime decrypt keys are nonextractable.
- Versioned public keys and encrypted private keys; authenticated ledger-only reset leaves account credentials, profiles and domains unchanged. Old key envelopes/history remain available.
- Server app-login, sign-in and sensitive-disclosure events encrypt immediately using the public key. No plaintext queue. Pre-migration missing-table reads skip opt-in ledger only; other errors fail closed.
- Passkey step-up now originates only in the successful WebAuthn verification hook with user verification; recent password/magic-link session creation is not accepted. Merge and app-email changes require passkey proof.
- Staged primary email confirmation, 48-hour old-address reservation/recovery freeze, immediate warning requirement, single-use freeze, session/token revocation. GET links are non-mutating; confirmation requires authentication and fresh passkey.
- Serialized disclosure hash chain, canonical length-prefixed input, bounded complete verification and domain-separated Merkle root. Legacy backfill is not proof of pre-migration integrity. Merge refuses immutable disclosure/ledger rows rather than rewriting their identity.
- JWKS retains real ES256 keys; ML-DSA readiness metadata explicitly says no hybrid signing or PQ keys. Compatible OIDC remains; blind issuance is not implemented.

## Important limitations
- Write-only at rest is not zero knowledge of live events: the issuer necessarily sees events it generates before encrypting them. A malicious server can change served JavaScript, substitute keys or retain plaintext; client-only keys alone do not defeat that threat model.
- Hash chains/Merkle roots detect tampering against trusted retained roots. A privileged operator can rewrite an entire unanchored history. External checkpoint anchoring and scheduled full verification are not delivered.
- Existing operational security/disclosure logs remain separate and server-readable; this opt-in ledger does not magically encrypt all existing operational data.
- New migrations 0145–0147 are replay-tested but NOT applied to live Neon pending explicit approval. Immutable 0140–0144 remain untouched. No schema was added to the unrelated managed database.
- Signed-in Studio, physical passkey PRF, actual mail delivery and live emergency freeze were not verified: no authorized disposable ROUT account/passkey session is available.
- Emergency freeze intentionally disables the compromised account and revokes sessions. An independently reviewed recovery/unfreeze flow is still required before activating email-safety changes in production. No new threshold-recovery protocol is claimed.
- Ledger reset uses normal authenticated account access so losing ledger keys never blocks the account; authentication recovery remains the existing ROUT mechanism.
- Full-content route metadata outside the changed pages remains prior audit scope; new recovery pages have distinct metadata and no-referrer/noindex.

## Deployment
Review and approve each new Neon migration in full before applying sequentially. Do not activate the primary-email workflow until the emergency recovery/unfreeze path is reviewed and tested with a disposable account. No claim of production-ready end-to-end verification is made.

## Verification results
- Full Vitest suite: 209 files, 1,254 tests passed.
- Manual `bunx tsgo --noEmit`: exit 0 after the automatic checker timed out.
- Migration replay on PGlite: passes; schema snapshot/types regenerated only from immutable migration replay.
- Browser: freeze and confirmation pages render without page errors; absent tokens disable actions; Studio correctly redirects signed-out users to sign-in. Authenticated flows remain unverified.