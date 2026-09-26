import { describe, expect, it } from "vitest";
import { parseRows } from "../src/ui/decode";

describe("typed rows for the manual decoder", () => {
  it("reads top row first and stores row 1 at the bottom", () => {
    expect(parseRows("1x*\n0.-\n")).toEqual([
      [0, 0, 0],
      [1, 1, 1],
    ]);
  });

  it("accepts k/p and ignores spaces and separators", () => {
    expect(parseRows("k p | k\nP K P")).toEqual([
      [1, 0, 1],
      [0, 1, 0],
    ]);
  });

  it("explains what is wrong instead of guessing", () => {
    expect(parseRows("")).toMatch(/at least one row/);
    expect(parseRows("01\n012")).toMatch(/line 2: "2" is not a cell/i);
    expect(parseRows("01\n011")).toMatch(/same number of cells/);
  });
});
