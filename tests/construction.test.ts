import { describe, expect, it } from "vitest";
import { FLAT, ROUND, toChart, translate, type Visible } from "../src/engine/construction";

const stitches = (row: { actions: { stitch: string; colour?: string }[] }) =>
  row.actions.map((a) => a.stitch + (a.colour ?? "")).join(" ");

// Row 1 at the bottom (index 0). Left to right as seen on the right side.
const CHART: Visible[][] = [
  ["knit", "knit", "purl"],
  ["knit", "knit", "purl"],
  ["purl", "knit", "knit"],
];

describe("construction translator", () => {
  it("flat: a WS row of visible purl becomes k, and visible knit becomes p", () => {
    const [, ws] = translate([["purl", "purl"], ["purl", "purl"]], FLAT);
    expect(ws!.side).toBe("WS");
    expect(stitches(ws!)).toBe("k k");
    const [, ws2] = translate([["knit"], ["knit"]], FLAT);
    expect(stitches(ws2!)).toBe("p");
  });

  it("flat: RS rows read right to left, WS rows left to right", () => {
    const rows = translate(CHART, FLAT);
    expect(rows.map((r) => [r.number, r.side, r.read, stitches(r)])).toEqual([
      [1, "RS", "right-to-left", "p k k"],
      [2, "WS", "left-to-right", "p p k"],
      [3, "RS", "right-to-left", "k k p"],
    ]);
  });

  it("flat can start on a WS row", () => {
    const rows = translate(CHART, { method: "flat", firstRow: "WS" });
    expect(rows.map((r) => r.side)).toEqual(["WS", "RS", "WS"]);
    expect(stitches(rows[0]!)).toBe("p p k");
  });

  it("round: every row is RS, read right to left, never inverted", () => {
    const rows = translate(CHART, ROUND);
    expect(rows.every((r) => r.side === "RS" && r.read === "right-to-left")).toBe(true);
    expect(rows.map(stitches)).toEqual(["p k k", "p k k", "k k p"]);
  });

  it("colour does not invert: stockinette in the chosen yarn from either side", () => {
    const rows = translate([["A", "B"], ["A", "B"]], FLAT);
    expect(rows.map(stitches)).toEqual(["kB kA", "pA pB"]);
  });

  it("toChart undoes translate for flat and round, starting either side", () => {
    const mixed: Visible[][] = [
      ["knit", "purl", "A", "B"],
      ["B", "knit", "purl", "purl"],
      ["A", "A", "knit", "purl"],
      ["purl", "B", "knit", "knit"],
    ];
    for (const c of [FLAT, ROUND, { method: "flat", firstRow: "WS" } as const]) {
      expect(toChart(translate(mixed, c))).toEqual(mixed);
    }
  });
});
