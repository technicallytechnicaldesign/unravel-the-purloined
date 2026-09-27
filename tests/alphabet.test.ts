import { describe, expect, it } from "vitest";
import { createProject, exportProject, importProject, type ProjectSettings } from "../src/engine/project";
import { alphabetCode, checkAlphabet, emptyAlphabet, exportAlphabet, importAlphabet, legendSvg, parseAlphabetCode, suggestSymbols, toPack, type Alphabet } from "../src/engine/alphabet";
import { layoutGlyphs, readGlyphs } from "../src/engine/glyphs";
import { transform, type Orientation } from "../src/engine/grid";

const turns: Orientation[] = [false, true].flatMap((rotated180) => [false, true].flatMap((mirrored) => [false, true].map((inverted) => ({ rotated180, mirrored, inverted }))));
const ABC = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ.?"];

/** A small hand-drawn alphabet with no problems. */
const clean = (): Alphabet => ({
  ...emptyAlphabet("Test marks", 3, 3),
  symbols: { " ": ["...", "...", "..."], A: ["x.x", ".x.", "x.x"], B: [".x.", "xxx", ".x."], C: ["xx.", "x..", "..."] },
});

describe("alphabet check", () => {
  it("passes a clean alphabet and says what a slip does", () => {
    const c = checkAlphabet(clean());
    expect(c.usable).toBe(true);
    expect(c.findings.filter((f) => f.severity !== "note")).toEqual([]);
    expect(c.minDistance).toBe(3);
    expect(c.slip).toMatch(/repaired/);
    expect(checkAlphabet(emptyAlphabet("New", 4, 4)).slip).toMatch(/Nothing to compare/);
  });

  it("reports each kind of problem", () => {
    const a = clean();
    const kinds = (x: Alphabet) => checkAlphabet(x).findings.map((f) => `${f.kind}:${f.severity}:${f.chars.join("")}`);
    expect(kinds({ ...a, symbols: { ...a.symbols, D: ["x.x", ".x.", "x.x"] } })).toContain("duplicate:problem:AD");
    expect(kinds({ ...a, symbols: { ...a.symbols, D: ["x.x", ".x.", "x.."] } })).toContain("close:warning:AD");
    expect(kinds({ ...a, symbols: { ...a.symbols, D: ["...", "...", "..."] } })).toContain("blank:problem:D");
    expect(kinds({ ...a, symbols: { ...a.symbols, D: ["x..", "..."] } })).toContain("size:problem:D");
    expect(kinds({ ...a, symbols: { ...a.symbols, d: ["x..", "...", "..x"] } })).toContain("character:problem:d");
    expect(kinds({ ...a, symbols: { ...a.symbols, D: ["...", ".x.", "..."] } })).toContain("faint:warning:D");
    expect(kinds({ ...a, symbols: { ...a.symbols, " ": ["x..", "...", "..."] } })).toContain("blank:problem: ");
    // C upside down is D.
    expect(kinds({ ...a, symbols: { ...a.symbols, D: ["...", "..x", ".xx"] } })).toContain("turned:note:CD");
    expect(kinds({ ...a, width: 7 })).toContain("size:problem:");
    expect(() => toPack({ ...a, symbols: { ...a.symbols, D: a.symbols.A! } })).toThrow(/drawn the same/);
  });
});

describe("suggested symbols", () => {
  for (const [w, h, min] of [[4, 4, 3], [5, 5, 5], [3, 5, 3]] as const)
    it(`fill a ${w} × ${h} alphabet at least ${min} stitches apart, turned or not, and read back`, () => {
      const a = suggestSymbols(emptyAlphabet("Mine", w, h), ABC);
      const c = checkAlphabet(a);
      expect(c.usable).toBe(true);
      expect(Object.keys(a.symbols)).toHaveLength(ABC.length + 1);
      expect(c.minDistance).toBeGreaterThanOrEqual(min);
      expect(c.turnDistance).toBeGreaterThanOrEqual(min);
      const text = "WAIT BY THE GATE.";
      const { cells } = layoutGlyphs(text, toPack(a), 30);
      for (const o of turns) expect([o, readGlyphs(transform(cells, o), toPack(a)).text]).toEqual([o, text]);
    });

  it("keep what is already drawn and repeat for the same seed", () => {
    const a = suggestSymbols(clean(), ["D", "E"], 7);
    expect(a.symbols.A).toEqual(clean().symbols.A);
    expect(suggestSymbols(clean(), ["D", "E"], 7)).toEqual(a);
    expect(checkAlphabet(a).usable).toBe(true);
  });
});

describe("alphabet files", () => {
  it("export and import give the same alphabet", () => {
    const a = suggestSymbols(emptyAlphabet("Signal book", 4, 4), ABC);
    expect(importAlphabet(exportAlphabet(a))).toEqual(a);
  });

  it("refuse broken files with the reason", () => {
    expect(importAlphabet("{")).toMatch(/not valid JSON/);
    expect(importAlphabet(JSON.stringify({ format: "x" }))).toMatch(/format/);
    expect(importAlphabet(JSON.stringify({ ...clean(), version: 9 }))).toMatch(/version 9/);
    expect(importAlphabet(JSON.stringify({ ...clean(), symbols: { A: "x.x" } }))).toMatch(/list of rows/);
  });

  it("draw a legend with every character, escaped", () => {
    const svg = legendSvg({ ...clean(), name: "Marks & <signs>", symbols: { ...clean().symbols, "<": ["xxx", "x..", "xxx"] } });
    expect(svg).toContain("Marks &amp; &lt;signs&gt;");
    expect(svg).toContain(">space<");
    expect(svg).toContain(">&lt;<");
    expect(svg).toMatch(/not traditional/);
  });
});

describe("custom alphabet in a project", () => {
  const mine = suggestSymbols(emptyAlphabet("Garden marks", 4, 4), [..."ABCDEFGHIJKLMNOPRSTUVWY."]);
  const settings = (over: Partial<ProjectSettings> = {}): ProjectSettings => ({
    title: "Mine",
    message: "Meet by the gate.",
    encoding: { alphabet: "morse" },
    glyphs: { alphabet: mine },
    layout: { width: 24, border: true, borderWidth: 1 },
    carrier: { id: "purl-relief" },
    construction: { method: "flat", firstRow: "RS" },
    ...over,
  });

  for (const carrier of ["purl-relief", "two-colour", "cable", "bobble"] as const)
    it(`knits and reads back in ${carrier}, flat and in the round`, () => {
      for (const construction of [{ method: "flat", firstRow: "WS" }, { method: "round", firstRow: "RS" }] as const)
        expect(createProject(settings({ carrier: { id: carrier }, construction }), "c").output.decoded).toBe("MEET BY THE GATE.");
    });

  it("reports characters it has no symbol for", () => {
    const p = createProject(settings({ message: "Quiet, 5 o'clock" }), "c");
    expect(p.message.normalized).toBe("UIET OCLOCK");
    expect(p.message.dropped.map((d) => d.char).join("")).toBe("Q,5'");
  });

  it("refuses a cipher that makes letters it cannot draw, and a broken alphabet", () => {
    expect(() => createProject(settings({ cipher: { kind: "caesar", key: "4" } }), "c")).toThrow(/no symbol for: Q X/);
    expect(() => createProject(settings({ glyphs: { alphabet: { ...mine, symbols: { ...mine.symbols, B: mine.symbols.A! } } } }), "c")).toThrow(/cannot be used yet/);
  });

  it("travels inside the project file", () => {
    const p = createProject(settings(), "c");
    const back = importProject(exportProject(p));
    expect(back.issues).toEqual([]);
    expect(back.project?.settings.glyphs).toEqual({ alphabet: mine });
  });
});

describe("alphabet share code", () => {
  const a = suggestSymbols(emptyAlphabet("Garden marks ✿", 4, 5), [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ.?Ø"]);

  it("carries the whole alphabet and reads back, however it is typed", () => {
    const code = alphabetCode(a);
    expect(code).toMatch(/^UTPA1(-[0-9A-HJKMNP-TV-Z]{1,5})+$/);
    expect(parseAlphabetCode(code)).toEqual(a);
    expect(parseAlphabetCode(code.toLowerCase().replace(/-/g, " "))).toEqual(a);
  });

  it("catches a mistyped, dropped or foreign character", () => {
    const code = alphabetCode(a);
    const i = code.length - 12;
    const swap = code[i] === "7" ? "8" : "7";
    expect(parseAlphabetCode(code.slice(0, i) + swap + code.slice(i + 1))).toMatch(/do not match/);
    expect(parseAlphabetCode(code.slice(0, i) + code.slice(i + 1))).toMatch(/do not match|too short/);
    expect(parseAlphabetCode(code.slice(0, 12) + "U" + code.slice(13))).toMatch(/"U".*not used/);
    expect(parseAlphabetCode("HELLO")).toMatch(/starts with UTPA1/);
  });
});
