# ROUT repository import verification
Source: https://github.com/Routbe/compass-navigator-43.git, main, ebc9070. Owner permission confirmed.
Imported source directly; no deployed source website was supplied or captured. Source/preview visual parity is unverified.

| Route | Viewport | Control | Observed result | Status |
| --- | --- | --- | --- | --- |
| / | 1280×1800 | URL input | QR rendered for https://example.com/compass-import | Passed |
| / | 1280×1800 | Download QR code | PNG downloaded successfully | Passed |
| / | 1280×1800 | Frame | Existing frame panel opens | Passed |
| / | 1280×1800 | Wheel scroll | Footer visible after scrolling | Passed |
| / | 390×844 | URL input | QR rendered after hydration; no document overflow | Passed |
| / | 390×844 | Open menu | Navigation panel opens | Passed |
| Authenticated pages | Both | Accounts, stored profiles, payments, uploads | Original database and service credentials absent | Blocked |

Evidence: /tmp/browser/compass-import/{qr,frame,bottom,mobile,mobile-menu}.png; flow.log.
No static media replacements or normal-flow panel rewrites were introduced. Offline worker registration disabled because destination has no worker generation configuration.
Manual tsgo --noEmit passed with repository compiler settings. Targeted tests: 21 passed. Preview build reports no build errors; automatic typechecking timed out.
