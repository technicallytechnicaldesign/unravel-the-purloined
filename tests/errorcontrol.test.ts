import { describe, expect, it } from "vitest";
import { type Bit, START } from "../src/engine/fivebit";
import {
  blockLength,
  checksum,
  decodeFrame,
  decodeWord,
  encodeFrame,
  encodeWord,
  type ErrorControlOptions,
  type SymbolCode,
} from "../src/engine/errorcontrol";

const CODES: SymbolCode[] = ["plain", "parity", "hamming"];
const ALL_OPTIONS: ErrorControlOptions[] = CODES.flatMap((code) =>
  [false, true].flatMap((separator) => [false, true].map((checksum) => ({ code, separator, checksum }))),
);
const label = (o: ErrorControlOptions) => `${o.code}${o.separator ? " +sep" : ""}${o.checksum ? " +sum" : ""}`;
const MESSAGES = ["", "A", "L", "MEET AT NOON.", "WHERE IS THE LETTER?", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

const flip = (bits: readonly Bit[], i: number): Bit[] => bits.map((b, j) => (j === i ? ((1 - b) as Bit) : b));

/** Which part of the message cell i was written for: "start", a 1-based character number, "end" or "checksum". */
function owner(i: number, text: string, o: ErrorControlOptions): "start" | "end" | "checksum" | number {
  const block = Math.floor(i / blockLength(o));
  if (block === 0) return "start";
  if (block <= text.length) return block;
  return block === text.length + 1 ? "end" : "checksum";
}

describe("symbol codes", () => {
  it("round-trips every value through every code", () => {
    for (const code of CODES)
      for (let v = 0; v < 32; v++) expect(decodeWord(encodeWord(v, code), code)).toEqual({ value: v, ok: true });
  });

  it("Hamming(9,5) repairs any single flipped cell", () => {
    for (let v = 0; v < 32; v++)
      for (let i = 0; i < 9; i++)
        expect(decodeWord(flip(encodeWord(v, "hamming"), i), "hamming")).toEqual({ value: v, ok: true, corrected: i });
  });

  it("checksum notices swapped symbols", () => {
    expect(checksum([1, 2])).not.toEqual(checksum([2, 1]));
  });
});

describe("framed round trips", () => {
  for (const o of ALL_OPTIONS)
    it(label(o), () => {
      for (const m of MESSAGES) {
        const bits = encodeFrame(m, o);
        expect(bits).toHaveLength((m.length + 2 + (o.checksum ? 2 : 0)) * blockLength(o));
        expect(decodeFrame(bits, o)).toEqual({ text: m, ok: true, issues: [], offset: 0 });
      }
    });

  it("refuses framing controls inside the message", () => {
    expect(() => encodeFrame("A" + START)).toThrow(/framing controls/);
  });
});

describe("single flipped cells are located", () => {
  const text = "WHERE IS THE LETTER?";

  for (const code of ["parity", "hamming"] as const)
    for (const separator of [false, true])
      it(`${code}${separator ? " +sep" : ""}: first issue names the right place for every cell`, () => {
        const o = { code, separator, checksum: true };
        const bits = encodeFrame(text, o);
        for (let i = 0; i < bits.length; i++) {
          const r = decodeFrame(flip(bits, i), o);
          const first = r.issues[0]!;
          const who = owner(i, text, o);
          if (typeof who === "number") expect([i, first.character]).toEqual([i, who]);
          else expect([i, first.region]).toEqual([i, who]);
          expect(first.message).not.toBe("");
          if (code === "hamming") expect(r.text).toBe(text);
        }
      });

  it("says 'possible error near character 14'", () => {
    const o = { code: "parity", separator: true, checksum: true } as const;
    const bits = encodeFrame(text, o);
    const r = decodeFrame(flip(bits, 14 * blockLength(o) + 2), o);
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.message).toMatch(/^Possible error near character 14 /);
    expect(r.issues.at(-1)!.kind).toBe("checksum");
  });

  it("Hamming names the exact cell and still counts as ok", () => {
    const o = { code: "hamming", separator: false, checksum: false } as const;
    const bits = encodeFrame(text, o);
    const r = decodeFrame(flip(bits, 82), o);
    expect(r.ok).toBe(true);
    expect(r.issues).toEqual([
      { kind: "corrected", region: "data", character: 9, cell: 82, message: "Error at cell 83, in character 9: repaired." },
    ]);
  });

  it("checksum alone detects what it cannot locate", () => {
    const o = { code: "plain", separator: false, checksum: true } as const;
    const r = decodeFrame(flip(encodeFrame(text, o), 12), o);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.kind)).toEqual(["checksum"]);
    expect(r.issues[0]!.message).toMatch(/did not find where/);
  });
});

describe("framing and slips", () => {
  const text = "MEET AT NOON.";

  for (const o of ALL_OPTIONS)
    it(`${label(o)}: survives a missing leading cell and an extra one`, () => {
      for (const m of MESSAGES) {
        const bits = encodeFrame(m, o);
        const missing = decodeFrame(bits.slice(1), o);
        expect([m, missing.text, missing.offset]).toEqual([m, m, -1]);
        expect(missing.issues).toEqual([expect.objectContaining({ kind: "framing", message: expect.stringMatching(/^1 leading cell missing/) })]);

        for (const cell of [0, 1] as Bit[]) {
          const extra = decodeFrame([cell, ...bits], o);
          expect([m, extra.text, extra.offset]).toEqual([m, m, 1]);
          expect(extra.issues.map((i) => i.kind)).toEqual(["framing"]);
        }
      }
    });

  for (const code of CODES)
    for (const change of ["dropped", "added"] as const)
      it(`${code} +sep: a cell ${change} anywhere in the message is placed in a range and reading resyncs`, () => {
        const o = { code, separator: true, checksum: true };
        const B = blockLength(o);
        for (const text of ["MEET AT NOON.", "WHERE IS THE LETTER?", "AAAAAAAA", "ZZZ"]) {
          const bits = encodeFrame(text, o);
          for (let i = B; i < (text.length + 1) * B; i++) {
            const damaged = change === "dropped" ? [...bits.slice(0, i), ...bits.slice(i + 1)] : [...bits.slice(0, i), 1 as Bit, ...bits.slice(i)];
            const r = decodeFrame(damaged, o);
            const ch = Math.floor(i / B);
            const slip = r.issues.find((x) => x.kind === "slip")!;
            const [lo, hi] = [slip.character!, slip.through ?? slip.character!];
            expect([i, r.offset, lo <= ch && ch <= hi]).toEqual([i, 0, true]);
            expect(slip.message).toMatch(change === "dropped" ? /missing/ : /added/);
            // Everything outside the reported range still reads correctly.
            expect(r.text.slice(0, lo - 1) + r.text.slice(hi)).toBe(text.slice(0, lo - 1) + text.slice(hi));
          }
        }
      });

  it("reports a symbol with no meaning instead of dropping it", () => {
    const o = { code: "plain", separator: false, checksum: false } as const;
    const bits = encodeFrame("AB", o);
    bits.splice(5, 5, 1, 1, 1, 1, 1);
    const r = decodeFrame(bits, o);
    expect(r.text).toBe("�B");
    expect(r.issues).toEqual([expect.objectContaining({ kind: "invalid-symbol", character: 1 })]);
  });

  it("reports leftover cells", () => {
    const o = { code: "parity", separator: true, checksum: true } as const;
    const r = decodeFrame([...encodeFrame(text, o), 0, 0, 0], o);
    expect(r.text).toBe(text);
    expect(r.issues.map((i) => i.kind)).toEqual(["trailing"]);
  });
});
