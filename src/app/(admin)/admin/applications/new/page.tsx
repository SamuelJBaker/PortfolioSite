import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";
import { ApplicationForm, type VersionOption } from "@/components/admin/ApplicationForm";
import type { ApplicationFields } from "@/lib/applications/fields";
import { type ApplicationEnv, latestApplication } from "@/lib/applications/store";
import { listVersions } from "@/lib/resumes/store";
import { createApplication } from "../actions";

export const dynamic = "force-dynamic";

/** Selects default to the previous application's values; free text starts empty. */
function defaultsFrom(prev: Partial<ApplicationFields> | null): Partial<ApplicationFields> {
  if (!prev) return {};
  return {
    role_family: prev.role_family,
    level: prev.level,
    work_mode: prev.work_mode,
    ats: prev.ats,
    source_channel: prev.source_channel,
    company_size_band: prev.company_size_band,
    salary_period: prev.salary_period,
    cover_letter: prev.cover_letter,
  };
}

export default async function NewApplicationPage() {
  let defaults: Partial<ApplicationFields> = {};
  let versions: VersionOption[] = [];
  try {
    const { ANALYTICS_DB: db } = (await getCloudflareContext({ async: true })).env as unknown as ApplicationEnv;
    const [prev, vs] = await Promise.all([latestApplication(db), listVersions(db)]);
    defaults = defaultsFrom(prev);
    versions = vs.map((v) => ({ id: v.id, label: v.label, status: v.status }));
  } catch (err) {
    console.error("[admin/applications/new] failed to load defaults:", err);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">New application</h1>
        <Link href="/admin/applications" className="text-sm text-muted hover:text-neutral-200 transition">Back to applications</Link>
      </div>
      <ApplicationForm mode="new" defaults={defaults} versions={versions} action={createApplication} />
    </div>
  );
}
