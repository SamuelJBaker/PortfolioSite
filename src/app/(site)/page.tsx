"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  education,
  experience,
  mailtoHref,
  metrics,
  profile,
  projects,
  skills,
} from "../../content";
import type { Link } from "../../content";
import { classNames } from "../../lib/classNames";
import { ExternalLinkIcon, FileIcon, LinkedInIcon, MailIcon } from "../../components/icons";
import { Section } from "../../components/Section";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteNav } from "../../components/SiteNav";
import { NowListening } from "../../components/now/NowListening";
import { NowReading } from "../../components/now/NowReading";
import { ChessCard } from "../../components/now/ChessCard";

// Pre-generated WebP variants (640, 1280); the image loader in next.config maps
// each srcSet width onto one of them.
const HEADSHOT_SRC = "/headshot-1280.webp";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-panel/40 px-3 py-1 text-xs text-body">
      {children}
    </span>
  );
}


function ResumePreview() {
  return (
    <div className="rounded-2xl border border-line bg-panel/35 p-6">
      <p className="text-sm text-body">
        Quick preview. If the embed does not load in your browser, use the open or download buttons.
      </p>

      <div className="mt-4 hidden md:block">
        <div className="aspect-[8.5/11] w-full overflow-hidden rounded-xl border border-line bg-neutral-950/50">
          <iframe title="Resume preview" src={profile.resumePath} className="h-full w-full" />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap">
        <a
          href={profile.resumePath}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
        >
          <FileIcon className="h-4 w-4" />
          <span>Open resume</span>
        </a>

        <a
          href={profile.resumePath}
          download
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
        >
          <span>Download PDF</span>
        </a>
      </div>
    </div>
  );
}

function ProjectLinks({ links, className = "mt-5" }: { links?: Link[]; className?: string }) {
  if (!links?.length) return null;
  return (
    <div className={classNames(className, "flex flex-wrap gap-3")}>
      {links.map((l) => {
        const isHttp = l.href.startsWith("http");
        return (
          <a
            key={l.label}
            href={l.href}
            target={isHttp ? "_blank" : undefined}
            rel={isHttp ? "noreferrer" : undefined}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition border-line bg-panel/40 text-neutral-200 hover:bg-panel/60"
          >
            <span>{l.label}</span>
            {l.external || isHttp ? <ExternalLinkIcon className="h-4 w-4 opacity-70" /> : null}
          </a>
        );
      })}
    </div>
  );
}

const featuredProjects = projects.filter((p) => p.featured);
const earlierProjects = projects.filter((p) => !p.featured);

export default function Page() {
  return (
    <div className="relative min-h-screen bg-transparent text-neutral-100 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/35 via-transparent via-30% to-ink/60" />

      <SiteNav />

      <main id="top" className="relative z-10 container mx-auto px-6 py-14 md:py-20">
        {/* Above the fold: no entrance animation. framer-motion serialises
            `initial` into the server HTML, so an animated hero paints at
            opacity 0 and stays blank until hydration (see docs/phase-3). */}
        <header className="w-full">
          <p className="tracking-widest text-xs uppercase text-muted">{profile.tagline}</p>

          <div className="mt-3 grid gap-8 md:grid-cols-[minmax(0,1fr)_clamp(11rem,26vw,22rem)] md:items-center">
            <div className="min-w-0 max-w-2xl order-2 md:order-1">
              <h1 className="text-4xl md:text-6xl font-semibold leading-tight">{profile.name}</h1>

              <p className="mt-5 text-lg md:text-xl text-body leading-relaxed">{profile.bio[0]}</p>
              {profile.bio.slice(1).map((para) => (
                <p key={para} className="mt-4 text-base text-muted leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            <div className="order-1 md:order-2 flex justify-center md:justify-end md:pr-4">
              <div className="relative aspect-square w-36 sm:w-44 md:w-full rounded-full border border-accent/50 bg-panel/30 p-[2px] backdrop-blur-sm">
                <div className="relative h-full w-full overflow-hidden rounded-full">
                  <Image
                    src={HEADSHOT_SRC}
                    alt={`${profile.name} headshot`}
                    fill
                    sizes="(min-width: 768px) 22rem, 11rem"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <a
              href="#projects"
              className="rounded-2xl border border-accent/45 bg-accent/10 px-5 py-2 text-accent-text hover:bg-accent/15 transition"
            >
              Explore projects
            </a>
            <a
              href={profile.resumePath}
              className="rounded-2xl border border-line bg-panel/40 px-5 py-2 hover:bg-panel/60 transition"
            >
              Open resume
            </a>
            <a
              href={mailtoHref}
              className="rounded-2xl border border-line bg-panel/40 px-5 py-2 hover:bg-panel/60 transition"
            >
              Email me
            </a>
          </div>
        </header>


        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-line bg-panel/35 p-5"
            >
              <p className="text-xs uppercase tracking-widest text-muted">{m.label}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-100">{m.value}</p>
              <p className="mt-2 text-sm text-muted">{m.detail}</p>
            </div>
          ))}
        </div>

        {experience.length > 0 ? (
          <div className="mt-16">
            <Section id="experience" eyebrow="Career" title="Experience">
              <div className="grid gap-6">
                {experience.map((e, i) => (
                  <motion.article
                    key={`${e.company}-${e.start}`}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.5, delay: i * 0.06 }}
                    className="rounded-2xl border border-line bg-panel/35 p-6 hover:bg-panel/55 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg md:text-xl font-medium">{e.company}</h3>
                        <p className="mt-1 text-sm text-body">{e.role}</p>
                        <p className="mt-1 text-sm text-muted">
                          {`${e.start} to ${e.end} \u00b7 ${e.location}`}
                        </p>
                      </div>
                      <div className="hidden sm:block text-right text-xs text-neutral-500">
                        {e.tags.slice(0, 3).join(" \u00b7 ")}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {e.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>

                    <ul className="mt-4 space-y-2 text-sm text-body">
                      {e.bullets.map((b) => (
                        <li key={b} className="flex gap-3">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/85 flex-none" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.article>
                ))}
              </div>
            </Section>
          </div>
        ) : null}

        <div className="mt-16">
          <Section id="projects" eyebrow="Work" title="Projects">
            <div className="grid gap-6 lg:grid-cols-2">
              {featuredProjects.map((p, i) => (
                <motion.article
                  key={p.slug}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="rounded-2xl border border-line bg-panel/35 p-6 hover:bg-panel/55 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg md:text-xl font-medium">{p.title}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {p.timeframe}
                        {p.location ? ` \u00b7 ${p.location}` : ""}
                      </p>
                    </div>
                    <div className="hidden sm:block text-right text-xs text-neutral-500">
                      {p.tags.slice(0, 3).join(" \u00b7 ")}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>

                  <ul className="mt-4 space-y-2 text-sm text-body">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-3">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent/85 flex-none" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  {p.note ? <p className="mt-4 text-sm text-muted">{p.note}</p> : null}

                  <ProjectLinks links={p.links} />
                </motion.article>
              ))}
            </div>

            {earlierProjects.length > 0 ? (
              <details className="mt-10 rounded-2xl border border-line bg-panel/25 p-6">
                <summary className="cursor-pointer text-sm font-medium text-neutral-200">Earlier work</summary>
                <ul className="mt-4 space-y-6">
                  {earlierProjects.map((p) => (
                    <li key={p.slug}>
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <p className="text-sm font-medium text-neutral-100">{p.title}</p>
                        <p className="text-xs text-neutral-500">{p.timeframe}</p>
                      </div>
                      <p className="mt-2 text-sm text-body">{p.highlights[0]}</p>
                      <ProjectLinks links={p.links} className="mt-3" />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Section>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <Section id="skills" eyebrow="Toolkit" title="Skills">
            <div className="grid gap-4">
              {skills.map((g) => (
                <div key={g.label} className="rounded-2xl border border-line bg-panel/25 p-5">
                  <p className="text-sm font-medium">{g.label}</p>
                  <p className="mt-2 text-sm text-body">{g.items.join(", ")}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="education" eyebrow="Background" title="Education">
            <div className="space-y-4">
              {education.map((ed) => (
                <div key={ed.institution} className="rounded-2xl border border-line bg-panel/25 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{ed.institution}</p>
                    <p className="text-xs text-neutral-500">{ed.dates}</p>
                  </div>
                  {ed.detail.map((line, i) => (
                    <p key={line} className={classNames(i === 0 ? "mt-2" : "mt-1", "text-sm text-body")}>
                      {line}
                    </p>
                  ))}
                  <p className="mt-1 text-sm text-muted">GPA {ed.gpa}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-16">
          <Section id="resume" eyebrow="Document" title="Resume">
            <ResumePreview />
          </Section>
        </div>

        <div className="mt-16">
          <Section id="now" eyebrow="What am I up to?" title="Now">
            <div className="grid gap-6 lg:grid-cols-2">
              <NowReading />
              <NowListening />
              <div className="min-w-0 lg:col-span-2">
                <ChessCard />
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-16">
          <Section id="contact" eyebrow="Get in touch" title="Contact">
            <div className="rounded-2xl border border-line bg-panel/25 p-6">
              <p className="text-sm text-body">
                Best way to reach me is email. LinkedIn also works.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={mailtoHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
                >
                  <MailIcon className="h-4 w-4" />
                  <span>Email</span>
                </a>

                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(profile.email)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
                >
                  <span>Copy email</span>
                </button>

                <a
                  href={profile.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
                >
                  <LinkedInIcon className="h-4 w-4" />
                  <span>LinkedIn</span>
                  <ExternalLinkIcon className="h-4 w-4 opacity-70" />
                </a>
              </div>
            </div>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
