import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const pkgVersion = (name: string) =>
  (JSON.parse(readFileSync(`./node_modules/${name}/package.json`, "utf8")) as { version: string }).version;

// Commit sha from whichever variable the Cloudflare build exposes; "dev" locally.
const buildSha = process.env.CF_PAGES_COMMIT_SHA ?? process.env.WORKERS_CI_COMMIT_SHA;

const nextConfig: NextConfig = {
  experimental: {
    // /admin/assets uploads go through a server action; default cap is 1 MB.
    serverActions: { bodySizeLimit: "25mb" },
  },
  images: {
    // The built-in optimizer is a pass-through on OpenNext Cloudflare in this
    // setup (production /_next/image returns the original file), so a custom
    // loader maps each srcSet width onto a pre-generated WebP instead.
    // images.unoptimized would drop the srcSet entirely.
    loader: "custom",
    loaderFile: "./src/lib/imageLoader.ts",
    deviceSizes: [640, 1280],
    imageSizes: [],
  },
  env: {
    // Inlined at build time, so the prerendered footer and the hydrated client
    // render the same year (no hydration mismatch). Updates on each deploy.
    NEXT_PUBLIC_BUILD_YEAR: String(new Date().getFullYear()),
    // DevTools greeting build line: "build <sha> | Next.js 15 | three r180".
    // Read at build time so the client never imports three for a version string.
    NEXT_PUBLIC_BUILD_SHA: buildSha ? buildSha.slice(0, 7) : "dev",
    NEXT_PUBLIC_NEXT_MAJOR: pkgVersion("next").split(".")[0],
    NEXT_PUBLIC_THREE_REVISION: pkgVersion("three").split(".")[1],
  },
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
