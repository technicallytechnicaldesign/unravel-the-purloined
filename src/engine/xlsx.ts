// Spreadsheet export: an .xlsx workbook with one cell per stitch, plus CSV.
// Written by hand (inline strings, fixed styles, stored zip) so the site needs
// no spreadsheet library.
//
// Sheets: "Chart" (the grid, row 1 at the bottom, RS row numbers on the right,
// WS on the left, stitch numbers underneath), "Rows" (written instructions),
// "Key" (legend and notes).

import { type Row, type Visible } from "./construction";
import { type LegendEntry } from "./carrier";
import { zip } from "./zip";

export interface SheetInput {
  title: string;
  chart: readonly (readonly Visible[])[];
  rows: readonly Row[];
  method: "flat" | "round";
  legend: readonly LegendEntry[];
  instructions: readonly string[];
  notes: readonly string[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Style ids, matching cellXfs in STYLES.
const S = { plain: 0, knit: 1, ink: 2, title: 3, small: 4 } as const;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font><font><sz val="8"/><color rgb="FF4A453A"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF9F6EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF16140F"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFCFC6B1"/></left><right style="thin"><color rgb="FFCFC6B1"/></right><top style="thin"><color rgb="FFCFC6B1"/></top><bottom style="thin"><color rgb="FFCFC6B1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

type CellValue = { text?: string; num?: number; style: number };

function sheet(rows: Map<number, Map<number, CellValue>>, cols: { width: number; count: number }[], rowHeight?: number): string {
  let colXml = "";
  let at = 1;
  for (const c of cols) {
    colXml += `<col min="${at}" max="${at + c.count - 1}" width="${c.width}" customWidth="1"/>`;
    at += c.count;
  }
  const rowXml = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([r, cells]) => {
      const cs = [...cells.entries()]
        .sort(([a], [b]) => a - b)
        .map(([c, v]) => {
          const ref = `${columnName(c)}${r}`;
          if (v.num !== undefined) return `<c r="${ref}" s="${v.style}"><v>${v.num}</v></c>`;
          if (v.text) return `<c r="${ref}" s="${v.style}" t="inlineStr"><is><t xml:space="preserve">${esc(v.text)}</t></is></c>`;
          return `<c r="${ref}" s="${v.style}"/>`;
        })
        .join("");
      return `<row r="${r}"${rowHeight ? ` ht="${rowHeight}" customHeight="1"` : ""}>${cs}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetFormatPr defaultRowHeight="15"/>${colXml ? `<cols>${colXml}</cols>` : ""}<sheetData>${rowXml}</sheetData></worksheet>`;
}

class Grid {
  rows = new Map<number, Map<number, CellValue>>();
  set(r: number, c: number, v: CellValue) {
    if (!this.rows.has(r)) this.rows.set(r, new Map());
    this.rows.get(r)!.set(c, v);
  }
}

function chartSheet(input: SheetInput): string {
  const g = new Grid();
  const h = input.chart.length;
  const w = input.chart[0]?.length ?? 0;
  g.set(1, 0, { text: input.title, style: S.title });
  const top = 3;
  input.chart.forEach((row, r) => {
    const xr = top + (h - 1 - r); // row 1 at the bottom
    row.forEach((v, c) => g.set(xr, c + 1, { text: v === "purl" ? "•" : "", style: v === "B" ? S.ink : S.knit }));
    const side = input.method === "round" ? "RS" : input.rows[r]?.side ?? "RS";
    const label = input.method === "round" ? String(r + 1) : `${r + 1} ${side}`;
    g.set(xr, side === "RS" ? w + 1 : 0, { text: label, style: S.small });
  });
  for (let c = 0; c < w; c++) g.set(top + h, c + 1, { num: w - c, style: S.small });
  return sheet(g.rows, [{ width: 6, count: 1 }, { width: 3.2, count: w }, { width: 6, count: 1 }]);
}

function listSheet(heading: string, lines: readonly string[]): string {
  const g = new Grid();
  g.set(1, 0, { text: heading, style: S.title });
  lines.forEach((l, i) => g.set(i + 3, 0, { text: l, style: S.plain }));
  return sheet(g.rows, [{ width: 90, count: 1 }]);
}

function keySheet(input: SheetInput): string {
  const g = new Grid();
  g.set(1, 0, { text: "Key", style: S.title });
  input.legend.forEach((l, i) => {
    g.set(i + 3, 0, { text: l.visible === "purl" ? "•" : "", style: l.visible === "B" ? S.ink : S.knit });
    g.set(i + 3, 1, { text: l.label, style: S.plain });
  });
  const start = input.legend.length + 4;
  input.notes.forEach((n, i) => g.set(start + i, 1, { text: n, style: S.plain }));
  g.set(start + input.notes.length + 1, 1, { text: "Row 1 is at the bottom. Stitch 1 is on the right.", style: S.plain });
  return sheet(g.rows, [{ width: 4, count: 1 }, { width: 90, count: 1 }]);
}

/** The workbook as bytes, ready to save as .xlsx. */
export function workbook(input: SheetInput): Uint8Array {
  const names = ["Chart", "Rows", "Key"];
  const sheets = [chartSheet(input), listSheet("Written rows", input.instructions), keySheet(input)];
  return zip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", data: STYLES },
    ...sheets.map((data, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data })),
  ]);
}

/** CSV of the chart: one line per row, top row first, row number first. k, p, A or B per stitch. */
export function chartCsv(chart: readonly (readonly Visible[])[]): string {
  const code: Record<Visible, string> = { knit: "k", purl: "p", A: "A", B: "B" };
  const w = chart[0]?.length ?? 0;
  const header = ["row", ...Array.from({ length: w }, (_, c) => `st ${w - c}`)].join(",");
  const lines = [...chart].map((row, r) => [r + 1, ...row.map((v) => code[v])].join(",")).reverse();
  return [header, ...lines].join("\n") + "\n";
}
