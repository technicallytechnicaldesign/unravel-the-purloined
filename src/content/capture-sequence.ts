export interface CaptureFrame { file: string; alt: string; completedRows: number; side: "RS" | "WS"; note?: string; }
export interface CaptureSequence { version: 1; swatch: string; operation: "knitting" | "frogging"; evidence: "photographed"; frames: CaptureFrame[]; }
/** Row counts exclude cast-on and bind-off. Frames retain capture order. */
export function sequenceProblems(value: unknown): string[] {
 if (!value || typeof value !== "object") return ["The manifest must be an object."];
 const s=value as Partial<CaptureSequence>, errors:string[]=[];
 if(s.version!==1 || typeof s.swatch!=="string" || !s.swatch.trim() || s.evidence!=="photographed") errors.push("Version 1, a swatch ID and photographed evidence are required.");
 if(s.operation!=="knitting" && s.operation!=="frogging") errors.push("Operation must be knitting or frogging.");
 if(!Array.isArray(s.frames))return [...errors,"Frames must be an array."];
 const files=new Set<string>();let previous:number|undefined;
 for(const [i,f] of s.frames.entries()){
  const label="Frame "+(i+1);
  if(!f || typeof f!=="object"){errors.push(label+" must be an object.");continue;}
  if(typeof f.file!=="string" || !/^[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(f.file) || f.file.includes("..") || f.file.startsWith("/"))errors.push(label+" needs a relative image file.");
  if(files.has(f.file))errors.push(label+" repeats a file.");files.add(f.file);
  if(typeof f.alt!=="string" || !f.alt.trim() || !["RS","WS"].includes(f.side))errors.push(label+" needs alt text and photographed side.");
  if(!Number.isInteger(f.completedRows) || f.completedRows<0)errors.push(label+" needs a non-negative completed-row count.");
  if(previous!==undefined && (s.operation==="knitting" ? f.completedRows<previous : f.completedRows>previous))errors.push(label+" reverses the row order.");
  previous=f.completedRows;
 }return errors;
}
