import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicWorkspace = {
  name: string;
  slug: string;
  avatarUrl: string | null;
  domain: string | null;
  profileHandle: string | null;
};

/** Public card for rout.be/w/<slug>. Only exposes non-private fields of public workspaces. */
export const getPublicWorkspace = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().trim().toLowerCase().max(40) }).parse(d))
  .handler(async ({ data }): Promise<PublicWorkspace | null> => {
    const { isValidWorkspaceSlug } = await import("./workspace-rules");
    if (!isValidWorkspaceSlug(data.slug)) return null;
    const { hasDatabase, sql } = await import("@/lib/neon");
    if (!hasDatabase()) return null;
    const rows = (await sql`
      select w.name, w.slug, w.avatar_url,
             case when w.domain_verified_at is not null then w.domain end as domain,
             (select p.username from public.profiles p
               where p.workspace_id = w.id and coalesce((p.display_prefs->>'publicProfile')::boolean, true)
               order by p.created_at limit 1) as profile_handle
      from public.workspaces w
      where w.slug = ${data.slug}
      limit 1
    `) as { name: string; slug: string; avatar_url: string | null; domain: string | null; profile_handle: string | null }[];
    const r = rows[0];
    if (!r) return null;
    return { name: r.name, slug: r.slug, avatarUrl: r.avatar_url, domain: r.domain, profileHandle: r.profile_handle };
  });

/** rout.be/<handle> → workspace slug when the handle is a workspace root alias; null otherwise. */
export const resolveWorkspaceRootAlias = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ handle: z.string().trim().toLowerCase().max(40) }).parse(d))
  .handler(async ({ data }): Promise<string | null> => {
    if (!/^[a-z0-9-]{3,40}$/.test(data.handle)) return null;
    const { hasDatabase, sql } = await import("@/lib/neon");
    if (!hasDatabase()) return null;
    const rows = (await sql`select public.workspace_slug_for_root_alias(${data.handle}) as slug`.catch(() => [])) as { slug: string | null }[];
    return rows[0]?.slug ?? null;
  });
