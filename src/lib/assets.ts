/** Public base for objects in the sjb-assets R2 bucket (custom domain). */
export const ASSET_BASE = "https://assets.samueljbaker.dev";

/** Allowed keys for admin uploads: lowercase path segments, no leading slash. */
export const ASSET_KEY_PATTERN = /^[a-z0-9/_.-]+$/;

export function assetUrl(key: string): string {
  return `${ASSET_BASE}/${key.replace(/^\/+/, "")}`;
}

/** Default key for an uploaded file: lowercased name with anything outside the pattern replaced by "-". */
export function defaultAssetKey(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9/_.-]+/g, "-")
    .replace(/^[-/]+/, "");
}
