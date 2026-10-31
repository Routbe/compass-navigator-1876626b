import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { activateScopeFromUrl } from "@/lib/workspaces.functions";
import { isScopedFeature, SCOPED_FEATURES } from "@/lib/scope-routes";

/** Applies the scope from the URL (server-checked), purges cached data, then opens the feature page. */
export function ScopeGate({ workspaceSlug, feature }: { workspaceSlug: string | null; feature: string }) {
  const activate = useServerFn(activateScopeFromUrl);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!isScopedFeature(feature)) { setError(true); return; }
    void activate({ data: { workspaceSlug } })
      .then(() => {
        if (!alive) return;
        qc.clear();
        void navigate({ to: SCOPED_FEATURES[feature], replace: true });
      })
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [activate, feature, navigate, qc, workspaceSlug]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      {error ? "Geen toegang tot deze omgeving of pagina." : "Omgeving laden…"}
    </div>
  );
}
