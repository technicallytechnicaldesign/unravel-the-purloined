import { describe, expect, it } from "vitest";
import { createProject, type ProjectSettings } from "../src/engine/project";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";
import { fromRecipe, RECIPES, sectionRows, writeSection, type RecipeId } from "../src/engine/recipes";
import { PATTERNS, patternsFor, type StitchPattern } from "../src/engine/stitches";
import { readGrid, transform } from "../src/engine/grid";
import { purlRelief, read, twoColour } from "../src/engine/carrier";
import { FLAT, ROUND, translate } from "../src/engine/construction";
import { decodeFrame } from "../src/engine/errorcontrol";

const RECIPE_IDS = Object.keys(RECIPES) as RecipeId[];
const MESSAGE = "Check the card rack.";

function settingsFor(id: RecipeId, carrier: "purl-relief" | "two-colour", encoding: ProjectSettings["encoding"] = { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }): ProjectSettings {
  return { title: "t", message: MESSAGE, encoding, carrier: { id: carrier }, ...fromRecipe(id, carrier) };
}

describe("recipes (T14)", () => {
  for (const id of RECIPE_IDS)
    for (const carrier of ["purl-relief", "two-colour"] as const)
      it(`${id}, ${carrier}: renders, counts stitches and decodes back`, () => {
        for (const encoding of [{ alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }, { alphabet: "morse" }, { alphabet: "bacon", variant: "modern26" }] as const) {
          const p = createProject(settingsFor(id, carrier, encoding), "r");
          expect(p.output.decoded).toBe(p.message.normalized);
          expect(p.output.checks.filter((c) => c.includes("expected"))).toEqual([]);
          const stitches = RECIPES[id].width + 2 * RECIPES[id].borderWidth;
          expect(p.output.chart[0]!.length).toBe(stitches);
          expect(p.output.preamble[0]).toMatch(new RegExp(`^Cast on ${stitches} stitches`));
          expect(p.output.finishing.at(-1)).toBe(RECIPES[id].finish);
        }
      });

  it("switching flat and round changes only the construction, never the chart", () => {
    for (const id of RECIPE_IDS) {
      const flat = createProject({ ...settingsFor(id, "purl-relief"), construction: FLAT }, "r");
      const round = createProject({ ...settingsFor(id, "purl-relief"), construction: ROUND }, "r");
      expect(round.output.chart).toEqual(flat.output.chart);
      expect(round.output.logicalGrid).toEqual(flat.output.logicalGrid);
      expect(round.output.rows).not.toEqual(flat.output.rows);
      expect(round.output.preamble[0]).toMatch(/join to work in the round/);
    }
  });

  it("round ribbing meets itself at the join", () => {
    for (const id of ["cowl", "hat-band"] as const) {
      const stitches = RECIPES[id].width + 2 * RECIPES[id].borderWidth;
      expect(stitches % PATTERNS[RECIPES[id].border["purl-relief"]].repeat).toBe(0);
    }
  });

  it("writes plain sections the way patterns do", () => {
    expect(writeSection("Lower edge", sectionRows(8, 10, "garter", FLAT, false), "flat")).toEqual([
      "Lower edge (8 rows):",
      "Row 1 (RS): k10 [10 sts]",
      "Row 2 (WS): k10 [10 sts]",
      "Repeat these 2 rows 3 more times.",
    ]);
    expect(writeSection("Brim", sectionRows(10, 8, "rib2", ROUND, false), "round")).toEqual(["Brim (10 rounds):", "Round 1: p2, k2, p2, k2 [8 sts]", "Repeat this round 9 more times."]);
    expect(writeSection("Edge", sectionRows(4, 4, "seed", FLAT, false), "flat")).toEqual(["Edge (4 rows):", "Row 1 (RS): p1, k1, p1, k1 [4 sts]", "Row 2 (WS): k1, p1, k1, p1 [4 sts]", "Repeat these 2 rows 1 more time."]);
  });

  it("rounds odd edge counts up, so row 1 of the chart stays on the right side", () => {
    const p = createProject({ ...settingsFor("scarf", "purl-relief"), edges: { below: 3, above: 1, pattern: "seed" } }, "r");
    expect(p.output.preamble[1]).toBe("Lower edge in seed stitch (UK: moss stitch) (4 rows):");
    expect(p.output.rows[0]!.side).toBe("RS");
  });

  it("gives a rough finished size", () => {
    expect(createProject(settingsFor("swatch", "purl-relief"), "r").output.dimensions).toMatch(/^About 7 cm wide and \d+ cm tall, at a gauge of 22 stitches and 30 rows to 10 cm/);
  });
});

describe("borders (T15)", () => {
  it("restyle only border cells, in the chosen pattern", () => {
    for (const carrier of ["purl-relief", "two-colour"] as const)
      for (const style of patternsFor(carrier)) {
        const p = createProject({ ...settingsFor("swatch", carrier), borderStyle: style }, "b");
        p.output.chart.forEach((row, r) =>
          row.forEach((v, c) => {
            if (p.output.roles[r]![c] === "border") expect(v).toBe(PATTERNS[style].cell(r, c));
          }),
        );
        expect(p.output.decoded).toBe(p.message.normalized);
      }
  });

  it("garter borders are knit on every row when worked flat", () => {
    const p = createProject({ ...settingsFor("swatch", "purl-relief"), borderStyle: "garter" }, "b");
    for (const row of p.output.rows.slice(2, -2)) {
      expect([row.actions[0]!.stitch, row.actions[1]!.stitch, row.actions.at(-1)!.stitch, row.actions.at(-2)!.stitch]).toEqual(["k", "k", "k", "k"]);
    }
  });

  it("never change the message, and every turn of the fabric still reads, with deep patterned borders", () => {
    for (const [carrier, styles] of [["purl-relief", patternsFor("purl-relief")], ["two-colour", patternsFor("two-colour")]] as const)
      for (const style of styles as StitchPattern[])
        for (const depth of [1, 3]) {
          const p = createProject({ ...settingsFor("swatch", carrier), layout: { width: 10, border: true, borderWidth: depth }, borderStyle: style }, "b");
          const cells = read(p.output.chart, carrier === "two-colour" ? twoColour() : purlRelief()).cells;
          for (const rotated180 of [false, true])
            for (const mirrored of [false, true])
              for (const inverted of [false, true]) {
                const r = readGrid(transform(cells, { rotated180, mirrored, inverted }), depth);
                expect([style, depth, decodeFrame(r.bits).text]).toEqual([style, depth, p.message.normalized]);
              }
        }
  });

  it("refuse a border pattern from the other carrier, and say why", () => {
    expect(() => createProject({ ...settingsFor("swatch", "two-colour"), borderStyle: "seed" }, "b")).toThrow(/is for knit and purl work; choose another border pattern/);
    expect(() => createProject({ ...settingsFor("swatch", "purl-relief"), borderStyle: "checker" }, "b")).toThrow(/is for two-colour work/);
  });

  it("are translated like any other chart cell", () => {
    const chart = [["knit", "purl"], ["purl", "knit"]] as const;
    expect(translate(chart.map((r) => [...r]), FLAT)[1]!.actions.map((a) => a.stitch)).toEqual(["k", "p"]);
  });
});
