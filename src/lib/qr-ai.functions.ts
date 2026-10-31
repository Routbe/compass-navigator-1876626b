import { createServerFn } from "@tanstack/react-start";
import { qrCampaignSchema } from "./qr-ai-schema";
export const suggestQrCampaignFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => qrCampaignSchema.parse(input))
  .handler(async ({ data }) => {
    const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
    const { suggestQrCampaign } = await import("./qr-ai.server");
    const result = await suggestQrCampaign(data, getRequest());
    if (result.ok && result.runId) setResponseHeader("X-Lovable-AIG-Run-ID", result.runId);
    return result;
  });