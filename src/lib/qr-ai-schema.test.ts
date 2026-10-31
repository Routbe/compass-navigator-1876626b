import { describe, it, expect } from "vitest";
import { qrCampaignSchema, normalizeQrSuggestion } from "./qr-ai-schema";
describe("QR campaign AI input", () => {
  it("accepts a destination and campaign goal", () => expect(qrCampaignSchema.safeParse({ destination: "https://example.com/event", goal: "Meer inschrijvingen" }).success).toBe(true));
  it("rejects unsafe destinations", () => expect(qrCampaignSchema.safeParse({ destination: "javascript:alert(1)", goal: "Campaign" }).success).toBe(false));
  it("bounds generated label and call to action", () => expect(normalizeQrSuggestion({ label: "x".repeat(90), callToAction: "y".repeat(120) })).toEqual({ label: "x".repeat(60), callToAction: "y".repeat(80) }));
});