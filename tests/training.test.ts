import { describe, expect, it } from "vitest";
import { fabricLayout, fabricSvg } from "../src/engine/fabric";
import { createProject } from "../src/engine/project";
import { trainingGroups, TRAINING_ANSWER } from "../src/ui/training";
import { PIECES, plateProject, waiting } from "../src/content/gallery";
import { importProject } from "../src/engine/project";
import { type Bit } from "../src/engine/fivebit";

const project = createProject(
  { title: "t", message: TRAINING_ANSWER, layout: { width: 10, border: false }, construction: { method: "flat", firstRow: "RS" }, encoding: { alphabet: "fivebit", errorControl: { code: "plain", separator: false, checksum: false } }, carrier: { id: "purl-relief" } },
  "t",
);
const chart = project.output.chart;

describe("fabric layout", () => {
  it("places rows top first, edge to edge, matching the drawing's size", () => {
    const opts = { seed: 7, stitch: 30, wobble: 0.3 };
    const l = fabricLayout(chart, opts);
    expect(fabricSvg(chart, opts)).toContain(`width="${Math.round(l.width * 10) / 10}"`);
    const top = l.rows[chart.length - 1]!;
    expect(top.y).toBeCloseTo(l.pad);
    for (let r = 0; r < chart.length - 1; r++) expect(l.rows[r]!.y).toBeCloseTo(l.rows[r + 1]!.y + l.rows[r + 1]!.h);
    expect(l.rows[0]!.y + l.rows[0]!.h).toBeCloseTo(l.height - l.pad);
  });
});

describe("training parcel", () => {
  const bits = chart.map((r) => r.map((v) => (v === "purl" ? 1 : 0) as Bit));
  it("reads START, then the letters of the answer, then END", () => {
    expect(trainingGroups(bits).map((g) => g.reads)).toEqual(["START", ...TRAINING_ANSWER, "END"]);
  });
  it("fits in five rows: marker, three of message, top", () => {
    expect(bits.length).toBe(5);
  });
});

describe("gallery", () => {
  it("lists pieces with a picture and words for it", () => {
    for (const p of PIECES) expect(p.image && p.alt && p.title).toBeTruthy();
  });

  it("numbers drawn plates after the real pieces, and opens the finished sample for decoding", async () => {
    const drawn = waiting();
    expect(drawn[0]!.plate).toBe(String(PIECES.length + 1).padStart(2, "0"));
    const sample = drawn.find((p) => !p.rows);
    if (!sample) return;
    const json = await plateProject(sample.plate);
    expect(importProject(json!).project?.output.decoded).toBe(sample.settings.message);
    expect(await plateProject(drawn.find((p) => p.rows)!.plate)).toBeUndefined();
  });
});
