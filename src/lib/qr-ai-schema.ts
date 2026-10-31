import { z } from "zod";
import { validatedRedirectTarget } from "./security/redirect-target";
export const qrCampaignSchema = z.object({
  destination: z.string().min(1).max(2048).refine(v => Boolean(validatedRedirectTarget(v)) && v.startsWith("https://"), "Vul een veilige https:// bestemming in."),
  goal: z.string().trim().min(3).max(500),
});
export function normalizeQrSuggestion(value: { label: string; callToAction: string }) {
  return { label: value.label.trim().slice(0, 60), callToAction: value.callToAction.trim().slice(0, 80) };
}