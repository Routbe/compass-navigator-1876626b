/** Pure rules for the 5-step "new workspace" wizard. Shared by the UI and createWorkspace (server). */
import { isValidWorkspaceSlug, slugify } from "./workspace-rules";
import { STORAGE_QUOTA_MB } from "./entitlement-engine";

export const WIZARD_STEPS = ["identity", "address", "category", "team", "plan"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WORKSPACE_CATEGORIES = ["business", "agency", "nonprofit", "event", "project"] as const;
export type WorkspaceCategory = (typeof WORKSPACE_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<WorkspaceCategory, string> = {
  business: "Bedrijf / KMO",
  agency: "Agency / Studio",
  nonprofit: "Non-profit",
  event: "Event",
  project: "Project",
};

export const INVITE_ROLES = ["admin", "developer", "viewer"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
export const MAX_WIZARD_INVITES = 20;

export type WizardDraft = {
  name: string;
  description: string;
  avatarUrl: string | null;
  slugBase: string;
  category: WorkspaceCategory | null;
  invites: { email: string; role: InviteRole }[];
};

export const emptyDraft = (): WizardDraft => ({ name: "", description: "", avatarUrl: null, slugBase: "", category: null, invites: [] });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Error message for a step, or null when the step is complete. */
export function stepError(step: WizardStep, d: WizardDraft): string | null {
  switch (step) {
    case "identity":
      if (!d.name.trim()) return "Geef je workspace een naam.";
      if (d.name.trim().length > 80) return "De naam mag maximaal 80 tekens zijn.";
      if (d.description.length > 280) return "De omschrijving mag maximaal 280 tekens zijn.";
      return null;
    case "address":
      if (!isValidWorkspaceSlug(`${d.slugBase}-abcd`) || d.slugBase.length < 3) return "Kies een adres van minstens 3 tekens: alleen a-z, 0-9 en koppeltekens.";
      return null;
    case "category":
      return d.category ? null : "Kies een categorie.";
    case "team": {
      if (d.invites.length > MAX_WIZARD_INVITES) return `Maximaal ${MAX_WIZARD_INVITES} uitnodigingen tegelijk.`;
      const seen = new Set<string>();
      for (const i of d.invites) {
        const e = i.email.trim().toLowerCase();
        if (!EMAIL_RE.test(e)) return `"${i.email}" is geen geldig e-mailadres.`;
        if (seen.has(e)) return `${e} staat er twee keer in.`;
        if (!(INVITE_ROLES as readonly string[]).includes(i.role)) return "Ongeldige rol.";
        seen.add(e);
      }
      return null;
    }
    case "plan":
      return null;
  }
}

/** Slug base suggested from the name (the 4-char suffix is added by the server). */
export function suggestSlugBase(name: string): string {
  return slugify(name).slice(0, 34).replace(/-+$/, "");
}

/** URL preview: rout.be/w/<base>-<suffix>. */
export function previewUrl(slugBase: string, suffix: string): string {
  return `rout.be/w/${slugBase || "naam"}-${suffix}`;
}

/** Plan comparison shown in step 5. Storage comes from the entitlement engine. */
export const WORKSPACE_PLAN_COMPARISON = [
  { tier: "free", label: "Free", priceLabel: "€0", storageMb: STORAGE_QUOTA_MB.workspace.free, qrCodes: "10", apiKeys: "1", cleanSlug: false },
  { tier: "pro", label: "Pro", priceLabel: "Upgrade", storageMb: STORAGE_QUOTA_MB.workspace.pro, qrCodes: "Onbeperkt", apiKeys: "10", cleanSlug: true },
  { tier: "business", label: "Max", priceLabel: "Upgrade", storageMb: STORAGE_QUOTA_MB.workspace.business, qrCodes: "Onbeperkt", apiKeys: "Onbeperkt", cleanSlug: true },
] as const;

export function formatMb(mb: number): string {
  if (mb <= 0) return "0 MB";
  return mb >= 1024 ? `${Math.round(mb / 1024)} GB` : `${mb} MB`;
}
