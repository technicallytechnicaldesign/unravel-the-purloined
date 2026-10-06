import { type Exhibit } from "./types";
import { sourceById } from "./sources";
/** Even explicitly public drafts need checked, cited claims. */
export function publicExhibit(e: Exhibit): boolean {
  const checked = e.claims.every((c) => c.sources.length > 0 && c.sources.every((id) => sourceById(id)?.status === "checked"));
  return checked && (e.status === "published" || e.visibility === "public");
}
export const visibleExhibit = (e: Exhibit, drafts: boolean): boolean => drafts || publicExhibit(e);
