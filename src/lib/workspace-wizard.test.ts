import { describe, expect, it } from "vitest";
import { emptyDraft, previewUrl, stepError, suggestSlugBase, WORKSPACE_PLAN_COMPARISON } from "./workspace-wizard";

describe("workspace wizard", () => {
  it("requires a name", () => {
    expect(stepError("identity", emptyDraft())).not.toBeNull();
    expect(stepError("identity", { ...emptyDraft(), name: "Acme" })).toBeNull();
  });
  it("suggests a clean slug and previews the suffixed URL", () => {
    expect(suggestSlugBase("Acme Corp!")).toBe("acme-corp");
    expect(previewUrl("acme-corp", "x89a")).toBe("rout.be/w/acme-corp-x89a");
  });
  it("rejects too-short addresses", () => {
    expect(stepError("address", { ...emptyDraft(), slugBase: "ab" })).not.toBeNull();
    expect(stepError("address", { ...emptyDraft(), slugBase: "acme" })).toBeNull();
  });
  it("needs a category", () => {
    expect(stepError("category", emptyDraft())).not.toBeNull();
    expect(stepError("category", { ...emptyDraft(), category: "agency" })).toBeNull();
  });
  it("validates invites: email, duplicates, role", () => {
    const d = emptyDraft();
    expect(stepError("team", d)).toBeNull();
    expect(stepError("team", { ...d, invites: [{ email: "nope", role: "admin" }] })).not.toBeNull();
    expect(stepError("team", { ...d, invites: [{ email: "a@b.be", role: "admin" }, { email: "A@b.be", role: "viewer" }] })).not.toBeNull();
    expect(stepError("team", { ...d, invites: [{ email: "a@b.be", role: "developer" }] })).toBeNull();
  });
  it("free workspaces get no storage and keep the suffix", () => {
    const free = WORKSPACE_PLAN_COMPARISON[0];
    expect(free.storageMb).toBe(0);
    expect(free.cleanSlug).toBe(false);
  });
});
