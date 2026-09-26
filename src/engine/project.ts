// Project object (packet section 37): every setting and every pipeline stage
// for one pattern, serializable so a pattern can be exported as JSON and
// re-imported. Output is always regenerated from the settings, so a file
// edited by hand cannot smuggle in a chart the settings would not make.

import { type Bit } from "./fivebit";
import * as fivebit from "./fivebit";
import * as morse from "./morse";
import * as bacon from "./bacon";
import { type Dropped } from "./normalize";
import { decodeFrame, encodeFrame, type ErrorControlOptions } from "./errorcontrol";
import { layout, readGrid, type CellRole, type GridOptions } from "./grid";
import { toChart, translate, type Construction, type Row, type Visible } from "./construction";
import { longFloats, purlRelief, read, render, twoColour, type Carrier, type CarrierId, type ColourNames, type LegendEntry } from "./carrier";
import { checkStitchCounts, writeRows } from "./pattern";

export const PROJECT_FORMAT = "unravel-the-purloined/project";
export const PROJECT_VERSION = 1;

export type EncodingSettings =
  | { alphabet: "fivebit"; errorControl: ErrorControlOptions }
  | { alphabet: "morse" }
  | { alphabet: "bacon"; variant: bacon.BaconAlphabet };

export interface ProjectSettings {
  title: string;
  message: string;
  encoding: EncodingSettings;
  layout: GridOptions;
  carrier: { id: CarrierId; colours?: ColourNames };
  construction: Construction;
}

export interface Project {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  id: string;
  settings: ProjectSettings;
  message: {
    normalized: string;
    dropped: Dropped[];
    /** Anything the reader should know about how the text was changed or carried. */
    notes: string[];
  };
  output: {
    bits: Bit[];
    logicalGrid: Bit[][];
    roles: CellRole[][];
    chart: Visible[][];
    rows: Row[];
    instructions: string[];
    legend: LegendEntry[];
    carrierNotes: string[];
    /** Stitch-count and float checks, one plain line each. Empty is good. */
    checks: string[];
    /** The pattern decoded back to text, as proof the chain holds. */
    decoded: string;
  };
}

function carrierFor(s: ProjectSettings["carrier"]): Carrier {
  return s.id === "two-colour" ? twoColour(s.colours) : purlRelief();
}

function encodeMessage(message: string, e: EncodingSettings): { normalized: string; dropped: Dropped[]; notes: string[]; bits: Bit[] } {
  if (e.alphabet === "morse") {
    const n = morse.normalize(message);
    return { normalized: n.text, dropped: n.dropped, notes: [], bits: morse.toUnits(morse.encode(n.text)) };
  }
  if (e.alphabet === "bacon") {
    const n = bacon.normalize(message, e.variant);
    const notes = [
      bacon.ALPHABET_LABEL[e.variant],
      "Bacon's biliteral alphabet is a historical / puzzle cipher, not modern security.",
      ...n.merged.map((m) => `Letter ${m.position}: ${m.char} written as ${m.as}.`),
    ];
    return { normalized: n.text, dropped: n.dropped, notes, bits: bacon.encode(n.text, e.variant) };
  }
  const n = fivebit.normalize(message);
  return { normalized: n.text, dropped: n.dropped, notes: [], bits: encodeFrame(n.text, e.errorControl) };
}

/** Read a finished pattern back to text, through every stage in reverse. */
export function decodeRows(rows: readonly Row[], settings: ProjectSettings): string {
  const cells = read(toChart(rows), carrierFor(settings.carrier)).cells;
  const bits = readGrid(cells, settings.layout.border).bits;
  const e = settings.encoding;
  if (e.alphabet === "morse") return morse.decodeUnits(bits).text;
  if (e.alphabet === "bacon") return bacon.decode(bits, e.variant).text;
  return decodeFrame(bits, e.errorControl).text;
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Run the whole pipeline for one set of settings. */
export function createProject(settings: ProjectSettings, id: string = newId()): Project {
  const msg = encodeMessage(settings.message, settings.encoding);
  const grid = layout(msg.bits, settings.layout);
  const carrier = carrierFor(settings.carrier);
  const chart = render(grid.cells, carrier);
  const rows = translate(chart, settings.construction);
  const floats =
    carrier.id === "two-colour"
      ? longFloats(chart).map((f) => `Row ${f.row}: ${f.length} stitches from stitch ${f.from} (counted from the left) float ${f.colour} behind; catch it.`)
      : [];
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    id,
    settings,
    message: { normalized: msg.normalized, dropped: msg.dropped, notes: msg.notes },
    output: {
      bits: msg.bits,
      logicalGrid: grid.cells,
      roles: grid.roles,
      chart,
      rows,
      instructions: writeRows(rows, settings.construction.method),
      legend: carrier.legend,
      carrierNotes: carrier.notes,
      checks: [...checkStitchCounts(rows, chart[0]!.length), ...floats],
      decoded: decodeRows(rows, settings),
    },
  };
}

export function exportProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export interface ImportResult {
  project?: Project;
  /** Plain lines: why the file was refused, or what was corrected. */
  issues: string[];
}

/** Parse a project file, then regenerate its output from its settings. */
export function importProject(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { issues: ["This file is not valid JSON."] };
  }
  const p = data as Partial<Project> | null;
  if (!p || p.format !== PROJECT_FORMAT) return { issues: ["This is not an Unravel the Purloined project file."] };
  if (p.version !== PROJECT_VERSION) return { issues: [`Project version ${String(p.version)} is not supported; this site reads version ${PROJECT_VERSION}.`] };
  if (typeof p.id !== "string" || !p.settings) return { issues: ["The project file is missing its id or settings."] };

  let project: Project;
  try {
    project = createProject(p.settings, p.id);
  } catch (err) {
    return { issues: [`The settings could not be used: ${err instanceof Error ? err.message : String(err)}`] };
  }
  const issues = JSON.stringify(project) === JSON.stringify(data) ? [] : ["The stored pattern did not match its settings, so it was regenerated from the settings."];
  return { project, issues };
}
