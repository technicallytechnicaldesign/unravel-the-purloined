// Typed access to the source register (src/content/sources.json).

import data from "./sources.json";

export interface Source {
  id: string;
  publisher: string;
  title: string;
  url: string;
  /** What the research packet expects this source to support. Not yet verified. */
  packetLeads: string[];
  /** unchecked: nobody has read it yet. checked: read and recorded. needs-human: needs a library, purchase or physical copy. */
  status: "unchecked" | "checked" | "needs-human";
  /** ISO date the page was read. */
  checked: string | null;
  /** What the page actually supports, recorded when checked. */
  supports: string[];
  grade: "A" | "B" | "C" | "D" | null;
  notes: string;
}

export const SOURCES = data.sources as Source[];
export const sourceById = (id: string): Source | undefined => SOURCES.find((s) => s.id === id);
