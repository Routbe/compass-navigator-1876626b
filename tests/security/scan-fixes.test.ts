import { describe, it, expect, vi, beforeEach } from "vitest";
import { mastodonHandleUrl, limitedImageBody, IMAGE_MAX_BYTES, IMAGE_TIMEOUT_MS } from "@/lib/integrations/mastodon.server";
import { validateOutboundUrl } from "@/lib/security/ssrf-guard.server";
import { validatedRedirectTarget, redirectDestination } from "@/lib/security/redirect-target";
import { redirectUrisMatch } from "@/lib/oauth/redirect-match";
import { validBookingToken } from "@/lib/booking-engine/access";
const sqlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/neon", () => ({ sql: Object.assign((...args: unknown[]) => sqlMock(...args), { query: (...args: unknown[]) => sqlMock(...args) }) }));
import { bookingSummary } from "@/lib/booking-engine/public.server";
import { readBookingDetails } from "@/lib/booking-engine/details.server";
beforeEach(() => { vi.restoreAllMocks(); sqlMock.mockReset(); });

describe("scan security boundaries", () => {
  it.each(["@user@127.0.0.1", "@user@169.254.169.254"])("rejects local Mastodon handle %s with 400", handle => {
    try { mastodonHandleUrl(handle); throw new Error("accepted unsafe handle"); } catch (e) { expect((e as { status?: number }).status).toBe(400); }
  });
  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "[::1]", "[fe80::1]", "[::ffff:7f00:1]"])("blocks address %s", async host => {
    await expect(validateOutboundUrl(`https://${host}/avatar.png`)).rejects.toMatchObject({ status: 400 });
  });
  it("rejects public-looking domains resolving to metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ Answer: [{ type: 1, data: "169.254.169.254" }] }))));
    await expect(validateOutboundUrl(mastodonHandleUrl("@user@example.com").href)).rejects.toMatchObject({ status: 400 });
    vi.unstubAllGlobals();
  });
  it("uses a 3 second image deadline and a 5 MB limit", () => { expect(IMAGE_TIMEOUT_MS).toBe(3000); expect(IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024); });
  it.each(["image/gif", "image/svg+xml", "text/html", "image/png-malicious"])("rejects content type %s", async type => {
    await expect(limitedImageBody(new Response("data", { headers: { "Content-Type": type } }))).rejects.toMatchObject({ status: 415 });
  });
  it("stops oversized image streams", async () => {
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(IMAGE_MAX_BYTES)); c.enqueue(new Uint8Array(1)); c.close(); } });
    await expect(limitedImageBody(new Response(stream, { headers: { "Content-Type": "image/png" } }))).rejects.toMatchObject({ status: 413 });
  });
  it("returns no guest PII without a booking token", async () => {
    sqlMock.mockResolvedValue([{ id: "id", status: "confirmed", title: "Appointment", start_utc: "2026-11-05T14:00:00Z", end_utc: "2026-11-05T14:30:00Z", guest_name: "PRIVATE NAME", guest_email: "private@example.com", guest_note: "PRIVATE NOTE", booking_token: "a".repeat(64), location_kind: "video", location_value: "PRIVATE LOCATION" }]);
    const result = await bookingSummary("id");
    expect(result?.guestName).toBeNull(); expect(result?.locationValue).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|private@example.com/);
  });
  it("binds guest tokens to the individual booking", () => { expect(validBookingToken("a".repeat(64), "b".repeat(64))).toBe(false); expect(validBookingToken("a".repeat(64), "a".repeat(64))).toBe(true); });
  it("refuses anonymous booking detail API requests with zero PII", async () => {
    sqlMock.mockResolvedValue([{ id: "id", booking_token: "a".repeat(64), guest_name: "PRIVATE", guest_email: "private@example.com", guest_note: "SECRET" }]);
    expect(await readBookingDetails("id", null, null)).toEqual({ forbidden: true });
  });
  it("refuses ordinary workspace members even when assigned as host", async () => {
    sqlMock.mockResolvedValue([{ id: "id", workspace_id: "workspace", host_user_id: "member", workspace_admin: false, booking_token: "a".repeat(64) }]);
    expect(await readBookingDetails("id", null, "member")).toEqual({ forbidden: true });
  });
  it("allows workspace admins full host details", async () => {
    sqlMock.mockResolvedValue([{ id: "id", workspace_id: "workspace", workspace_admin: true, guest_note: "host note", guest_email: "guest@example.com" }]);
    const result = await readBookingDetails("id", null, "admin");
    expect(result?.forbidden).toBe(false); if (!result || result.forbidden) throw new Error("denied admin");
    expect(result.meeting_notes).toBe("host note"); expect(result.guest_email).toBe("guest@example.com");
  });
  it("never exposes host notes to token guests", async () => {
    sqlMock.mockResolvedValue([{ id: "id", booking_token: "a".repeat(64), guest_note: "host note", guest_name: "own guest" }]);
    const result = await readBookingDetails("id", "a".repeat(64), null);
    if (!result || result.forbidden) throw new Error("denied guest"); expect(result.meeting_notes).toBeNull(); expect(result.guest_name).toBe("own guest");
  });
  it.each(["//evil.com", "javascript:alert(1)", "data:text/html,hi", "vbscript:msgbox(1)", "/\\evil.com", "http://evil.com", "https://user:password@evil.com", "/%2f%2fevil.com"])("rejects /go target %s", value => expect(validatedRedirectTarget(value)).toBeNull());
  it("requires confirmation for unverified external links", () => expect(redirectDestination("https://example.com/campaign")).toBe("/leaving?target=https%3A%2F%2Fexample.com%2Fcampaign"));
  it("directly redirects tier-verified creators", () => expect(redirectDestination("https://example.com/campaign", true)).toBe("https://example.com/campaign"));
  it("directly redirects registered custom domains", () => expect(redirectDestination("https://owned.example/campaign", false, ["owned.example"])).toBe("https://owned.example/campaign"));
  it("accepts internal paths", () => expect(redirectDestination("/studio/profile")).toBe("/studio/profile"));
  it.each(["https://app.example/cb/", "https://app.example/cb?next=evil", "https://sub.app.example/cb", "https://app.example/a/../cb"])("rejects non-exact OAuth URI %s", value => expect(redirectUrisMatch("https://app.example/cb", value)).toBe(false));
});