// Exhibit types and the evidence grades (packet section 03).
//
// Grades: A primary/object, B strong reconstruction, C later account or oral
// history, D disputed or insufficient, X modern reconstruction built here.

export type Grade = "A" | "B" | "C" | "D" | "X";

export const GRADES: Record<Grade, { badge: string; meaning: string }> = {
  A: { badge: "DOCUMENTED", meaning: "A surviving object, regulation, contemporary text, archive document or direct testimony." },
  B: { badge: "STRONG RECONSTRUCTION", meaning: "Supported by archival scholarship or several reliable sources." },
  C: { badge: "LATER ACCOUNT", meaning: "A later account or oral history: valuable, harder to check independently." },
  D: { badge: "DISPUTED", meaning: "A claim exists, but historians disagree or the documentation is weak." },
  X: { badge: "MODERN RECONSTRUCTION", meaning: "A system built here, today, from a historical principle." },
};

export interface Claim {
  text: string;
  grade: Grade;
  /** Source ids from src/content/sources.json. */
  sources: string[];
  /** "Why this label?": the reasoning behind the grade. */
  why: string;
  /** Required when there is no source: what is missing and what would settle it. */
  sourceNote?: string;
}

export interface Exhibit {
  slug: string;
  archive: string;
  title: string;
  place: string;
  period: string;
  lede: string;
  claims: Claim[];
  know: string[];
  unknown: string[];
  experiment?: { text: string; href: string };
  status: "draft" | "published";
  /** Explicit opt-in for public draft testing. */
  visibility?: "public";
}
