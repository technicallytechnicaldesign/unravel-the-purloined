import { describe, expect, it } from "vitest";
import { type Bit } from "../src/engine/fivebit";
import { decode, decodeUnits, encode, normalize, toUnits, transcribe } from "../src/engine/morse";

const units = (s: string) => Array.from(s).map(Number) as Bit[];

describe("Morse", () => {
  it("transcribes SOS the standard way", () => {
    expect(transcribe(encode("SOS"))).toBe("... --- ...");
    expect(transcribe(encode("MEET AT NOON"))).toBe("-- . . - / .- - / -. --- --- -.");
  });

  it("uses ITU timing: dot 1, dash 3, gaps 1, 3 and 7", () => {
    expect(toUnits(encode("A"))).toEqual(units("10111"));
    expect(toUnits(encode("EE"))).toEqual(units("10001"));
    expect(toUnits(encode("E E"))).toEqual(units("100000001"));
  });

  it("round-trips A-Z, 0-9, space and . ? through elements and units", () => {
    const all = "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789 . ?";
    expect(decode(encode(all))).toEqual({ text: all, issues: [] });
    expect(decodeUnits(toUnits(encode(all)))).toEqual({ text: all, issues: [] });
  });

  it("ignores blank border units around the message", () => {
    expect(decodeUnits([0, 0, ...toUnits(encode("HI")), 0]).text).toBe("HI");
  });

  it("reports an ambiguous mark with its position", () => {
    // S then a 2-unit mark: between a dot and a dash.
    const r = decodeUnits(units("10101000110"));
    expect(r.text).toBe("ST");
    expect(r.issues).toEqual([
      { kind: "ambiguous-length", letter: 2, unit: 8, message: "Mark of 2 units at unit 9 is not a clean dot (1) or dash (3); read as dash." },
    ]);
  });

  it("reports an ambiguous gap with its position", () => {
    // E, 5-unit space, E: between a letter gap and a word gap.
    const r = decodeUnits(units("1000001"));
    expect(r.text).toBe("E E");
    expect(r.issues[0]).toMatchObject({ kind: "ambiguous-length", letter: 1, unit: 1 });
    expect(r.issues[0]!.message).toMatch(/Space of 5 units at unit 2 .* read as a gap between words/);
  });

  it("reports a letter not in the table instead of dropping it", () => {
    const r = decode(["dash", "symbolGap", "dash", "symbolGap", "dash", "symbolGap", "dash"]);
    expect(r.text).toBe("�");
    expect(r.issues).toEqual([{ kind: "unknown-letter", letter: 1, message: "Letter 1 (----) is not in the Morse table." }]);
  });

  it("normalizes and reports what it cannot carry", () => {
    const n = normalize("Klønig, 1942!");
    expect(n.text).toBe("KLOENIG 1942");
    expect(n.dropped.map((d) => d.char)).toEqual([",", "!"]);
    expect(() => encode("a")).toThrow(/normalize first/);
  });
});
