import { describe, expect, it } from "vitest";
import { FLAT, ROUND, translate, type Row } from "../src/engine/construction";
import { checkStitchCounts, writeRow, writeRows } from "../src/engine/pattern";
import { chartSvg } from "../src/engine/chartsvg";
import { purlRelief, render } from "../src/engine/carrier";

describe("written instructions", () => {
  it("groups runs and counts stitches, flat", () => {
    const rows = translate(
      [
        ["knit", "knit", "purl", "purl", "purl", "knit"],
        ["knit", "knit", "purl", "purl", "purl", "knit"],
      ],
      FLAT,
    );
    expect(writeRows(rows, "flat")).toEqual(["Row 1 (RS): k1, p3, k2 [6 sts]", "Row 2 (WS): p2, k3, p1 [6 sts]"]);
  });

  it("names rounds and yarns", () => {
    const rows = translate([["A", "A", "B"]], ROUND);
    expect(writeRow(rows[0]!, "round")).toBe("Round 1: k1 in B, k2 in A [3 sts]");
  });

  it("flags rows with the wrong stitch count", () => {
    const rows: Row[] = [
      { number: 1, side: "RS", read: "right-to-left", actions: [{ stitch: "k" }, { stitch: "k" }] },
      { number: 2, side: "WS", read: "left-to-right", actions: [{ stitch: "p" }] },
    ];
    expect(checkStitchCounts(rows, 2)).toEqual(["Row 2 has 1 stitches; expected 2."]);
  });
});

describe("SVG chart", () => {
  const chart = render(
    [
      [0, 1, 0],
      [1, 1, 0],
    ],
    purlRelief(),
  );

  it("draws one cell per stitch, purl dots, legend and an escaped title", () => {
    const svg = chartSvg({ title: "Swatch <1> & more", chart, rows: translate(chart, FLAT), method: "flat", legend: purlRelief().legend });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain("<title>Swatch &lt;1&gt; &amp; more</title>");
    expect(svg.match(/<circle /g)).toHaveLength(3 + 1); // three purl cells, one legend purl
    expect(svg.match(/<rect [^>]*width="16"[^>]*fill="#f9f6ee"/g)).toHaveLength(6 + 2);
    expect(svg).toContain("Purl on the right side (bump)");
  });

  it("numbers flat WS rows on the left and round rows on the right", () => {
    const flat = chartSvg({ title: "t", chart, rows: translate(chart, FLAT), method: "flat", legend: [] });
    const round = chartSvg({ title: "t", chart, rows: translate(chart, ROUND), method: "round", legend: [] });
    expect(flat).toMatch(/text-anchor="end"[^>]*>2</);
    expect(round).not.toMatch(/text-anchor="end"/);
  });
});
