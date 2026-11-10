import type { Metadata } from "next";
import { profile, uses } from "../../../content";
import { Section } from "../../../components/Section";
import { SiteFooter } from "../../../components/SiteFooter";
import { SiteNav } from "../../../components/SiteNav";
import { ExternalLinkIcon } from "../../../components/icons";

export const metadata: Metadata = {
  title: `Uses - ${profile.name}`,
  description: uses.intro,
};

/** Static: one typed content file, no Cloudflare context. */
export default function UsesPage() {
  return (
    <div className="relative min-h-screen bg-transparent text-neutral-100 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/35 via-transparent via-30% to-ink/60" />

      <SiteNav />

      <main id="top" className="relative z-10 container mx-auto px-6 py-14 md:py-20">
        <header>
          <p className="tracking-widest text-xs uppercase text-muted">Setup</p>
          <h1 className="mt-2 text-4xl md:text-5xl font-semibold leading-tight">Uses</h1>
          <p className="mt-3 text-sm text-muted">Last updated {uses.updated}</p>
          <p className="mt-5 max-w-2xl text-lg text-body leading-relaxed">{uses.intro}</p>
        </header>

        <div className="mt-12 grid gap-12">
          {uses.sections.map((section) => (
            <Section key={section.id} id={section.id} eyebrow="Uses" title={section.title}>
              {section.id === "toolchain" ? (
                <div className="flex flex-wrap gap-2">
                  {section.items.map((it) => (
                    <span
                      key={it.name}
                      className="inline-flex items-center rounded-full border border-line bg-panel/40 px-3 py-1 text-xs text-body"
                    >
                      {it.name}
                    </span>
                  ))}
                </div>
              ) : (
                <ul className="grid gap-3 rounded-2xl border border-line bg-panel/25 p-6">
                  {section.items.map((it) => (
                    <li key={it.name} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/85 flex-none" />
                      <div>
                        {it.href ? (
                          <a
                            href={it.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-neutral-100 underline decoration-line underline-offset-4 hover:decoration-accent transition"
                          >
                            {it.name}
                            <ExternalLinkIcon className="h-3.5 w-3.5 text-muted" />
                          </a>
                        ) : (
                          <span className="text-neutral-100">{it.name}</span>
                        )}
                        {it.note ? <p className="mt-1 text-sm text-muted">{it.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
