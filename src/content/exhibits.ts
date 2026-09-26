// Archive exhibits (packet sections 03 to 17, 35). The exhibits themselves are
// Markdown files in content/exhibits/ (format in content/README.md); this module
// loads them at build time and re-exports the types from ./types.
// A page stays a draft until every source it cites is checked (enforced in
// tests/content.test.ts). Files starting with "_" are templates and skipped.

export { GRADES, type Claim, type Exhibit, type Grade } from "./types";
import { type Exhibit } from "./types";
import { parseExhibit } from "./markdown";

const files = import.meta.glob("../../content/exhibits/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** Every exhibit, sorted by archive number. */
export const EXHIBITS: Exhibit[] = Object.entries(files)
  .filter(([path]) => !path.split("/").pop()!.startsWith("_"))
  .map(([path, md]) => parseExhibit(md, path.replace("../../", "")))
  .sort((a, b) => a.archive.localeCompare(b.archive, "en", { numeric: true }));
