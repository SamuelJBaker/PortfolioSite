export type Profile = {
  name: string;
  /** Hero eyebrow. */
  tagline: string;
  /** Hero paragraphs; the first renders as the lead. */
  bio: string[];
  email: string;
  github: string;
  linkedin: string;
  siteUrl: string;
  resumePath: string;
};

export const profile: Profile = {
  name: "Samuel J. Baker IV",
  tagline: "Computer Science (AI) at UVA",
  bio: [
    "I am a Computer Science student at the University of Virginia on the AI track, graduating in December 2026, focused on building production-minded ML systems with measurable performance. My work spans computer vision and applied ML, from data pipelines and model training to evaluation and inference optimization. In parallel, I do performance engineering in C++: profiling hot paths, improving memory layout, and building tooling that keeps systems fast as they scale. At Scaffold Education, I build the platform and infrastructure behind a production LMS used daily by 90+ students.",
    "Outside of code, I care about game design, weightlifting, film, music (guitar), and reading. If you want a quick snapshot of what I am doing other than projects, scroll to the Now section.",
  ],
  email: "samuel.j.baker908@gmail.com",
  github: "https://github.com/samueljbaker",
  linkedin: "https://www.linkedin.com/in/samuel-j-baker-iv/",
  siteUrl: "https://samueljbaker.dev",
  resumePath: "/Samuel_Baker_Resume.pdf",
};

/** mailto link with the subject "Portfolio <en dash> {name}". */
export const mailtoHref = `mailto:${profile.email}?subject=${encodeURIComponent(
  `Portfolio \u2013 ${profile.name}`
)}`;
