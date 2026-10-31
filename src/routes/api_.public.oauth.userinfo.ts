import { createFileRoute } from "@tanstack/react-router";

/**
 * Userinfo-endpoint: geeft de claims terug die bij de scopes van het
 * access-token horen. `sub` is het (pairwise) subject uit het token; het interne id verlaat de server nooit.
 */
export const Route = createFileRoute("/api_/public/oauth/userinfo")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "authorization, content-type",
          },
        }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const headers = {
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  };
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) {
    return Response.json(
      { error: "invalid_token", error_description: "Bearer-token ontbreekt." },
      { status: 401, headers },
    );
  }
  try {
    const { verifyAccessToken } = await import("@/lib/oauth/provider.server");
    const { sub, userId, scopes, clientId, acr } = await verifyAccessToken(auth.slice(7).trim());
    const { generateUserInfoResponse, ScopeForbiddenError } = await import("@/lib/auth/oidc-identifiers.server");
    try {
      const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      return Response.json(await generateUserInfoResponse(userId, clientId ?? "", scopes, { sub, acr, ip }), { headers });
    } catch (e) {
      if (e instanceof ScopeForbiddenError) {
        return Response.json({ error: "insufficient_scope", error_description: e.code }, { status: 403, headers });
      }
      throw e;
    }
  } catch (error) {
    const known = error as { message?: string };
    return Response.json(
      { error: "invalid_token", error_description: known.message ?? "Token is ongeldig." },
      { status: 401, headers },
    );
  }
}
