import * as React from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ASSET_BASE, assetUrl } from "@/lib/assets";
import { AssetFileInput } from "@/components/admin/AssetFileInput";
import { uploadAsset } from "./actions";

export const dynamic = "force-dynamic";

interface CloudflareEnv {
  R2_ASSETS: R2Bucket;
}

interface AssetRow {
  key: string;
  size: number;
  uploaded: string;
  contentType: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const INPUT =
  "w-full rounded-xl border border-line bg-panel/60 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-accent/45";

export default async function AssetsPage() {
  let rows: AssetRow[] = [];
  let truncated = false;
  let error = false;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as CloudflareEnv;
    const listed = await env.R2_ASSETS.list({ limit: 500, include: ["httpMetadata"] });
    rows = listed.objects.map((o) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded.toISOString(),
      contentType: o.httpMetadata?.contentType ?? "",
    }));
    truncated = listed.truncated;
  } catch (err) {
    console.error("[admin/assets] list failed:", err);
    error = true;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Assets</h1>
      <p className="text-sm text-muted mb-8">
        Objects in the <span className="font-mono text-xs">sjb-assets</span> bucket, served from{" "}
        <span className="font-mono text-xs">{ASSET_BASE}</span>. Uploading to an existing key replaces
        it.
      </p>

      <h2 className="text-lg font-medium mb-4">Upload</h2>
      <form
        action={uploadAsset}
        className="rounded-2xl border border-line bg-panel/35 p-5 mb-12 max-w-lg space-y-4"
      >
        <div>
          <label className="block text-sm text-body mb-1">File (max 25 MB)</label>
          <AssetFileInput keyInputId="asset-key" />
        </div>
        <div>
          <label htmlFor="asset-key" className="block text-sm text-body mb-1">Key</label>
          <input
            id="asset-key"
            name="key"
            placeholder="prefilled from the file name, e.g. resume/samuel_baker_resume.pdf"
            pattern="[a-z0-9/_.\-]+"
            className={INPUT}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Allowed: a-z 0-9 / _ . - (lowercase). Uploading to an existing key replaces it.
          </p>
        </div>
        <button
          type="submit"
          className="rounded-xl border border-accent/45 bg-accent/10 px-5 py-2 text-sm text-accent-text hover:bg-accent/15 transition"
        >
          Upload
        </button>
      </form>

      <h2 className="text-lg font-medium mb-4">Objects</h2>
      {error && <p className="text-sm text-red-400">Failed to list the bucket.</p>}
      {!error && rows.length === 0 && <p className="text-sm text-muted">The bucket is empty.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-line text-muted text-left">
                <th className="pb-3 pr-6 font-medium">Key</th>
                <th className="pb-3 pr-6 font-medium">Type</th>
                <th className="pb-3 pr-6 font-medium">Size</th>
                <th className="pb-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel">
              {rows.map((r) => (
                <tr key={r.key} className="text-body">
                  <td className="py-3 pr-6 font-mono text-xs">
                    <a href={assetUrl(r.key)} target="_blank" rel="noreferrer" className="text-accent/80 hover:text-accent">
                      {r.key}
                    </a>
                  </td>
                  <td className="py-3 pr-6 text-xs">{r.contentType || "-"}</td>
                  <td className="py-3 pr-6">{formatBytes(r.size)}</td>
                  <td className="py-3 text-neutral-500 text-xs">{r.uploaded.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {truncated && <p className="mt-3 text-xs text-neutral-500">More than 500 objects; list truncated.</p>}
        </div>
      )}
    </div>
  );
}
