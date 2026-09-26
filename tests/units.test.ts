import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";
import { createProject, type ProjectSettings } from "../src/engine/project";
import { expandUnits, reduceUnits, UNITS, type UnitId } from "../src/engine/units";
import { FLAT, ROUND, isSpecial, translate, type Construction } from "../src/engine/construction";
import { stitchesIn, writeRow } from "../src/engine/pattern";
import { fromRecipe } from "../src/engine/recipes";

const IDS = Object.keys(UNITS) as UnitId[];
const settings = (carrier: UnitId, extra: Partial<ProjectSettings> = {}): ProjectSettings => ({
  title: "t",
  message: "Meet at noon.",
  encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS },
  layout: { width: 6, border: false },
  carrier: { id: carrier },
  construction: FLAT,
  ...extra,
});

describe("unit carriers (Phase 4)", () => {
  for (const id of IDS)
    it(`${id}: blocks are even height, differ, and round-trip`, () => {
      const u = UNITS[id];
      expect(u.height % 2).toBe(0);
      for (const special of [0, 1]) expect(u.block(0, special)).not.toEqual(u.block(1, special));
      const cells: Bit[][] = [[0, 1, 1], [1, 0, 1]];
      const roles = cells.map((r) => r.map(() => "data" as const));
      const { chart } = expandUnits(cells, roles, u, 0);
      expect([chart.length, chart[0]!.length]).toEqual([2 * u.height, 3 * u.width]);
      expect(reduceUnits(chart, u, 0)).toEqual({ cells, notes: [] });
    });

  const constructions: [string, Construction][] = [["flat", FLAT], ["flat from WS", { method: "flat", firstRow: "WS" }], ["round", ROUND]];
  for (const id of IDS)
    for (const [label, construction] of constructions)
      it(`${id}, ${label}: every alphabet decodes back, special stitches only on right-side rows, stitch counts hold`, () => {
        for (const encoding of [{ alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }, { alphabet: "morse" }, { alphabet: "bacon", variant: "modern26" }] as const) {
          const p = createProject(settings(id, { encoding, construction }), "u");
          expect(p.output.decoded).toBe(p.message.normalized);
          expect(p.output.checks.filter((c) => c.includes("expected"))).toEqual([]);
          for (const row of p.output.rows) {
            if (row.actions.some((a) => isSpecial(a.stitch))) expect(row.side).toBe("RS");
            expect(stitchesIn(row)).toBe(p.output.chart[0]!.length);
          }
          expect(p.output.abbreviations.length).toBeGreaterThan(0);
        }
      });

  it("writes cables and lace the way patterns do", () => {
    const cable = translate(UNITS.cable.block(0, 0), FLAT);
    expect(writeRow(cable[0]!, "flat")).toBe("Row 1 (RS): p1, C4F, p1 [6 sts]");
    expect(writeRow(cable[1]!, "flat")).toBe("Row 2 (WS): k1, p4, k1 [6 sts]");
    const lace = translate(UNITS.lace.block(1, 0), FLAT);
    expect(writeRow(lace[0]!, "flat")).toBe("Row 1 (RS): k1, k2tog, yo, k1 [4 sts]");
    const lace0 = translate(UNITS.lace.block(0, 0), FLAT);
    expect(writeRow(lace0[0]!, "flat")).toBe("Row 1 (RS): k1, yo, ssk, k1 [4 sts]");
  });

  it("explains every special stitch it uses", () => {
    const p = createProject(settings("cable"), "u");
    expect(p.output.abbreviations.map((a) => a.split(":")[0])).toEqual(expect.arrayContaining(["C4F", "C4B"]));
    expect(p.output.abbreviations[0]).toMatch(/^C4[FB]: cable 4 (front|back): slip 2 stitches to a cable needle/);
  });

  it("refuses special stitches on wrong-side rows, and says how to fix it", () => {
    expect(() => translate([["knit"], ["mb"]], FLAT)).toThrow(/Row 2: mb is worked on right-side rows only/);
  });

  it("work with recipes, borders and hiding", () => {
    for (const id of IDS) {
      const recipe = createProject({ ...settings(id), ...fromRecipe("scarf", id) }, "u");
      expect(recipe.output.decoded).toBe(recipe.message.normalized);
      const hidden = createProject(settings(id, { hide: { mode: "scatter", seed: 5, filler: "seed", density: 3 } }), "u");
      expect(hidden.output.decoded).toBe(hidden.message.normalized);
    }
  });
});
