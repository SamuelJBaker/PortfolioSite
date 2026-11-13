import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EditVersionForm, NewVersionForm } from "@/components/admin/ResumeVersionForms";
import { listVersions, type ResumeEnv } from "@/lib/resumes/store";
import { factorsToText, isActiveStatus, MAX_ACTIVE_VERSIONS, type ResumeVersion } from "@/lib/resumes/versions";
import { createVersion, editVersion } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResumesPage() {
  let versions: ResumeVersion[] = [];
  let counts = new Map<string, number>();
  let dbError = false;

  try {
    const { ANALYTICS_DB: db } = (await getCloudflareContext({ async: true })).env as unknown as ResumeEnv;
    versions = await listVersions(db);
    const r = await db
      .prepare(`SELECT resume_version_id AS id, COUNT(*) AS n FROM applications WHERE resume_version_id IS NOT NULL GROUP BY resume_version_id`)
      .all<{ id: string; n: number }>();
    counts = new Map((r.results ?? []).map((row) => [row.id, row.n]));
  } catch (err) {
    console.error("[admin/resumes] failed to load versions:", err);
    dbError = true;
  }

  const active = versions.filter((v) => isActiveStatus(v.status)).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Resume versions</h1>
      <p className="text-sm text-muted mb-8">
        Each version is a PDF whose site link points at <span className="font-mono text-xs">https://samueljbaker.dev/v/__KEY__</span>.
        Applying stamps the application&apos;s key into that link on download; nothing stamped is stored. {active} of{" "}
        {MAX_ACTIVE_VERSIONS} live-or-default slots in use. Change one factor per new version.
      </p>

      {dbError && <p className="text-sm text-red-400">Failed to load versions.</p>}

      <div className="space-y-4 mb-12">
        {!dbError && versions.length === 0 && <p className="text-sm text-muted">No versions yet.</p>}
        {versions.map((v) => (
          <EditVersionForm key={v.id} version={v} factorsText={factorsToText(v.factors)} action={editVersion} applications={counts.get(v.id) ?? 0} />
        ))}
      </div>

      <h2 className="text-lg font-medium mb-4">New version</h2>
      <NewVersionForm action={createVersion} />
    </div>
  );
}
