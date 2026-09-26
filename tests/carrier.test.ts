import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { decodeFrame, encodeFrame } from "../src/engine/errorcontrol";
import { layout, readGrid, transform } from "../src/engine/grid";
import { FLAT, ROUND, toChart, translate } from "../src/engine/construction";
import { longFloats, purlRelief, read, render, twoColour, type Carrier } from "../src/engine/carrier";

const CARRIERS: Carrier[] = [purlRelief(), twoColour({ A: "cream", B: "red" })];

describe("carriers", () => {
  it("map 0 and 1 to visible states", () => {
    expect(render([[0, 1]], purlRelief())).toEqual([["knit", "purl"]]);
    expect(render([[0, 1]], twoColour())).toEqual([["A", "B"]]);
  });

  it("carry a legend for both states", () => {
    for (const c of CARRIERS) expect(c.legend.map((l) => [l.bit, l.visible])).toEqual([[0, c.states[0]], [1, c.states[1]]]);
    expect(twoColour({ A: "cream", B: "red" }).legend[1]!.label).toBe("Colour B (red)");
  });

  it("round-trip: read undoes render", () => {
    const cells: Bit[][] = [[0, 1, 1], [1, 0, 0]];
    for (const c of CARRIERS) expect(read(render(cells, c), c)).toEqual({ cells, issues: [] });
  });

  it("report a state the carrier does not use", () => {
    const r = read([["knit", "A"]], purlRelief());
    expect(r.cells).toEqual([[0, 0]]);
    expect(r.issues).toEqual([{ row: 1, col: 2, message: 'Row 1, stitch 2: "A" is not part of the Purl relief carrier; read as 0.' }]);
  });

  // The T07 acceptance: one grid, both carriers, nothing above the carrier changes.
  for (const construction of [FLAT, ROUND])
    it(`same grid through both carriers, knitted ${construction.method}, decodes to the message`, () => {
      const text = "MEET AT NOON.";
      const grid = layout(encodeFrame(text), { width: 9, border: true });
      for (const carrier of CARRIERS) {
        const rows = translate(render(grid.cells, carrier), construction);
        const back = read(toChart(rows), carrier);
        expect(back.issues).toEqual([]);
        const r = readGrid(back.cells, true);
        expect(decodeFrame(r.bits).text).toBe(text);
      }
    });

  it("purl relief seen from the wrong side still decodes (inverted and mirrored)", () => {
    const text = "HI";
    const grid = layout(encodeFrame(text), { width: 7, border: false });
    const wrongSide = transform(grid.cells, { rotated180: false, mirrored: true, inverted: true });
    const r = readGrid(read(render(wrongSide, purlRelief()), purlRelief()).cells, false);
    expect(decodeFrame(r.bits).text).toBe(text);
  });

  it("flags long floats in two-colour rows", () => {
    const chart = render([[0, 0, 0, 0, 0, 0, 0, 1], [1, 1, 1, 1, 1, 1, 1, 1]], twoColour());
    expect(longFloats(chart)).toEqual([{ row: 1, from: 1, length: 7, colour: "B" }]);
    expect(longFloats(chart, 7)).toEqual([]);
  });
});
