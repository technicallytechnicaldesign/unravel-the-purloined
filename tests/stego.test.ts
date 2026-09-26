import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";
import { createProject, type ProjectSettings } from "../src/engine/project";
import { transform } from "../src/engine/grid";
import { purlRelief, read, twoColour } from "../src/engine/carrier";
import { carrying, expand, MOTIFS, reduce, type MotifId } from "../src/engine/motifs";
import { scatterRoute } from "../src/engine/stego";
import { exportKey, importKey, keyCode, parseKeyCode, describeKey, type ParcelKey } from "../src/engine/key";
import { decodeWithKey } from "../src/engine/unhide";
import { decodeCells } from "../src/engine/steps";
import { patternsFor } from "../src/engine/stitches";

const MOTIF_IDS = Object.keys(MOTIFS) as MotifId[];
const ALL_TURNS = [false, true].flatMap((rotated180) => [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))));
const flipBits = (m: Bit[][]) => m.map((r) => r.map((b) => (1 - b) as Bit));

function base(extra: Partial<ProjectSettings> = {}): ProjectSettings {
  return {
    title: "Parcel",
    message: "Meet at noon.",
    encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS },
    layout: { width: 12, border: false },
    carrier: { id: "purl-relief" },
    construction: { method: "flat", firstRow: "RS" },
    ...extra,
  };
}
const cellsOf = (p: ReturnType<typeof createProject>) => read(p.output.chart, p.settings.carrier.id === "two-colour" ? twoColour() : purlRelief()).cells;

describe("motifs (S4)", () => {
  for (const id of MOTIF_IDS)
    it(`${id}: symmetric, two versions, round trip`, () => {
      const m = MOTIFS[id];
      for (const v of [m.zero, m.one]) {
        expect(transform(v, { rotated180: true, mirrored: false, inverted: false })).toEqual(v);
        expect(transform(v, { rotated180: false, mirrored: true, inverted: false })).toEqual(v);
      }
      expect(carrying(m).length).toBeGreaterThan(0);
      const grid: Bit[][] = [[0, 1, 1], [1, 0, 0]];
      const fabric = expand(grid, m).cells;
      expect(fabric.length).toBe(2 * m.size);
      expect(reduce(fabric, m)).toEqual({ grid, notes: [], fits: true });
      expect(reduce(flipBits(fabric), m).grid).toEqual(grid); // the wrong side shows every stitch inverted
    });

  it("reports a tile a stitch off its motif, and still reads it", () => {
    const m = MOTIFS.diamond;
    const fabric = expand([[1, 0]], m).cells;
    fabric[0]![0] = (1 - fabric[0]![0]!) as Bit; // a corner stitch, not the carrying one
    const r = reduce(fabric, m);
    expect(r.grid).toEqual([[1, 0]]);
    expect(r.notes).toEqual([{ cell: [0, 0], off: 1, message: "A tile is 1 stitch off its motif; read as 1." }]);
  });
});

describe("scatter route (S2)", () => {
  it("is fixed by the seed, visits distinct cells, and refuses to overfill", () => {
    const a = scatterRoute(42, 50, 120);
    expect(a).toEqual(scatterRoute(42, 50, 120));
    expect(new Set(a).size).toBe(50);
    expect(scatterRoute(43, 50, 120)).not.toEqual(a);
    expect(() => scatterRoute(1, 10, 9)).toThrow(/needs 10 cells but the fabric has only 9/);
  });
});

describe("hidden projects", () => {
  const encodings: ProjectSettings["encoding"][] = [{ alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }, { alphabet: "morse" }, { alphabet: "bacon", variant: "modern26" }];

  for (const carrier of ["purl-relief", "two-colour"] as const)
    it(`scatter, ${carrier}: every filler, density and alphabet reads back with the key, from any turn`, () => {
      for (const filler of ["texture", ...patternsFor(carrier)] as const)
        for (const density of [2, 3, 4] as const)
          for (const encoding of encodings) {
            const p = createProject(base({ encoding, carrier: { id: carrier }, hide: { mode: "scatter", seed: 7, filler, density }, cipher: { kind: "vigenere", key: "DUPIN" } }), "s");
            expect([filler, density, encoding.alphabet, p.output.decoded]).toEqual([filler, density, encoding.alphabet, p.message.normalized]);
            expect(p.output.roles.flat().filter((r) => r === "data").length).toBe(p.output.key!.length);
            expect(p.output.key!.length).toBe(p.output.bits.length + 16); // the sync pattern rides in front
            if (filler === "texture" && density === 3) {
              for (const o of ALL_TURNS) {
                const s = decodeWithKey(transform(cellsOf(p), o), p.output.key!);
                expect([o, s.deciphered]).toEqual([o, p.message.normalized]);
              }
            }
          }
    });

  for (const id of MOTIF_IDS)
    for (const carrier of ["purl-relief", "two-colour"] as const)
      it(`motif ${id}, ${carrier}: reads back with the key from every turn, border and all`, () => {
        const p = createProject(base({ carrier: { id: carrier }, hide: { mode: "motif", motif: id }, layout: { width: 8, border: true, borderWidth: 2 }, borderStyle: carrier === "two-colour" ? "checker" : "seed" }), "m");
        expect(p.output.decoded).toBe(p.message.normalized);
        for (const o of ALL_TURNS) expect([o, decodeWithKey(transform(cellsOf(p), o), p.output.key!).text]).toEqual([o, p.message.normalized]);
      });

  it("hides: the ordinary decoder does not find the message without the key", () => {
    const scatter = createProject(base({ hide: { mode: "scatter", seed: 99, filler: "texture", density: 3 } }), "s");
    expect(decodeCells(cellsOf(scatter), 0, scatter.settings.encoding).text).not.toBe(scatter.message.normalized);
  });

  it("points at the stitch when a carrying stitch is wrong", () => {
    const p = createProject(base({ hide: { mode: "motif", motif: "window" } }), "m");
    const cells = cellsOf(p);
    const [r, c] = [3 * 3 + 1, 5 * 3 + 1]; // centre of the tile in grid row 3, column 5 (a data row)
    cells[r]![c] = (1 - cells[r]![c]!) as Bit;
    const s = decodeWithKey(cells, p.output.key!);
    const bad = s.findings.find((f) => f.severity === "error" && f.cells.some(([rr, cc]) => rr === r && cc === c));
    expect(bad).toBeDefined();
  });

  it("says when a key does not fit the fabric", () => {
    const p = createProject(base({ hide: { mode: "scatter", seed: 3, filler: "texture", density: 2 } }), "s");
    const s = decodeWithKey(cellsOf(p).slice(1), p.output.key!);
    expect(s.findings[0]!.message).toMatch(/^The key is for a field 12 by \d+ inside the border; this one is 12 by \d+\.$/);
  });
});

/** Keys come back in a standard form: cipher keys in capitals, Caesar shifts as 0 to 25. */
function canonical<T extends Partial<ParcelKey>>(k: T): T {
  if (!k.cipher) return k;
  const key = k.cipher.kind === "caesar" ? String(((Number(k.cipher.key) % 26) + 26) % 26) : k.cipher.key.toUpperCase();
  return { ...k, cipher: { ...k.cipher, key } };
}

describe("parcel key (S1, S3)", () => {
  const keys: ParcelKey[] = [
    createProject(base({ hide: { mode: "motif", motif: "window" } }), "k").output.key!,
    createProject(base({ hide: { mode: "scatter", seed: 123456, filler: "seed", density: 4 }, cipher: { kind: "route", key: "5 spiral" } }), "k").output.key!,
    createProject(base({ encoding: { alphabet: "morse" }, carrier: { id: "two-colour" }, hide: { mode: "scatter", seed: 1, filler: "checker", density: 2 }, cipher: { kind: "caesar", key: "-4" } }), "k").output.key!,
    createProject(base({ encoding: { alphabet: "bacon", variant: "historical24" }, hide: { mode: "motif", motif: "cross" }, layout: { width: 6, border: true, borderWidth: 3 } }), "k").output.key!,
  ];

  it("round-trips through the typed code", () => {
    for (const k of keys) {
      const back = parseKeyCode(keyCode(k));
      const { title: _t, ...rest } = k;
      const expected = canonical(rest);
      expect(back).toEqual(expected);
      expect(parseKeyCode(keyCode(k).toLowerCase())).toEqual(expected); // case does not matter
    }
  });

  it("catches a mistyped character", () => {
    const code = keyCode(keys[1]!);
    const i = code.indexOf("-", 8) + 2;
    const typo = code.slice(0, i) + (code[i] === "7" ? "8" : "7") + code.slice(i + 1);
    expect(parseKeyCode(typo)).toMatch(/mistyped/);
    expect(parseKeyCode("hello")).toMatch(/does not look like a parcel key code/);
  });

  it("round-trips through the key file, and refuses other files", () => {
    for (const k of keys) expect(importKey(exportKey(k))).toEqual(canonical(k));
    expect(importKey("{}")).toMatch(/not a parcel key file/);
    expect(importKey("nope")).toMatch(/not valid JSON/);
  });

  it("describes itself in words for the key card", () => {
    const lines = describeKey(keys[0]!);
    expect(lines[0]).toMatch(/^Hidden in motifs: Windows \(3 × 3, designed here\)\. Each 3 by 3 square is one cell/);
    expect(lines.at(-1)).toBe("No cipher.");
    expect(describeKey(keys[1]!).at(-1)).toBe("Then decipher: route, key 5 SPIRAL. A historical / puzzle cipher.");
  });
});
