import { describe, expect, it } from "vitest";
import { ALPHABET_LABEL, decode, encode, normalize, toAB } from "../src/engine/bacon";

describe("Bacon biliteral", () => {
  it("matches Bacon's 24-letter table", () => {
    const ab = (ch: string) => toAB(encode(ch, "historical24"));
    expect([ab("A"), ab("B"), ab("I"), ab("K"), ab("U"), ab("W"), ab("Z")]).toEqual([
      "AAAAA", "AAAAB", "ABAAA", "ABAAB", "BAABB", "BABAA", "BABBB",
    ]);
  });

  it("gives every letter its own code in the 26-letter variant", () => {
    const ab = (ch: string) => toAB(encode(ch, "modern26"));
    expect([ab("I"), ab("J"), ab("U"), ab("V"), ab("Z")]).toEqual(["ABAAA", "ABAAB", "BABAA", "BABAB", "BBAAB"]);
  });

  it("round-trips all 26 letters in the modern variant", () => {
    const all = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const r = decode(encode(all, "modern26"), "modern26");
    expect([r.text, r.invalidGroups, r.ambiguous, r.trailingBits]).toEqual([all, [], [], 0]);
  });

  it("round-trips all 24 letters in the historical alphabet", () => {
    const all = "ABCDEFGHIKLMNOPQRSTUWXYZ";
    expect(decode(encode(all, "historical24"), "historical24").text).toBe(all);
  });

  it("reports the I/J and U/V merge on the way in and the way out", () => {
    const n = normalize("Juvenal", "historical24");
    expect(n.text).toBe("IUUENAL");
    expect(n.merged).toEqual([
      { char: "J", as: "I", position: 1 },
      { char: "V", as: "U", position: 3 },
    ]);
    const r = decode(encode(n.text, "historical24"), "historical24");
    expect(r.ambiguous).toEqual([
      { position: 1, letters: "IJ" },
      { position: 2, letters: "UV" },
      { position: 3, letters: "UV" },
    ]);
    expect(normalize("Juvenal", "modern26")).toMatchObject({ text: "JUVENAL", merged: [] });
  });

  it("says which alphabet is in use", () => {
    expect(decode([], "historical24").label).toBe(ALPHABET_LABEL.historical24);
    expect(decode([], "modern26").label).toMatch(/26-letter/);
  });

  it("reports spaces and punctuation it cannot carry", () => {
    const n = normalize("Meet at noon!", "modern26");
    expect(n.text).toBe("MEETATNOON");
    expect(n.dropped.map((d) => d.char)).toEqual([" ", " ", "!"]);
  });

  it("marks codes with no letter instead of dropping them", () => {
    const r = decode([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1], "historical24");
    expect(r).toMatchObject({ text: "�A", invalidGroups: [0], trailingBits: 1 });
    expect(() => encode("J", "historical24")).toThrow(/normalize first/);
  });
});
