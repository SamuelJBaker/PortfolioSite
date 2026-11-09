"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  education,
  experience,
  mailtoHref,
  metrics,
  now,
  profile,
  projects,
  skills,
} from "../content";
import type { Link } from "../content";

const HEADSHOT_SRC = "/headshot.jpg";

type Social = {
  name: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
};

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M12 0.297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.305-5.466-1.333-5.466-5.93 0-1.31.469-2.381 1.235-3.221-.123-.303-.535-1.523.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.241 2.873.118 3.176.77.84 1.233 1.911 1.233 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.218.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12z"
      />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.03-1.85-3.03-1.85 0-2.13 1.44-2.13 2.93v5.67H9.37V9h3.41v1.56h.05c.47-.9 1.62-1.85 3.34-1.85 3.57 0 4.23 2.35 4.23 5.41v6.33zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.11 20.45H3.56V9h3.55v11.45z"
      />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M6 2h8l4 4v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V7h3.5L14 3.5zM8 11h8v1.5H8V11zm0 3h8v1.5H8V14zm0 3h6v1.5H8V17z"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 3.2-8 5.1-8-5.1V6l8 5.1L20 6v1.2z"
      />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="currentColor"
        d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"
      />
      <path
        fill="currentColor"
        d="M5 5h6v2H7v10h10v-4h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
      />
    </svg>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-panel/40 px-3 py-1 text-xs text-body">
      {children}
    </span>
  );
}


const socials: Social[] = [
  { name: "LinkedIn", href: profile.linkedin, Icon: LinkedInIcon },
  { name: "GitHub", href: profile.github, Icon: GitHubIcon },
  { name: "Email", href: `mailto:${profile.email}`, Icon: MailIcon },
];

const NOW_READING = now.reading;
const NOW_LISTENING_FALLBACK = "Last.fm now playing unavailable.";

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <p className="tracking-widest text-xs uppercase text-muted">{eyebrow}</p>
      <h2 className="mt-2 text-2xl md:text-3xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function NowListening() {
  const [state, setState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    text: string;
    href?: string;
    imageUrl?: string;
    isPlaying?: boolean;
  }>({
    status: "idle",
    text: NOW_LISTENING_FALLBACK,
  });

React.useEffect(() => {
  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function run() {
    try {
      setState((prev) =>
        prev.status === "ready" ? prev : { ...prev, status: "loading", text: "Loading now playing\u2026" }
      );

      const res = await fetch("/api/now-playing", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as {
        isPlaying?: boolean;
        title?: string;
        artist?: string;
        trackUrl?: string;
        imageUrl?: string;
      };

      if (cancelled) return;

      if (!data?.title) {
        setState({ status: "ready", text: "No recent track found.", isPlaying: false });
        return;
      }

      const base = data.artist ? `${data.title} by ${data.artist}` : data.title;
      const text = data.isPlaying ? base : `Last played: ${base}`;

      setState({
        status: "ready",
        text,
        href: data.trackUrl,
        imageUrl: data.imageUrl,
        isPlaying: !!data.isPlaying,
      });
    } catch {
      if (!cancelled) setState({ status: "error", text: NOW_LISTENING_FALLBACK });
    }
  }

  run();
  timer = setInterval(run, 15_000);

  return () => {
    cancelled = true;
    if (timer) clearInterval(timer);
  };
}, []);


  return (
    <div className="mt-2 flex items-start gap-3 text-sm text-body">
      <div className="h-12 w-12 overflow-hidden rounded-xl border border-line bg-neutral-950/40">
        {state.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.imageUrl}
            alt="Album art"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="min-w-0">
{state.isPlaying ? (
  <div className="mb-1 flex items-center gap-2 text-xs text-muted">
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
    <span className="uppercase tracking-widest">Live</span>
  </div>
) : null}

<div className="min-w-0">
  {state.href ? (
    <a
      href={state.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-accent/90 hover:text-accent"
      title="Open in Last.fm"
    >
      <span className="truncate">{state.text}</span>
      <ExternalLinkIcon className="h-4 w-4" />
    </a>
  ) : (
    <span className={classNames(state.status === "loading" && "text-muted")}>
      {state.text}
    </span>
  )}
</div>
      </div>
    </div>
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

      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href={profile.resumePath}
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
        >
          <FileIcon className="h-4 w-4" />
          <span>Open resume</span>
        </a>

        <a
          href={profile.resumePath}
          download
          className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-5 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
        >
          <span>Download PDF</span>
        </a>
      </div>
    </div>
  );
}

function coverUrlFromIsbn(isbn13: string) {
  // Open Library Covers API (append ?default=false to get 404 if missing)
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn13)}-L.jpg?default=false`;
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/75" />

      <div className="sticky top-0 z-30 border-b border-panel/70 bg-neutral-950/50 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/40">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <a href="#top" className="font-medium text-sm md:text-base">
            SJB
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm text-body">
            <a href="#projects" className="hover:text-neutral-100 transition">
              Projects
            </a>
            <a href="#skills" className="hover:text-neutral-100 transition">
              Skills
            </a>
            <a href="#resume" className="hover:text-neutral-100 transition">
              Resume
            </a>
            <a href="#now" className="hover:text-neutral-100 transition">
              Now
            </a>
            <a href="#contact" className="hover:text-neutral-100 transition">
              Contact
            </a>
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
              className="inline-flex items-center gap-2 rounded-2xl border border-line bg-panel/40 px-3 py-2 text-sm text-neutral-200 hover:bg-panel/60 transition"
              title="Download resume PDF"
            >
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">DL</span>
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
          </div>
        </div>
      </div>

      <main id="top" className="relative z-10 container mx-auto px-6 py-14 md:py-20">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full"
        >
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
        </motion.header>


        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="rounded-2xl border border-line bg-panel/35 p-5 backdrop-blur-sm"
            >
              <p className="text-xs uppercase tracking-widest text-muted">{m.label}</p>
              <p className="mt-2 text-2xl font-semibold text-neutral-100">{m.value}</p>
              <p className="mt-2 text-sm text-muted">{m.detail}</p>
            </motion.div>
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
                    className="rounded-2xl border border-line bg-panel/35 p-6 backdrop-blur-sm hover:bg-panel/55 transition"
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
                  className="rounded-2xl border border-line bg-panel/35 p-6 backdrop-blur-sm hover:bg-panel/55 transition"
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
                <div key={g.label} className="rounded-2xl border border-line bg-panel/35 p-5">
                  <p className="text-sm font-medium">{g.label}</p>
                  <p className="mt-2 text-sm text-body">{g.items.join(", ")}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="education" eyebrow="Background" title="Education">
            <div className="space-y-4">
              {education.map((ed) => (
                <div key={ed.institution} className="rounded-2xl border border-line bg-panel/35 p-5">
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
              <div className="rounded-2xl border border-line bg-panel/35 p-6">
                <p className="text-sm font-medium text-neutral-200">What I am reading</p>
                <div className="mt-4 flex gap-4">
                  <div className="h-20 w-14 overflow-hidden rounded-xl border border-line bg-neutral-950/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverUrlFromIsbn(NOW_READING.isbn13)}
                      alt={`Cover of ${NOW_READING.title}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm text-body">
                      <span className="text-neutral-100">{NOW_READING.title}</span>
                      {NOW_READING.author ? ` by ${NOW_READING.author}` : ""}
                    </p>
                    <p className="mt-3 text-sm text-muted">{NOW_READING.note}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-panel/35 p-6">
                <p className="text-sm font-medium text-neutral-200">What I am listening to</p>
                <NowListening />
                <p className="mt-3 text-xs text-neutral-500">
  Powered by Last.fm.
                </p>
              </div>
            </div>
          </Section>
        </div>

        <div className="mt-16">
          <Section id="contact" eyebrow="Get in touch" title="Contact">
            <div className="rounded-2xl border border-line bg-panel/35 p-6">
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

<footer className="relative z-10 mt-16 border-t border-panel/80 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
  <div className="container mx-auto px-6 py-6 text-sm text-neutral-500 flex flex-wrap items-center justify-between gap-3">
    <span>&copy; {process.env.NEXT_PUBLIC_BUILD_YEAR} {profile.name}</span>
    <span className="text-neutral-600 text-xs text-center">
      This site collects anonymous visit analytics including approximate location
      and browser information. No personally identifiable information is stored or shared.
    </span>
    <span className="text-neutral-600">{new URL(profile.siteUrl).host}</span>
  </div>
</footer>
    </div>
  );
}
