import Link from "next/link";
import { profile } from "../content";

/** Shared footer for / and /uses. */
export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-16 border-t border-panel/80 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
      <div className="container mx-auto px-6 py-6 text-sm text-neutral-500 flex flex-wrap items-center justify-between gap-3">
        <span>&copy; {process.env.NEXT_PUBLIC_BUILD_YEAR} {profile.name}</span>
        <span className="text-neutral-600 text-xs text-center">
          This site collects anonymous visit analytics including approximate location
          and browser information. No personally identifiable information is stored or shared.
        </span>
        <span className="flex items-center gap-4 text-neutral-600">
          <Link href="/uses" className="hover:text-neutral-300 transition">
            Uses
          </Link>
          <span>{new URL(profile.siteUrl).host}</span>
        </span>
      </div>
    </footer>
  );
}
