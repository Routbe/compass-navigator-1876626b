import { createFileRoute } from "@tanstack/react-router";

/** Publieke sleutels waarmee apps een ROUT-id-token kunnen verifiëren. */
export const Route = createFileRoute("/.well-known/jwks.json")({
  server: {
    handlers: {
      GET: async () => {
        const { publicJwks } = await import("@/lib/oauth/provider.server");
        const { hybridReadyJwks } = await import("@/lib/security/hybrid-jwks");
        return Response.json(hybridReadyJwks(await publicJwks()), {
          headers: { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" },
        });
      },
    },
  },
});
