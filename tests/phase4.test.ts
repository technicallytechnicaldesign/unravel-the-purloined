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
  const MIN: Record<GlyphPack, number> = { pixel5: 1, geometric3: 2, geometric4: 3 };
  for (const pack of Object.keys(PACKS) as GlyphPack[]) {
    it(`${pack}: every character has a glyph, and any two differ by at least ${MIN[pack]} stitches`, () => {
      const g = PACKS[pack].glyphs;
      expect(Object.keys(g).sort()).toEqual([...CHARSET].sort());
      const list = Object.values(g);
      let min = Infinity;
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) min = Math.min(min, list[i]!.flat().filter((b, k) => b !== list[j]!.flat()[k]).length);
      expect(min).toBeGreaterThanOrEqual(MIN[pack]);
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

  it("4 x 4 symbols repair any single slipped stitch, from every turn", () => {
    for (const ch of CHARSET) {
      const { cells } = layoutGlyphs(ch, "geometric4", 4);
      for (let i = 0; i < 16; i++) {
        const slipped = cells.map((row) => [...row]);
        slipped[i >> 2]![i & 3] = (1 - slipped[i >> 2]![i & 3]!) as Bit;
        for (const o of turns) {
          const r = readGlyphs(transform(slipped, o), "geometric4");
          expect([ch, i, o, r.text]).toEqual([ch, i, o, ch.trimEnd()]);
          expect(r.notes).toHaveLength(1);
        }
      }
    }
  });

  it("4 x 4 symbols repair one slip in every symbol of a message", () => {
    const text = "MEET AT 9.";
    const { cells } = layoutGlyphs(text, "geometric4", 24);
    [...text].forEach((_, k) => {
      const line = Math.floor(k / 5);
      const row = cells.length - 1 - line * 5 - (k % 4);
      const col = (k % 5) * 5 + (k % 3);
      cells[row]![col] = (1 - cells[row]![col]!) as Bit;
    });
    for (const o of turns) {
      const r = readGlyphs(transform(cells, o), "geometric4");
      expect([o, r.text]).toEqual([o, text]);
      expect(r.notes).toHaveLength(text.length);
    }
  });

  for (const [carrier, pack] of [["purl-relief", "pixel5"], ["two-colour", "geometric4"], ["cable", "pixel5"], ["purl-relief", "geometric4"]] as const)
    it(`knits ${pack} letters in ${carrier}, and decodes back`, () => {
      const p = createProject(base({ carrier: { id: carrier }, glyphs: { pack }, layout: { width: 17, border: true, borderWidth: 2 } }), "g");
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

describe("photo frame in a second yarn", () => {
  for (const carrier of ["purl-relief", "bobble"] as const)
    it(`frames ${carrier} work in colour B, says how to knit it, and still decodes`, () => {
      const flat = createProject(base({ carrier: { id: carrier }, layout: { width: 12, border: true, borderWidth: 2 }, borderStyle: "frame" }), "f");
      expect(flat.output.decoded).toBe("MEET AT NOON.");
      expect(flat.output.instructions.join(" ")).toMatch(/, k\d+ in B/);
      expect(flat.output.carrierNotes.join(" ")).toMatch(/intarsia/);
      const round = createProject(base({ carrier: { id: carrier }, layout: { width: 12, border: true, borderWidth: 2 }, borderStyle: "frame", construction: { method: "round", firstRow: "RS" } }), "f");
      expect(round.output.carrierNotes.join(" ")).toMatch(/start of each round/);
    });

  it("is refused as a filler for hiding", () => {
    expect(() => createProject(base({ carrier: { id: "purl-relief" }, hide: { mode: "scatter", seed: 3, filler: "frame" as never, density: 3 } }), "f")).toThrow(/borders only/);
  });
});
