// Stripe-interval code (packet 27.9, Phase 4): Morse in row counts. Each
// timing unit is a band of rows, so a dot is a narrow stripe in colour B, a
// dash a wide one, and the gaps between are colour A. Every row is a single
// colour, so there are no floats: good for scarves, socks, hats and sleeves.
//
// Stripes read the same mirrored, but upside down they run backwards, so the
// message is read from the cast-on edge.

import { type Bit } from "./fivebit";

/** Rows of knitting per Morse timing unit. */
export const ROWS_PER_UNIT = 2;
/** Plain rows of colour A before and after the message. */
export const LEAD_ROWS = 4;

/** Morse units to one bit per row, bottom first, with plain lead rows at both ends. */
export function stripeRows(units: readonly Bit[]): Bit[] {
  const lead = new Array<Bit>(LEAD_ROWS).fill(0);
  return [...lead, ...units.flatMap((u) => new Array<Bit>(ROWS_PER_UNIT).fill(u)), ...lead];
}

export interface StripeNote {
  /** 1-based row where the stripe starts. */
  row: number;
  message: string;
}

/**
 * Rows back to Morse units. Each row is read by its majority colour; stripes
 * that are not a whole number of units deep are reported, then rounded.
 */
export function readStripes(rows: readonly (readonly Bit[])[]): { units: Bit[]; notes: StripeNote[] } {
  const perRow = rows.map((r) => (r.filter((b) => b === 1).length * 2 > r.length ? 1 : 0) as Bit);
  const notes: StripeNote[] = [];
  const units: Bit[] = [];
  for (let i = 0; i < perRow.length; ) {
    let n = 1;
    while (i + n < perRow.length && perRow[i + n] === perRow[i]) n++;
    const count = Math.max(1, Math.round(n / ROWS_PER_UNIT));
    if (n % ROWS_PER_UNIT !== 0 && perRow[i] === 1) {
      notes.push({ row: i + 1, message: `The stripe starting at row ${i + 1} is ${n} rows deep, not a multiple of ${ROWS_PER_UNIT}; read as ${count} unit${count === 1 ? "" : "s"}.` });
    }
    for (let k = 0; k < count; k++) units.push(perRow[i]!);
    i += n;
  }
  return { units, notes };
}
