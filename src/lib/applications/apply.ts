import { assignVersion } from "@/lib/appstats";
import { isActiveStatus } from "@/lib/resumes/versions";
import { generateKey } from "./fields";
import { applyApplication, keyExists, loadStatsData, type ApplicationRow } from "./store";

/** What the page shows right after Apply: the link, the version and the draws that chose it. */
export interface AppliedResult {
  id: number;
  key: string;
  versionId: string;
  versionLabel: string;
  assignedBy: "random" | "manual";
  reason: "draw" | "floor" | "single" | "manual";
  draws: Record<string, number>;
  labels: Record<string, string>;
}

/**
 * Apply a saved row: draw the version (Thompson sampling in assign.ts) unless
 * one was chosen by hand, mint the key, and write both in one batch.
 */
export async function performApply(
  db: D1Database,
  app: ApplicationRow,
  input: { fit: number; effortMinutes: number; manualVersionId: string | null; now: string }
): Promise<{ result: AppliedResult } | { error: string }> {
  if (app.status !== "saved") return { error: "This application is not in the backlog." };

  const data = await loadStatsData(db);
  const labels = Object.fromEntries(data.versions.map((v) => [v.id, v.label]));
  const live = data.versionInputs.filter((v) => isActiveStatus(v.status));

  let versionId: string;
  let assignedBy: "random" | "manual";
  let reason: AppliedResult["reason"];
  let draws: Record<string, number> = {};
  if (input.manualVersionId) {
    const chosen = data.versions.find((v) => v.id === input.manualVersionId);
    if (!chosen) return { error: "Unknown resume version." };
    versionId = chosen.id;
    assignedBy = "manual";
    reason = "manual";
  } else {
    if (live.length === 0) return { error: "No live resume version. Upload one at /admin/resumes first, or choose a version by hand." };
    const seed = (Date.parse(input.now) ^ (app.id * 2654435761)) >>> 0;
    const a = assignVersion(live, app.role_family, data.inputs, input.now, data.config, seed);
    if (!a) return { error: "No live resume version." };
    versionId = a.versionId;
    assignedBy = "random";
    reason = a.reason;
    draws = a.draws;
  }

  let key = generateKey();
  for (let i = 0; i < 5 && (await keyExists(db, key)); i++) key = generateKey();
  if (await keyExists(db, key)) return { error: "Could not mint a unique key; try again." };

  await applyApplication(db, app, { key, versionId, assignedBy, fit: input.fit, effortMinutes: input.effortMinutes, appliedAt: input.now });
  return { result: { id: app.id, key, versionId, versionLabel: labels[versionId] ?? versionId, assignedBy, reason, draws, labels } };
}
