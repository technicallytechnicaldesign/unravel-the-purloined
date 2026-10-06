import { describe, expect, it } from "vitest";
import data from "../src/content/study-sw01.json";
import { readingPlan, readProgress } from "../src/content/study-reading";
const plan = readingPlan(data.rows, data.messageWindow);
describe("reading the fabric as rows appear or disappear", () => {
  it("recovers the real framed SW01 pattern through the documented key", () => {
    const full = readProgress(data.rows, data.rows.length, plan);
    expect(full.text).toBe("HELLO WORLD");
    expect(full.status).toMatch(/checksum pass/);
    expect(full.symbols.every(s => s.state === "complete")).toBe(true);
  });
  it("lets a candidate change before its check cells are present", () => {
    const early = readProgress(data.rows, 13, plan);
    expect(early.symbols[0]).toMatchObject({ glyph: "E", state: "partial", bits: "001????" });
    expect(readProgress(data.rows, 14, plan).symbols[0]).toMatchObject({ glyph: "H", state: "complete" });
    expect(early.text).toBe("");
  });
  it("forgets removed bits instead of retaining the revealed message", () => {
    expect(readProgress(data.rows, 14, plan).text).toBe("H");
    expect(readProgress(data.rows, 13, plan).text).toBe("");
    expect(readProgress(data.rows, 0, plan).symbols.every(s => s.state === "waiting")).toBe(true);
    for (let n = 0; n <= data.rows.length; n++) {
      const changed = data.rows.map((r, i) => i >= n ? "v".repeat(r.length) : r);
      expect(readProgress(changed, n, plan)).toEqual(readProgress(data.rows, n, plan));
    }
  });
  it("shows why the window and symbol framing matter", () => {
    const naive = readProgress(data.rows, 35, plan, false);
    expect(naive.text).not.toBe("HELLO WORLD");
    expect(naive.status).toMatch(/garter frame/);
  });
  it("keeps checksum failures visible in a completed read", () => {
    const changed = [...data.rows];
    changed[13] = changed[13]!.slice(0, 14) + (changed[13]![14] === "p" ? "v" : "p") + changed[13]!.slice(15);
    expect(readProgress(changed, 35, plan).status).toMatch(/needs checking/);
  });
});
