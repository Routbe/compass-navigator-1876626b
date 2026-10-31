<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Import architecture
- ROUT route files remain in src/routes; imported legacy page components live in src/components/imported-pages. Why: preserve the source experience without a second routing framework.
- Preserve this project's Vite bootstrap and Cloud-generated integration files; do not import repository metadata or deployment configuration. Why: the destination runtime and project identity must remain intact.
- Imported ROUT server functions retain their original Neon/Better Auth boundaries until a separately reviewed migration; Cloud provisioning does not connect their tables or sessions. Why: avoid treating an empty managed database as the source's existing accounts.
- Offline worker registration is disabled until the destination config explicitly supports it. Why: no source service worker artifact is available in this project.
- Source-based regression tests follow relocated imported-page paths and browser mocks run only when window exists. Why: the same suite supports server-only and browser test environments.
- Neon migration verification compares immutable file checksums and the replay snapshot without overwriting it with live differences. Why: remaining grant drift and role bypass flags must remain visible for separate review.
