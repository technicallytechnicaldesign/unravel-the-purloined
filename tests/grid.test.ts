import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { decodeFrame, encodeFrame } from "../src/engine/errorcontrol";
import { layout, markerRow, readGrid, transform, UPRIGHT, type Orientation } from "../src/engine/grid";

const ALL: Orientation[] = [false, true].flatMap((rotated180) =>
  [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))),
);
const MESSAGES = ["", "A", "MEET AT NOON.", "WHERE IS THE LETTER?"];

describe("logical grid layout", () => {
  it("puts the marker at the bottom, the top row of 1s, and data right to left", () => {
    const g = layout([1, 0, 0], { width: 4, border: false });
    expect(g.cells).toEqual([
      [1, 1, 0, 1], // marker
      [1, 0, 0, 1], // data 1,0,0 read right to left, then pad 1
      [1, 1, 1, 1], // top
    ]);
    expect(g.roles[1]).toEqual(["pad", "data", "data", "data"]);
  });

  it("adds a padding row when the data fills the last row exactly", () => {
    const g = layout([0, 0, 0], { width: 3, border: false });
    expect(g.cells).toEqual([markerRow(3), [0, 0, 0], [0, 0, 1], [1, 1, 1]]);
  });

  it("wraps everything in a border of 0 cells", () => {
    const g = layout([1], { width: 3, border: true });
    expect(g.cells.length).toBe(5);
    expect(g.cells[0]).toEqual([0, 0, 0, 0, 0]);
    expect(g.cells.every((row) => row[0] === 0 && row.at(-1) === 0)).toBe(true);
  });

  it("refuses widths too narrow for an asymmetric marker", () => {
    expect(() => layout([1], { width: 2, border: false })).toThrow(/at least 3/);
  });
});

describe("reading a grid back", () => {
  for (const border of [false, true])
    it(`recovers the message in all 8 orientations for widths 3 to 12${border ? ", with border" : ""}`, () => {
      for (const text of MESSAGES)
        for (let width = 3; width <= 12; width++) {
          const bits = encodeFrame(text);
          const grid = layout(bits, { width, border });
          for (const o of ALL) {
            const r = readGrid(transform(grid.cells, o), border);
            expect([text, width, o, r.orientation, r.bits]).toEqual([text, width, o, o, bits]);
            const expected = o === ALL[0] ? [] : ["orientation"];
            expect(r.issues.map((i) => i.kind)).toEqual(expected);
            expect(decodeFrame(r.bits).text).toBe(text);
          }
        }
    });

  it("says how the grid was turned", () => {
    const grid = layout(encodeFrame("HI"), { width: 7, border: false });
    const r = readGrid(transform(grid.cells, { rotated180: false, mirrored: true, inverted: true }), false);
    expect(r.issues[0]!.message).toBe("Grid was mirrored left to right, with every cell inverted (as the wrong side of knit/purl shows); read the right way round.");
  });

  it("reports a damaged marker but still reads", () => {
    const bits = encodeFrame("HI");
    const cells = layout(bits, { width: 8, border: false }).cells;
    cells[0]![0] = 0;
    const r = readGrid(cells, false);
    expect(r.orientation).toEqual(UPRIGHT);
    expect(r.bits).toEqual(bits);
    expect(r.issues).toEqual([{ kind: "marker", message: "1 of 16 marker, top and border cells do not match." }]);
  });

  it("reports missing padding and returns every data cell", () => {
    const cells: Bit[][] = [markerRow(3), [0, 0, 0], [1, 1, 1]];
    const r = readGrid(cells, false);
    expect(r.bits).toEqual([0, 0, 0]);
    expect(r.issues.map((i) => i.kind)).toEqual(["padding"]);
  });

  it("reports a malformed grid", () => {
    expect(readGrid([[1, 1]], false).issues.map((i) => i.kind)).toEqual(["shape"]);
  });
});
