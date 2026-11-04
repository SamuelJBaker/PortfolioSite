export type Experience = {
  company: string;
  role: string;
  location: string;
  /** Display string, e.g. "May 2026". */
  start: string;
  end: string | "Present";
  bullets: string[];
  tags: string[];
};

export const experience: Experience[] = [
  {
    company: "Scaffold Education",
    role: "Software Engineer, Platform and Infrastructure",
    location: "Charlottesville, VA",
    start: "May 2026",
    end: "Present",
    bullets: [
      "Architected and shipped a self-hosted chemical engineering LMS (66 pages, 55 modules) in daily production use by 90+ students.",
      "Built the telemetry pipeline and instructor progress dashboard (14,700+ per-question attempt events); diagnosed session-expiry and reveal-forfeit bugs from the event data, then shipped server-derived completion and a backfill restoring progress for 30 students.",
      "Designed the identity system: HMAC-SHA256 pseudonymization with a custodian-held pepper, httpOnly HS256 JWT cookie sessions, role-gated instructor access, and a re-sealable identity map so only the grading professor can de-pseudonymize progress.",
    ],
    tags: ["TypeScript", "Next.js", "PostgreSQL", "Auth", "Telemetry"],
  },
];
