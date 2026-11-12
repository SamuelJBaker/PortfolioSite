import * as React from "react";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type AccessEnv, accessLogoutUrl } from "@/lib/access";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Set by src/middleware.ts after verifying the Cloudflare Access JWT.
  const email = (await headers()).get("x-admin-email") ?? "";

  let env: AccessEnv = {};
  try {
    env = (await getCloudflareContext({ async: true })).env as AccessEnv;
  } catch (err) {
    console.error("[admin] cloudflare context unavailable:", err);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="border-b border-panel bg-neutral-950/80 backdrop-blur">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-medium text-sm">SJB Admin</span>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <a href="/admin" className="hover:text-neutral-100 transition">Dashboard</a>
              <a href="/admin/analytics" className="hover:text-neutral-100 transition">Analytics</a>
              <a href="/admin/keys" className="hover:text-neutral-100 transition">Keys</a>
              <a href="/admin/now" className="hover:text-neutral-100 transition">Now</a>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted">{email}</span>
            <a href={accessLogoutUrl(env)} className="text-neutral-500 hover:text-body transition">
              Sign out
            </a>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
