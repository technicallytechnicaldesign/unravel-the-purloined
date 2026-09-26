import { describe, expect, it } from "vitest";
import { CIPHERS, decipher, encipher, keyProblem, type CipherKind, type CipherSettings } from "../src/engine/ciphers";

const c = (kind: CipherKind, key: string): CipherSettings => ({ kind, key });

describe("classical ciphers", () => {
  it("match the textbook examples", () => {
    expect(encipher("HELLO", c("caesar", "3"))).toBe("KHOOR");
    expect(encipher("ATTACK AT DAWN", c("vigenere", "LEMON"))).toBe("LXFOPV EF RNHR");
    expect(encipher("WEAREDISCOVEREDFLEEATONCE", c("railfence", "3"))).toBe("WECRLTEERDSOEEFEAOCAIVDEN");
    expect(encipher("ABCDEFGHIJKLMNOPQRSTUVWXYZ", c("keyword", "KRYPTOS"))).toBe("KRYPTOSABCDEFGHIJLMNQUVWXZ");
    // Rows ABC / DEF / G: columns read A D G, B E, C F.
    expect(encipher("ABCDEFG", c("route", "3"))).toBe("ADGBECF");
    expect(encipher("ABCDEFG", c("route", "3 snake"))).toBe("ADGEBCF");
    // Rows ABC / DEF / GHI, clockwise spiral from the top left.
    expect(encipher("ABCDEFGHI", c("route", "3 spiral"))).toBe("ABCFIHGDE");
  });

  it("move letters but never spaces in transposition ciphers", () => {
    for (const key of ["2", "5"]) {
      const out = encipher("MEET AT THE OLD MILL", c("railfence", key));
      expect([...out].map((ch) => ch === " ")).toEqual([..."MEET AT THE OLD MILL"].map((ch) => ch === " "));
    }
    expect(encipher("AB CD", c("route", "2"))).toBe("AC BD");
  });

  it("leave spaces, digits and punctuation alone in substitution ciphers", () => {
    expect(encipher("MEET AT 6.", c("caesar", "1"))).toBe("NFFU BU 6.");
    expect(encipher("A B", c("vigenere", "BC"))).toBe("B D"); // the key only advances on letters
  });

  const texts = ["", "A", "IN PLAIN SIGHT", "THE KEY IS UNDER THE MAT.", "WAIT BY THE BRIDGE AT 6?", "ZZZ YYY XXX"];
  const keys: [CipherKind, string][] = [
    ["caesar", "3"], ["caesar", "25"], ["caesar", "-4"], ["caesar", "40"],
    ["keyword", "KNITTING"], ["keyword", "zebra"],
    ["vigenere", "DUPIN"], ["vigenere", "a"],
    ["railfence", "2"], ["railfence", "3"], ["railfence", "7"],
    ["route", "2"], ["route", "5 snake"], ["route", "4 spiral"], ["route", "7 SPIRAL"], ["route", "3 columns"],
  ];
  it("decipher undoes encipher for every kind and key", () => {
    for (const [kind, key] of keys)
      for (const t of texts) expect([kind, key, t, decipher(encipher(t, c(kind, key)), c(kind, key))]).toEqual([kind, key, t, t]);
  });

  it("explain bad keys instead of guessing", () => {
    expect(keyProblem(c("caesar", "three"))).toMatch(/whole number/);
    expect(keyProblem(c("vigenere", "123"))).toMatch(/at least one letter/);
    expect(keyProblem(c("railfence", "1"))).toMatch(/2 to 12/);
    expect(keyProblem(c("route", "5 zigzag"))).toMatch(/columns, snake or spiral/);
    expect(() => encipher("HI", c("railfence", "0"))).toThrow(/2 to 12/);
    expect(keyProblem(c("none", ""))).toBeNull();
  });

  it("offer a working example key for each kind", () => {
    for (const [kind, info] of Object.entries(CIPHERS)) if (kind !== "none") expect(keyProblem(c(kind as CipherKind, info.example))).toBeNull();
  });
});
