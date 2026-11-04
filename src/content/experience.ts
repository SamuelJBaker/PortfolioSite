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

export const experience: Experience[] = [];
