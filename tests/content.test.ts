import { describe, expect, it } from "vitest";
import { EXHIBITS, GRADES } from "../src/content/exhibits";
import { SOURCES, sourceById } from "../src/content/sources";

describe("source register", () => {
  it("holds S01 to S23 once each, with https links", () => {
    expect(SOURCES.map((s) => s.id)).toEqual(Array.from({ length: 23 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`));
    for (const s of SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });

  it("only calls a source checked when it records what it supports, a grade and a date", () => {
    for (const s of SOURCES.filter((x) => x.status === "checked")) {
      expect([s.id, s.supports.length > 0, s.grade !== null, /^\d{4}-\d{2}-\d{2}$/.test(s.checked ?? "")]).toEqual([s.id, true, true, true]);
    }
  });
});

describe("exhibits", () => {
  it("have unique slugs and at least one claim", () => {
    expect(new Set(EXHIBITS.map((e) => e.slug)).size).toBe(EXHIBITS.length);
    for (const e of EXHIBITS) expect(e.claims.length).toBeGreaterThan(0);
  });

  it("grade every claim and cite sources that exist", () => {
    for (const e of EXHIBITS)
      for (const c of e.claims) {
        expect(Object.keys(GRADES)).toContain(c.grade);
        expect(c.why.length).toBeGreaterThan(10);
        for (const id of c.sources) expect(sourceById(id), `${e.slug}: ${id}`).toBeDefined();
      }
  });

  it("allow a claim without a source only when it is graded disputed and says what is missing", () => {
    for (const e of EXHIBITS)
      for (const c of e.claims.filter((x) => x.sources.length === 0)) {
        expect([e.slug, c.grade]).toEqual([e.slug, "D"]);
        expect(c.sourceNote, c.text).toBeTruthy();
      }
  });

  it("publish a page only when every source it cites has been checked", () => {
    for (const e of EXHIBITS.filter((x) => x.status === "published"))
      for (const id of e.claims.flatMap((c) => c.sources)) expect([e.slug, id, sourceById(id)!.status]).toEqual([e.slug, id, "checked"]);
  });

  it("follow the writing and honesty rules", () => {
    const text = JSON.stringify(EXHIBITS) + JSON.stringify(SOURCES);
    expect(text).not.toMatch(/\u2014/); // no em dashes
    expect(text).not.toMatch(/unbreakable/i);
    expect(text).not.toMatch(/\btraditional\b/i);
  });

  it("never merge Klønig's two activities into a stitch-code claim", () => {
    const grini = EXHIBITS.find((e) => e.slug === "grini")!;
    expect(grini.claims.some((c) => /Klønig/.test(c.text))).toBe(false);
    expect(grini.unknown.join(" ")).toMatch(/not found evidence that her messages themselves were in stitches/);
  });
});
