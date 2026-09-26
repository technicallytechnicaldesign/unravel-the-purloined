// Written pattern (packet section 36, phase 2): rows of actions to the lines a
// knitter follows, with stitch counts checked. Runs of the same action are
// grouped: "k3, p2, k1 [6 sts]".

import { type Action, type Row } from "./construction";

const label = (a: Action) => a.stitch + (a.colour ? ` in ${a.colour}` : "");

/** One row as written instructions, e.g. "Row 2 (WS): p3, k1, p2 [6 sts]". */
export function writeRow(row: Row, method: "flat" | "round"): string {
  const parts: string[] = [];
  let i = 0;
  while (i < row.actions.length) {
    const a = row.actions[i]!;
    let n = 1;
    while (i + n < row.actions.length && label(row.actions[i + n]!) === label(a)) n++;
    parts.push(a.colour ? `${a.stitch}${n} in ${a.colour}` : `${a.stitch}${n}`);
    i += n;
  }
  const head = method === "round" ? `Round ${row.number}` : `Row ${row.number} (${row.side})`;
  return `${head}: ${parts.join(", ")} [${row.actions.length} sts]`;
}

export function writeRows(rows: readonly Row[], method: "flat" | "round"): string[] {
  return rows.map((r) => writeRow(r, method));
}

/** Every row must hold the same number of stitches. Returns one line per problem. */
export function checkStitchCounts(rows: readonly Row[], width: number): string[] {
  return rows
    .filter((r) => r.actions.length !== width)
    .map((r) => `Row ${r.number} has ${r.actions.length} stitches; expected ${width}.`);
}
