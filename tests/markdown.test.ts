import { describe, expect, it } from "vitest";
import { parseExhibit, writeExhibit } from "../src/content/markdown";
import { EXHIBITS } from "../src/content/exhibits";

const good = `---
slug: test
archive: ARCHIVE 99.1
title: A test
place: Here
period: Now
status: draft
experiment: Try the lab. | ./lab.html
---

An opening line
that wraps.

## Claims

- [B] [S01] [S02] A claim that
  runs onto a second line.
  Why: Two sources agree.

- [D] Something retold.
  Why: No source yet.
  Missing: A page-level citation.

## What we know

- One thing.

## What we do not know

- Another thing.
`;

describe("exhibit Markdown", () => {
  it("reads the header, lede, claims and lists", () => {
    const e = parseExhibit(good, "test.md");
    expect(e).toEqual({
      slug: "test",
      archive: "ARCHIVE 99.1",
      title: "A test",
      place: "Here",
      period: "Now",
      lede: "An opening line that wraps.",
      claims: [
        { text: "A claim that runs onto a second line.", grade: "B", sources: ["S01", "S02"], why: "Two sources agree." },
        { text: "Something retold.", grade: "D", sources: [], why: "No source yet.", sourceNote: "A page-level citation." },
      ],
      know: ["One thing."],
      unknown: ["Another thing."],
      experiment: { text: "Try the lab.", href: "./lab.html" },
      status: "draft",
    });
  });

  it("writes back what it reads", () => {
    for (const e of EXHIBITS) expect(parseExhibit(writeExhibit(e), e.slug)).toEqual(e);
  });

  it("names the file and line when something is wrong", () => {
    expect(() => parseExhibit(good.replace("  Why: Two sources agree.\n", ""), "x.md")).toThrow(/^x\.md, line 16: every claim needs a "Why:" line/);
    expect(() => parseExhibit(good.replace("[B] [S01]", "[Q] [S01]"), "x.md")).toThrow(/line 16: "Q" is not a grade/);
    expect(() => parseExhibit(good.replace("## What we know", "## Notes"), "x.md")).toThrow(/unknown section "## Notes"/);
    expect(() => parseExhibit(good.replace("status: draft", "status: maybe"), "x.md")).toThrow(/status must be "draft" or "published"/);
    expect(() => parseExhibit(good.replace("title: A test\n", ""), "x.md")).toThrow(/the header needs "title:"/);
    expect(() => parseExhibit(good.replace("- One thing.", "One thing."), "x.md")).toThrow(/should be a list item starting with "- "/);
  });

  it("loads every exhibit file in content/exhibits", () => {
    expect(EXHIBITS.map((e) => e.slug).sort()).toEqual(["belgium", "cloth-as-resistance", "evidence", "grini", "norway"]);
  });
});
