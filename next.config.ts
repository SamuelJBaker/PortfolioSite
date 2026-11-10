import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  },
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
initOpenNextCloudflareForDev();
