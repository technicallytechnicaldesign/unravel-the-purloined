import { describe, expect, it } from "vitest";
import { createProject, exportProject, importProject, type ProjectSettings } from "../src/engine/project";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";
import { FLAT, ROUND } from "../src/engine/construction";

const base: ProjectSettings = {
  title: "Test swatch",
  message: "Meet at noon.",
  encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS },
  layout: { width: 9, border: true },
  carrier: { id: "purl-relief" },
  construction: FLAT,
};

const ENCODINGS: [ProjectSettings["encoding"], string][] = [
  [{ alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }, "MEET AT NOON."],
  [{ alphabet: "fivebit", errorControl: { code: "hamming", separator: false, checksum: true } }, "MEET AT NOON."],
  [{ alphabet: "morse" }, "MEET AT NOON."],
  [{ alphabet: "bacon", variant: "historical24" }, "MEETATNOON"],
  [{ alphabet: "bacon", variant: "modern26" }, "MEETATNOON"],
];

describe("project", () => {
  for (const [encoding, expected] of ENCODINGS)
    for (const carrier of [{ id: "purl-relief" }, { id: "two-colour", colours: { A: "cream", B: "red" } }] as const)
      for (const construction of [FLAT, ROUND])
        it(`${encoding.alphabet}${"variant" in encoding ? " " + encoding.variant : ""}, ${carrier.id}, ${construction.method}: pattern decodes back`, () => {
          const p = createProject({ ...base, encoding, carrier, construction }, "test-id");
          expect(p.output.decoded).toBe(expected);
          expect(p.output.checks.filter((c) => c.includes("expected"))).toEqual([]);
          expect(p.output.instructions).toHaveLength(p.output.chart.length);
        });

  it("exports and re-imports to identical output", () => {
    const p = createProject({ ...base, carrier: { id: "two-colour", colours: { A: "cream", B: "red" } } }, "abc");
    const json = exportProject(p);
    const back = importProject(json);
    expect(back.issues).toEqual([]);
    expect(exportProject(back.project!)).toBe(json);
  });

  it("regenerates a hand-edited pattern from its settings and says so", () => {
    const p = createProject(base, "abc");
    const data = JSON.parse(exportProject(p));
    data.output.instructions[0] = "Row 1 (RS): k99";
    const back = importProject(JSON.stringify(data));
    expect(back.issues).toEqual(["The stored pattern did not match its settings, so it was regenerated from the settings."]);
    expect(back.project!.output.instructions[0]).toBe(p.output.instructions[0]);
  });

  it("refuses files it cannot use", () => {
    expect(importProject("{").issues[0]).toMatch(/not valid JSON/);
    expect(importProject("{}").issues[0]).toMatch(/not an Unravel the Purloined project/);
    expect(importProject(JSON.stringify({ format: "unravel-the-purloined/project", version: 9 })).issues[0]).toMatch(/version 9/);
    const bad = JSON.parse(exportProject(createProject(base, "x")));
    bad.settings.layout.width = 2;
    expect(importProject(JSON.stringify(bad)).issues[0]).toMatch(/settings could not be used: .*at least 3/);
  });

  it("carries the Bacon alphabet label, cipher note and merges", () => {
    const p = createProject({ ...base, message: "Juvenal", encoding: { alphabet: "bacon", variant: "historical24" } }, "x");
    expect(p.message.notes).toEqual([
      "Historical 24-letter alphabet: I and J share a code, U and V share a code.",
      "Bacon's biliteral alphabet is a historical / puzzle cipher, not modern security.",
      "Letter 1: J written as I.",
      "Letter 3: V written as U.",
    ]);
  });

  it("reports long floats for two-colour work", () => {
    const p = createProject({ ...base, message: "AAAA", layout: { width: 20, border: false }, carrier: { id: "two-colour" } }, "x");
    expect(p.output.checks.some((c) => /float [AB] behind; catch it/.test(c))).toBe(true);
  });
});

describe("project with a cipher", () => {
  const withCipher = (kind: "caesar" | "vigenere" | "railfence" | "route", key: string, encoding: ProjectSettings["encoding"] = base.encoding) =>
    createProject({ ...base, message: "In plain sight", encoding, cipher: { kind, key } }, "c");

  it("knits the enciphered text and decodes back to the plaintext", () => {
    for (const [kind, key] of [["caesar", "3"], ["vigenere", "DUPIN"], ["railfence", "3"], ["route", "4 spiral"]] as const) {
      const p = withCipher(kind, key);
      expect(p.message.normalized).toBe("IN PLAIN SIGHT");
      expect(p.message.enciphered).not.toBe("IN PLAIN SIGHT");
      expect(p.output.decoded).toBe("IN PLAIN SIGHT");
      expect(p.message.notes.at(-1)).toMatch(/Historical \/ puzzle cipher, not modern security\.$/);
    }
    expect(withCipher("caesar", "3").message.enciphered).toBe("LQ SODLQ VLJKW");
  });

  it("decodes exactly for every cipher, alphabet and many messages", () => {
    const messages = ["A B", "MEET AT THE OLD MILL", "IN PLAIN SIGHT.", "TRAIN AT 6", "WAIT BY THE BRIDGE?"];
    const ciphers = [["caesar", "7"], ["keyword", "KNITTING"], ["vigenere", "DUPIN"], ["railfence", "3"], ["route", "3 snake"], ["route", "5 spiral"]] as const;
    for (const m of messages)
      for (const [kind, key] of ciphers)
        for (const encoding of [base.encoding, { alphabet: "morse" } as const]) {
          const p = createProject({ ...base, message: m, encoding, cipher: { kind, key } }, "c");
          expect([m, kind, encoding.alphabet, p.output.decoded]).toEqual([m, kind, encoding.alphabet, p.message.normalized]);
        }
  });

  it("works with Morse and the 26-letter Bacon", () => {
    expect(withCipher("vigenere", "DUPIN", { alphabet: "morse" }).output.decoded).toBe("IN PLAIN SIGHT");
    expect(withCipher("caesar", "5", { alphabet: "bacon", variant: "modern26" }).output.decoded).toBe("INPLAINSIGHT");
    expect(withCipher("railfence", "2", { alphabet: "bacon", variant: "historical24" }).output.decoded).toBe("INPLAINSIGHT");
  });

  it("refuses a substitution cipher with the 24-letter Bacon, and says why", () => {
    expect(() => withCipher("caesar", "3", { alphabet: "bacon", variant: "historical24" })).toThrow(/cannot carry every letter/);
  });

  it("keeps the cipher through export and import", () => {
    const p = withCipher("vigenere", "DUPIN");
    const back = importProject(exportProject(p));
    expect(back.issues).toEqual([]);
    expect(back.project!.settings.cipher).toEqual({ kind: "vigenere", key: "DUPIN" });
  });

  it("still opens project files made before ciphers existed", () => {
    const p = createProject(base, "old");
    expect(p.settings.cipher).toBeUndefined();
    expect(importProject(exportProject(p)).issues).toEqual([]);
  });
});
