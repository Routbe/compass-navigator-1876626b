import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Building2, ExternalLink } from "lucide-react";
import { getPublicWorkspace } from "@/lib/workspace-public.functions";
import { profileImageSrc } from "@/lib/image-proxy-rules";

export const Route = createFileRoute("/w/$slug")({
  loader: async ({ params }) => {
    const ws = await getPublicWorkspace({ data: { slug: params.slug } });
    if (!ws) throw notFound();
    return ws;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} op ROUT` : "Workspace niet gevonden — ROUT";
    const description = loaderData
      ? `Officiële ROUT-pagina van ${loaderData.name}: links, QR-codes en contact.`
      : "Deze workspace bestaat niet of is niet openbaar.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: WorkspacePage,
});

function WorkspacePage() {
  const ws = Route.useLoaderData();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center text-card-foreground">
        {ws.avatarUrl ? (
          <img src={profileImageSrc(ws.avatarUrl) ?? undefined} alt="" className="mx-auto h-24 w-24 rounded-2xl object-cover" />
        ) : (
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-10 w-10 text-muted-foreground" aria-hidden />
          </div>
        )}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{ws.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">rout.be/w/{ws.slug}</p>
        <div className="mt-6 flex flex-col gap-2">
          {ws.profileHandle && (
            <Link to="/$username" params={{ username: ws.profileHandle }} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">
              Bekijk profiel
            </Link>
          )}
          {ws.domain && (
            <a href={`https://${ws.domain}`} rel="noopener" className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium">
              {ws.domain} <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
