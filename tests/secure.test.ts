import { describe, expect, it } from "vitest";
import { decrypt, encrypt, fromLetters, letterCount, OVERHEAD, toLetters } from "../src/engine/secure";
import { createProject } from "../src/engine/project";
import { DEFAULT_OPTIONS } from "../src/engine/errorcontrol";

describe("secure mode", () => {
  it("round-trips any text, with a fresh salt and nonce each time", async () => {
    const text = "Meet at noon, bring the red cap. Ø 😊";
    const a = await encrypt(text, "correct horse battery staple");
    const b = await encrypt(text, "correct horse battery staple");
    expect(a.length).toBe(OVERHEAD + new TextEncoder().encode(text).length);
    expect(toLetters(a)).not.toBe(toLetters(b));
    expect(await decrypt(a, "correct horse battery staple")).toEqual({ ok: true, text });
  });

  it("refuses a wrong passphrase and a changed byte, and says why", async () => {
    const bytes = await encrypt("MEET AT NOON.", "tea and yarn");
    expect(await decrypt(bytes, "tea and yarn!")).toMatchObject({ ok: false, message: /passphrase is wrong, or at least one letter was misread/ });
    for (const i of [5, 20, bytes.length - 1]) {
      const bent = bytes.slice();
      bent[i]! ^= 1;
      expect((await decrypt(bent, "tea and yarn")).ok).toBe(false);
    }
    const version = bytes.slice();
    version[0] = 2;
    expect(await decrypt(version, "tea and yarn")).toMatchObject({ ok: false, message: /Unknown secure format 2/ });
    expect(await decrypt(bytes.slice(0, 20), "tea and yarn")).toMatchObject({ ok: false, message: /Too short/ });
  });

  it("writes bytes as letters A to P and reads them back, reporting strays", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 171, 255]);
    expect(toLetters(bytes)).toBe("AAABAPBAKLPP");
    expect(fromLetters("AAABAPBAKLPP")).toEqual({ bytes, issues: [] });
    const r = fromLetters("AAAZ");
    expect(r.issues.map((i) => i.message)).toEqual([expect.stringMatching(/Character 4 is "Z".*near character 4/), expect.stringMatching(/odd count/)]);
    expect(letterCount("HI")).toBe(2 * (OVERHEAD + 2));
  });

  it("survives the knitting: letters through a five-bit project and back, then decrypted", async () => {
    const bytes = await encrypt("Meet at noon.", "wool");
    const p = createProject(
      {
        title: "Sealed",
        message: toLetters(bytes),
        encoding: { alphabet: "fivebit", errorControl: { ...DEFAULT_OPTIONS, code: "hamming" } },
        layout: { width: 40, border: false, borderWidth: 0 },
        carrier: { id: "purl-relief" },
        construction: { method: "flat", firstRow: "RS" },
        secure: { version: 1 },
      },
      "s",
    );
    expect(p.output.decoded).toBe(toLetters(bytes));
    expect(p.message.notes.join(" ")).toMatch(/AES-GCM/);
    expect(await decrypt(fromLetters(p.output.decoded).bytes, "wool")).toEqual({ ok: true, text: "Meet at noon." });
  });

  it("refuses settings that would change the letters", () => {
    const base = {
      title: "x",
      message: "ABCD",
      layout: { width: 20, border: false, borderWidth: 0 },
      carrier: { id: "purl-relief" as const },
      construction: { method: "flat" as const, firstRow: "RS" as const },
      secure: { version: 1 as const },
    };
    expect(() => createProject({ ...base, encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS }, cipher: { kind: "caesar", key: "3" } }, "s")).toThrow(/classical cipher/);
    expect(() => createProject({ ...base, message: "ABCZ", encoding: { alphabet: "fivebit", errorControl: DEFAULT_OPTIONS } }, "s")).toThrow(/only the letters A to P/);
    expect(() => createProject({ ...base, message: "IJIJ", encoding: { alphabet: "bacon", variant: "historical24" } }, "s")).toThrow(/cannot carry/);
  });
});
