import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";
import { transform } from "../src/engine/grid";
import { FLAT } from "../src/engine/construction";
import { createProject, type EncodingSettings, type ProjectSettings } from "../src/engine/project";
import { decodeCells, describeCells, describeStream } from "../src/engine/steps";

const settings = (encoding: EncodingSettings, message = "Meet at noon."): ProjectSettings => ({
  title: "t",
  message,
  encoding,
  layout: { width: 11, border: true },
  carrier: { id: "purl-relief" },
  construction: FLAT,
});
const FIVE: EncodingSettings = { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS };

describe("decode steps", () => {
  for (const [enc, text] of [
    [FIVE, "MEET AT NOON."],
    [{ alphabet: "morse" }, "MEET AT NOON."],
    [{ alphabet: "bacon", variant: "modern26" }, "MEETATNOON"],
  ] as [EncodingSettings, string][])
    it(`${enc.alphabet}: grid reads back with every step`, () => {
      const grid = createProject(settings(enc), "x").output.logicalGrid;
      const s = decodeCells(grid, true, enc);
      expect([s.text, s.ok, s.orientationText]).toEqual([text, true, "upright"]);
      expect(s.symbols.length).toBeGreaterThan(0);
    });

  it("five-bit symbols follow the frame: START, characters, END, checksum", () => {
    const bits = createProject(settings(FIVE, "HI"), "x").output.bits;
    const steps = describeStream(bits, FIVE);
    expect(steps.map((s) => [s.label, s.out])).toEqual([["START", "START"], ["1", "H"], ["2", "I"], ["END", "END"], ["sum", expect.any(String)], ["sum", expect.any(String)]]);
    expect(steps[1]!.cells).toBe("001111|1") // H = 00111, parity 1, separator 1;
  });

  it("points a parity error at the right cells in a turned grid", () => {
    const grid = createProject(settings(FIVE), "x").output.logicalGrid;
    const turned = transform(grid, { rotated180: true, mirrored: false, inverted: false });
    // Flip a cell in the displayed grid, inside some data block.
    const [r, c] = [5, 4];
    turned[r]![c] = (1 - turned[r]![c]!) as Bit;
    const s = decodeCells(turned, true, FIVE);
    expect(s.orientationText).toBe("upside down");
    const err = s.findings.find((f) => f.severity === "error" && /Possible error near character/.test(f.message))!;
    expect(err.cells).toContainEqual([r, c]);
    expect(err.message).toMatch(/^Possible error near character \d+ \(row \d+, stitch(es)? [\d, to]+(; row \d+, stitch(es)? [\d, to]+)*\)\.$/);
    expect(err.message).not.toMatch(/cells? \d/);
  });

  it("names cells by row and stitch, stitch 1 on the right", () => {
    expect(describeCells([[5, 10], [5, 9], [5, 8], [5, 3]], 12)).toBe("row 6, stitches 2 to 4, 9");
    expect(describeCells([[0, 11], [2, 0]], 12)).toBe("row 1, stitch 1; row 3, stitch 12");
  });

  it("Bacon notes its alphabet and the shared letters", () => {
    const enc: EncodingSettings = { alphabet: "bacon", variant: "historical24" };
    const s = decodeCells(createProject(settings(enc, "Juvenal"), "x").output.logicalGrid, true, enc);
    expect(s.text).toBe("IUUENAL");
    expect(s.symbols[0]!.out).toBe("I/J");
    expect(s.findings.map((f) => f.message)).toContain("Could be either letter at 1 (I/J), 2 (U/V), 3 (U/V).");
  });

  it("Morse symbols show each letter's code", () => {
    const enc: EncodingSettings = { alphabet: "morse" };
    const bits = createProject(settings(enc, "SOS HI"), "x").output.bits;
    expect(describeStream(bits, enc).map((s) => `${s.cells}=${s.out}`)).toEqual(["...=S", "---=O", "...=S", "/=space", "....=H", "..=I"]);
  });
});

describe("structure errors", () => {
  it("point at the marker cell that is wrong, in the grid as given", () => {
    const grid = createProject(settings(FIVE, "HI"), "x").output.logicalGrid;
    const turned = transform(grid, { rotated180: true, mirrored: false, inverted: false });
    // The upright marker row is row 1 (row 0 is the border); upside down it is second from the top.
    const [r, c] = [turned.length - 2, 5];
    turned[r]![c] = (1 - turned[r]![c]!) as Bit;
    const s = decodeCells(turned, true, FIVE);
    const f = s.findings.find((x) => /marker, top and border cells do not match/.test(x.message))!;
    expect(f.cells).toEqual([[r, c]]);
    expect(f.message).toMatch(new RegExp(`\\(row ${r + 1}, stitch ${turned[0]!.length - c}\\)\\.?$`));
    expect(s.text).toBe("HI");
  });
});
