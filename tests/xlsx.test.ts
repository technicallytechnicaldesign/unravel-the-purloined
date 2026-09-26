import { describe, expect, it } from "vitest";
import { crc32, zip } from "../src/engine/zip";
import { chartCsv, columnName, workbook } from "../src/engine/xlsx";
import { FLAT, translate, type Visible } from "../src/engine/construction";

/** Read a stored (uncompressed) zip back into name -> text. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, string>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 30, at + 30 + nameLen));
    const data = bytes.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
    expect(crc32(data)).toBe(view.getUint32(at + 14, true));
    out.set(name, new TextDecoder().decode(data));
    at += 30 + nameLen + size;
  }
  return out;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("stores entries that read back byte for byte", () => {
    const files = unzip(zip([{ name: "a.txt", data: "hello" }, { name: "dir/b.xml", data: "<x/>" }]));
    expect([...files]).toEqual([["a.txt", "hello"], ["dir/b.xml", "<x/>"]]);
  });
});

describe("spreadsheet export", () => {
  const chart: Visible[][] = [
    ["knit", "purl", "knit"],
    ["purl", "purl", "knit"],
  ];
  const input = {
    title: "Swatch <1> & more",
    chart,
    rows: translate(chart, FLAT),
    method: "flat" as const,
    legend: [{ bit: 1 as const, visible: "purl" as const, symbol: "•", label: "Purl on the right side" }],
    instructions: ["Row 1 (RS): k1, p1, k1 [3 sts]"],
    notes: ["A note"],
  };

  it("names columns like a spreadsheet", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });

  it("writes the parts a spreadsheet app needs, one cell per stitch", () => {
    const files = unzip(workbook(input));
    expect([...files.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/sheet3.xml",
    ]);
    const chartXml = files.get("xl/worksheets/sheet1.xml")!;
    expect(chartXml).toContain("Swatch &lt;1&gt; &amp; more");
    // Row 2 of the chart is sheet row 3 (top), row 1 is sheet row 4. Purl cells carry a dot.
    expect(chartXml).toContain('<c r="B3" s="1" t="inlineStr"><is><t xml:space="preserve">•</t></is></c>');
    expect(chartXml).toContain('<c r="B4" s="1"/>');
    expect(chartXml).toContain("2 WS");
    expect(chartXml).toContain("1 RS");
    expect(files.get("xl/worksheets/sheet2.xml")).toContain("Row 1 (RS): k1, p1, k1 [3 sts]");
    expect(files.get("xl/workbook.xml")).toContain('<sheet name="Key" sheetId="3" r:id="rId3"/>');
  });

  it("writes the chart as CSV, top row first, stitch 1 last", () => {
    expect(chartCsv(chart)).toBe("row,st 3,st 2,st 1\n2,p,p,k\n1,k,p,k\n");
  });
});
