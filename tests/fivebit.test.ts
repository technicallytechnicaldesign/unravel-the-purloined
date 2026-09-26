import { describe, expect, it } from "vitest";
import { decode, encode, normalize, START, END, type Bit } from "../src/engine/fivebit";

describe("five-bit alphabet", () => {
  it("matches the packet's worked example: K P K P P -> 01011 -> 11 -> L", () => {
    expect(encode("L")).toEqual([0, 1, 0, 1, 1]);
    expect(decode([0, 1, 0, 1, 1]).text).toBe("L");
  });

  it("round-trips every carried character", () => {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ .?" + START + END;
    expect(decode(encode(all)).text).toBe(all);
  });

  it("round-trips a normalized sentence", () => {
    const { text } = normalize("Unravel the Purloined");
    expect(text).toBe("UNRAVEL THE PURLOINED");
    expect(decode(encode(text))).toEqual({ text, invalidSymbols: [], trailingBits: 0 });
  });

  it("uses exactly five bits per character", () => {
    expect(encode("MEET AT NOON")).toHaveLength(12 * 5);
  });

  it("transliterates Norwegian letters and strips accents", () => {
    expect(normalize("Grini, Klønig, Å").text).toBe("GRINI KLOENIG AA");
    expect(normalize("Café").text).toBe("CAFE");
  });

  it("reports what it cannot carry instead of hiding it", () => {
    const n = normalize("1942!");
    expect(n.text).toBe("");
    expect(n.dropped.map((d) => d.char)).toEqual(["1", "9", "4", "2", "!"]);
  });

  it("collapses whitespace runs to one space", () => {
    expect(normalize("  meet \n\t at  noon ").text).toBe("MEET AT NOON");
  });

  it("flags the reserved value and leftover bits on decode", () => {
    const bits: Bit[] = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0];
    expect(decode(bits)).toEqual({ text: "A", invalidSymbols: [0], trailingBits: 2 });
  });

  it("refuses un-normalized input on encode", () => {
    expect(() => encode("a")).toThrow(/normalize first/);
  });
});
