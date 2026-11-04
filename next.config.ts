import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
