// Written pattern (packet section 36, phase 2): rows of actions to the lines a
// knitter follows, with stitch counts checked. Runs of the same action are
// grouped: "k3, p2, k1 [6 sts]".

import { isSpecial, type Action, type Row } from "./construction";

const label = (a: Action) => a.stitch + (a.colour ? ` in ${a.colour}` : "");

/** How special stitches are written; the key to them is in ABBREVIATIONS. */
const WRITTEN: Record<string, string> = { c4f: "C4F", c4b: "C4B", yo: "yo", k2tog: "k2tog", ssk: "ssk", mb: "MB", pb: "PB" };

export const ABBREVIATIONS: Record<string, string> = {
  C4F: "cable 4 front: slip 2 stitches to a cable needle and hold in front, knit 2, knit 2 from the cable needle (crosses to the left)",
  C4B: "cable 4 back: slip 2 stitches to a cable needle and hold at the back, knit 2, knit 2 from the cable needle (crosses to the right)",
  yo: "yarn over: bring the yarn forward between the needles, making an eyelet and one new stitch",
  k2tog: "knit 2 together (one stitch fewer, leans right)",
  ssk: "slip, slip, knit: slip 2 knitwise one at a time, knit them together through the back loops (one stitch fewer, leans left)",
  MB: "make a bobble in your favourite way, for example (k1, p1, k1) into the stitch, turn, p3, turn, k3, pass 2 over",
  PB: "place a bead on the stitch with a fine crochet hook, then knit it",
};

export const writtenAs = (stitch: string): string => WRITTEN[stitch] ?? stitch;

/** Stitches on the needle after a row: cables leave four, everything else one. */
export const stitchesIn = (row: Row): number => row.actions.reduce((n, a) => n + (a.span ?? 1), 0);

/** One row as written instructions, e.g. "Row 2 (WS): p3, k1, p2 [6 sts]". */
export function writeRow(row: Row, method: "flat" | "round"): string {
  const parts: string[] = [];
  let i = 0;
  while (i < row.actions.length) {
    const a = row.actions[i]!;
    if (isSpecial(a.stitch)) {
      // Special stitches are written one by one, as patterns usually do.
      parts.push(WRITTEN[a.stitch]!);
      i++;
      continue;
    }
    let n = 1;
    while (i + n < row.actions.length && label(row.actions[i + n]!) === label(a)) n++;
    parts.push(a.colour ? `${a.stitch}${n} in ${a.colour}` : `${a.stitch}${n}`);
    i += n;
  }
  const head = method === "round" ? `Round ${row.number}` : `Row ${row.number} (${row.side})`;
  return `${head}: ${parts.join(", ")} [${stitchesIn(row)} sts]`;
}

export function writeRows(rows: readonly Row[], method: "flat" | "round"): string[] {
  return rows.map((r) => writeRow(r, method));
}

/** Every row must hold the same number of stitches. Returns one line per problem. */
export function checkStitchCounts(rows: readonly Row[], width: number): string[] {
  return rows
    .filter((r) => stitchesIn(r) !== width)
    .map((r) => `Row ${r.number} has ${stitchesIn(r)} stitches; expected ${width}.`);
}
