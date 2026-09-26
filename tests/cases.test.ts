import { describe, expect, it } from "vitest";
import { checkAnswer, LEVELS, makeCase } from "../src/engine/cases";
import { decodeCells } from "../src/engine/steps";
import { fabricSvg } from "../src/engine/fabric";
import { decipher } from "../src/engine/ciphers";
import { MOTIFS, reduce } from "../src/engine/motifs";

const bitsOf = (shown: string[][]) => shown.map((row) => row.map((v) => (v === "purl" || v === "B" ? 1 : 0) as 0 | 1));

describe("The Purloined Parcel: cases", () => {
  it("are the same for the same level and seed", () => {
    expect(makeCase(2, 17)).toEqual(makeCase(2, 17));
    const ids = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(makeCase(1, i + 1).shown)));
    expect(ids.size).toBeGreaterThan(4); // different seeds give different cases
  });

  for (const level of LEVELS)
    it(`level ${level.n} (${level.name}): 60 seeds all solvable from the image`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        const c = makeCase(level.n, seed);
        // Motif cases are copied one cell per tile, as the game asks.
        const copy = c.tiles ? reduce(bitsOf(c.shown), MOTIFS.window).grid : bitsOf(c.shown);
        if (c.tiles) expect([copy.length, copy[0]!.length]).toEqual([c.tiles.rows, c.tiles.cols]);
        const s = decodeCells(copy, c.tiles ? 0 : c.settings.layout.border, c.settings.encoding);
        if (level.n === 5) {
          // The knitter's mistake is flagged at one letter, and the rest reads true.
          const bad = s.findings.find((f) => /Possible error near character (\d+)/.test(f.message))!;
          expect(bad, `seed ${seed}`).toBeDefined();
          const k = Number(/character (\d+)/.exec(bad.message)![1]);
          expect(s.text.slice(0, k - 1) + s.text.slice(k)).toBe(c.answer.slice(0, k - 1) + c.answer.slice(k));
          expect(s.text).not.toBe(c.answer);
        } else if (c.settings.cipher) {
          // The stitches carry the ciphertext; deciphering gives the answer.
          expect([seed, decipher(s.text, c.settings.cipher)]).toEqual([seed, c.answer]);
          expect(s.text).not.toBe(c.answer);
        } else {
          expect([seed, s.text]).toEqual([seed, c.answer]);
        }
        expect(checkAnswer(c, c.answer.toLowerCase())).toBe(true);
      }
    });

  it("level 7 hides the message: the ordinary decoder cannot read the stitches", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const c = makeCase(7, seed);
      expect(decodeCells(bitsOf(c.shown), 0, c.settings.encoding).text).not.toBe(c.answer);
      expect(c.description).toMatch(/^The image shows little 3 by 3 squares/);
      expect(c.description).not.toContain(c.answer);
    }
  });

  it("level 2 is always turned, levels 1 and 3 to 5 never", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const o = makeCase(2, seed).orientation;
      expect(o.rotated180 || o.mirrored || o.inverted).toBe(true);
      expect(makeCase(1, seed).orientation).toEqual({ rotated180: false, mirrored: false, inverted: false });
    }
  });

  it("forgives spacing, case and Bacon's shared letters, but not a wrong answer", () => {
    const c = makeCase(4, 3);
    const withJ = c.answer.replace(/I/g, "J");
    expect(checkAnswer(c, ` ${withJ.toLowerCase()} `)).toBe(true);
    expect(checkAnswer(c, "WRONG")).toBe(false);
    expect(checkAnswer(c, "")).toBe(false);
  });

  it("describes the image in words without giving the answer", () => {
    const c = makeCase(1, 5);
    const lines = c.description.split("\n");
    expect(lines[0]).toBe(`The image shows ${c.shown.length} rows of ${c.shown[0]!.length} stitches.`);
    expect(lines).toHaveLength(c.shown.length + 1);
    expect(c.description).not.toContain(c.answer);
  });

  it("the drawing matches the case cell for cell, and is seeded", () => {
    const c = makeCase(4, 9);
    const svg = fabricSvg(c.shown, { seed: c.seed });
    const drawn = [...svg.matchAll(/data-row="(\d+)" data-col="(\d+)" data-state="(\w+)"/g)];
    expect(drawn).toHaveLength(c.shown.length * c.shown[0]!.length);
    for (const [, r, col, state] of drawn) expect(c.shown[Number(r)]![Number(col)]).toBe(state);
    expect(fabricSvg(c.shown, { seed: c.seed })).toBe(svg);
    expect(fabricSvg(c.shown, { seed: c.seed + 1 })).not.toBe(svg);
  });
});
