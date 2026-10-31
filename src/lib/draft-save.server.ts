import { classifySaveError, isCriticalSaveError, type SaveErrorInfo } from "@/lib/save-errors";
import type { ProfileSpace } from "./profile-drafts.server";

export type DraftSaveFailure = {
  ok: false;
  profile: null;
  reason: string;
  error: SaveErrorInfo;
  /** Present on conflicts so the editor can rebase instead of failing forever. */
  conflict: { currentRevision: number; qrSettingsJson: string | null } | null;
};

/**
 * Shared draft-save runner for the verified and alias Studio. Every failure
 * becomes a structured error; critical ones are mailed to the admin (limited).
 */
export async function runDraftSave(
  userId: string,
  workspaceId: string | null,
  space: ProfileSpace,
  data: Record<string, unknown> & { expectedRevision?: number },
  endpoint: string,
) {
  const { saveProfileDraft, readDraftHead } = await import("./profile-drafts.server");
  const { expectedRevision = 0, ...payload } = data;
  try {
    const meta = await saveProfileDraft(userId, space, payload as never, expectedRevision);
    return { ok: true as const, profile: { ...payload, ...meta }, reason: null, error: null, conflict: null };
  } catch (raw) {
    const error = classifySaveError(raw);
    let conflict: DraftSaveFailure["conflict"] = null;
    if (error.code === "conflict") {
      conflict = await readDraftHead(userId, space).catch(() => null);
    }
    console.error(`[draft-save] ${space} ${error.code}: ${error.detail}`);
    if (isCriticalSaveError(error.code)) {
      void autoReport(raw, error, userId, workspaceId, endpoint);
    }
    const failure: DraftSaveFailure = { ok: false, profile: null, reason: error.detail, error, conflict };
    return failure;
  }
}

async function autoReport(raw: unknown, error: SaveErrorInfo, userId: string, workspaceId: string | null, endpoint: string) {
  try {
    const { reportError } = await import("@/lib/email/error-reporter.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    await reportError({
      errorName: raw instanceof Error ? raw.name : "Error",
      code: error.code,
      status: error.status,
      stack: raw instanceof Error ? raw.stack ?? null : null,
      userId,
      workspaceId,
      endpoint,
      method: "POST",
      userAgent: getRequestHeader("user-agent") ?? null,
      at: error.at,
      trigger: "auto",
    });
  } catch (e) {
    console.warn("[draft-save] auto report skipped:", (e as Error)?.message);
  }
}
