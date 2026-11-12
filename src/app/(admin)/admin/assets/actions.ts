"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { redirect } from "next/navigation";
import { ASSET_KEY_PATTERN, defaultAssetKey } from "@/lib/assets";

interface CloudflareEnv {
  R2_ASSETS: R2Bucket;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Upload one file to the assets bucket. The key defaults to the file name and
 * must match ASSET_KEY_PATTERN; an existing object at that key is replaced,
 * which is how the resume gets swapped without a commit.
 */
export async function uploadAsset(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File is larger than 25 MB.");

  const keyInput = formData.get("key");
  const key = (typeof keyInput === "string" && keyInput.trim()) || defaultAssetKey(file.name);
  if (!ASSET_KEY_PATTERN.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error("Key must match ^[a-z0-9/_.-]+$ with no empty or dot-dot segments.");
  }

  const ctx = await getCloudflareContext({ async: true });
  const env = ctx.env as unknown as CloudflareEnv;

  // Pass the File itself: R2 needs a known length, which file.stream() lacks.
  await env.R2_ASSETS.put(key, file, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  redirect("/admin/assets");
}
