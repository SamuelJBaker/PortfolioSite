"use client";

import * as React from "react";
import Link from "next/link";
import { profile } from "../content";
import { FileIcon, GitHubIcon, LinkedInIcon, MailIcon } from "./icons";

type Social = {
  name: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const socials: Social[] = [
  { name: "LinkedIn", href: profile.linkedin, Icon: LinkedInIcon },
  { name: "GitHub", href: profile.github, Icon: GitHubIcon },
  { name: "Email", href: `mailto:${profile.email}`, Icon: MailIcon },
];

const links = [
  { href: "/#experience", label: "Experience" },
  { href: "/#projects", label: "Projects" },
  { href: "/#skills", label: "Skills" },
  { href: "/#resume", label: "Resume" },
  { href: "/#now", label: "Now" },
  { href: "/#contact", label: "Contact" },
  { href: "/uses", label: "Uses" },
];

const MENU_ID = "site-nav-menu";

export function SiteNav() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sticky top-0 z-30 border-b border-panel/70 bg-neutral-950/50 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/40">
      <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* data-console-mark: five taps within 2 s open the engine console (ConsoleTrigger). */}
        <Link href="/#top" className="font-medium text-sm md:text-base" data-console-mark>
          SJB
        </Link>

        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm text-body" aria-label="Sections">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-neutral-100 transition">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={profile.resumePath}
            className="inline-flex items-center gap-2 rounded-2xl border border-accent/45 bg-accent/10 px-4 py-2 text-sm text-accent-text hover:bg-accent/15 transition"
            title="Open resume"
          >
            <FileIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Resume</span>
          </a>

          <a
            href={profile.resumePath}
            download
            className="hidden lg:inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-3 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
            title="Download resume PDF"
          >
            Download
          </a>

          <div className="ml-1 flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel={s.href.startsWith("http") ? "noreferrer" : undefined}
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-panel/30 p-2 text-neutral-200 hover:bg-panel/60 transition"
                aria-label={s.name}
                title={s.name}
              >
                <s.Icon className="h-5 w-5" />
              </a>
            ))}
          </div>

          <button
            type="button"
            className="md:hidden inline-flex items-center rounded-2xl border border-line bg-panel/40 px-3 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
            aria-expanded={open}
            aria-controls={MENU_ID}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      <nav
        id={MENU_ID}
        aria-label="Sections"
        hidden={!open}
        className="md:hidden border-t border-panel/70"
      >
        <ul className="container mx-auto px-6 py-2 flex flex-col text-sm text-body">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block py-2 hover:text-neutral-100 transition"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
