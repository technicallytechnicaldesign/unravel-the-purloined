import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { createProject, type ProjectSettings } from "../src/engine/project";
import { readStripes, ROWS_PER_UNIT, stripeRows } from "../src/engine/stripes";
import { CHARSET, layoutGlyphs, PACKS, readGlyphs, type GlyphPack } from "../src/engine/glyphs";
import { transform } from "../src/engine/grid";
import { FLAT, ROUND } from "../src/engine/construction";
import { keyCode, parseKeyCode } from "../src/engine/key";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";
import { chartSvg, keyFor } from "../src/engine/chartsvg";

const base = (extra: Partial<ProjectSettings>): ProjectSettings => ({
  title: "t",
  message: "Meet at noon.",
  encoding: { alphabet: "morse" },
  layout: { width: 20, border: false },
  carrier: { id: "stripes" },
  construction: FLAT,
  ...extra,
});
const turns = [false, true].flatMap((rotated180) => [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))));

describe("stripe-interval code", () => {
  it("turns Morse units into stripes and back", () => {
    const units: Bit[] = [1, 0, 1, 1, 1, 0, 0, 0, 1];
    const rows = stripeRows(units).map((b) => new Array<Bit>(6).fill(b));
    expect(rows.length).toBe(units.length * ROWS_PER_UNIT + 8);
    expect(readStripes(rows).units.join("")).toMatch(/^0+101110001 ?0*$/.test("") ? /x/ : /1011100010*/);
  });

  it("reads a stripe one row too deep, and says so", () => {
    const rows: Bit[][] = [[1], [1], [1], [0], [0]];
    const r = readStripes(rows);
    expect(r.notes[0]!.message).toBe("The stripe starting at row 1 is 3 rows deep, not a multiple of 2; read as 2 units.");
  });

  for (const construction of [FLAT, ROUND])
    it(`knits and decodes, ${construction.method}, with a cipher`, () => {
      const p = createProject(base({ construction, cipher: { kind: "caesar", key: "3" } }), "s");
      expect(p.output.decoded).toBe("MEET AT NOON.");
      expect(p.output.chart.every((row) => row.every((v) => v === row[0]))).toBe(true); // every row one colour
      expect(p.output.checks).toEqual([]); // so no floats to catch
    });

  it("refuses what it cannot carry", () => {
    expect(() => createProject(base({ encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS } }), "s")).toThrow(/carries Morse/);
    expect(() => createProject(base({ hide: { mode: "motif", motif: "window" } }), "s")).toThrow(/cannot also be hidden/);
  });
});

describe("motif alphabet", () => {
  for (const pack of Object.keys(PACKS) as GlyphPack[]) {
    it(`${pack}: every character has a glyph, and any two differ by at least ${pack === "pixel5" ? 1 : 2} stitches`, () => {
      const g = PACKS[pack].glyphs;
      expect(Object.keys(g).sort()).toEqual([...CHARSET].sort());
      const list = Object.values(g);
      let min = Infinity;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) min = Math.min(min, list[i]!.flat().filter((b, k) => b !== list[j]!.flat()[k]).length);
      expect(min).toBeGreaterThanOrEqual(pack === "pixel5" ? 1 : 2);
    });

    it(`${pack}: lays text out and reads it back from every turn`, () => {
      const text = "WAIT BY THE BRIDGE AT 6?";
      const { cells } = layoutGlyphs(text, pack, 24);
      for (const o of turns) expect([o, readGlyphs(transform(cells, o), pack).text]).toEqual([o, text]);
    });
  }

  it("geometric symbols report one slipped stitch", () => {
    const { cells } = layoutGlyphs("HELLO", "geometric3", 20);
    cells[cells.length - 2]![1] = (1 - cells[cells.length - 2]![1]!) as Bit;
    const r = readGlyphs(cells, "geometric3");
    expect(r.text.slice(1)).toBe("ELLO");
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]!.message).toMatch(/^Character 1 is 1 stitch off .*"H"/);
  });

  for (const carrier of ["purl-relief", "two-colour", "cable"] as const)
    it(`knits letters in ${carrier}, and decodes back`, () => {
      const p = createProject(base({ carrier: { id: carrier }, glyphs: { pack: "pixel5" }, layout: { width: 17, border: true, borderWidth: 2 } }), "g");
      expect(p.output.decoded).toBe("MEET AT NOON.");
    });

  it("refuses to hide letters that are shown openly", () => {
    expect(() => createProject(base({ carrier: { id: "purl-relief" }, glyphs: { pack: "pixel5" }, hide: { mode: "motif", motif: "window" } }), "g")).toThrow(/shows its letters openly/);
  });
});

describe("parcel keys with the new carriers", () => {
  it("keep the carrier through the typed code", () => {
    for (const id of ["cable", "lace", "bobble", "bead"] as const) {
      const p = createProject(base({ encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }, carrier: { id }, hide: { mode: "scatter", seed: 4, filler: "texture", density: 2 } }), "k");
      expect((parseKeyCode(keyCode(p.output.key!)) as { carrier: string }).carrier).toBe(id);
    }
  });
});

describe("chart symbols for special stitches", () => {
  it("draws one cable across four cells and keys every symbol used", () => {
    const p = createProject(base({ carrier: { id: "cable" } }), "c");
    const svg = chartSvg({ title: "t", chart: p.output.chart, rows: p.output.rows, method: "flat", legend: p.output.legend });
    expect(svg).toContain(`width="${4 * 16}"`);
    expect(svg).toContain("purl on the right side");
  });

  it("adds the yarn over to a lace key", () => {
    const p = createProject(base({ carrier: { id: "lace" } }), "l");
    expect(keyFor(p.output.chart, p.output.legend).map((l) => l.visible)).toContain("yo");
    expect(p.output.abbreviations.some((a) => a.startsWith("yo:"))).toBe(true);
  });
});
