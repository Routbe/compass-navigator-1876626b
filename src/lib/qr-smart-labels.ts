import { qrCampaignSchema, normalizeQrSuggestion } from "./qr-ai-schema";
/** One accepted label feeds preview, save and optional dynamic-link creation. */
export function smartLabelSelection(input: { destination: string; label: string; callToAction: string }) {
  const destination = qrCampaignSchema.shape.destination.parse(input.destination);
  const { label, callToAction } = normalizeQrSuggestion(input);
  if (!label || !callToAction) throw new Error("Label en oproep tot actie zijn verplicht.");
  return { destination, label, callToAction };
}