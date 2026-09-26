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
