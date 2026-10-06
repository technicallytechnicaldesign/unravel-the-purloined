import { expect,it } from "vitest";
import { sequenceProblems } from "../src/content/capture-sequence";
const frame=(n:number)=>({file:"row-"+n+".jpg",alt:"Fabric with "+n+" rows",completedRows:n,side:"RS"});
const manifest=(operation:string,rows:number[])=>({version:1,swatch:"SW01",evidence:"photographed",operation,frames:rows.map(frame)});
it("accepts empty intake templates and missing rows",()=>{
 expect(sequenceProblems(manifest("knitting",[]))).toEqual([]);
 expect(sequenceProblems(manifest("knitting",[0,1,4]))).toEqual([]);
 expect(sequenceProblems(manifest("frogging",[35,32,0]))).toEqual([]);
});
it("reports reversed order, unsafe files and duplicate frames",()=>{
 expect(sequenceProblems(manifest("frogging",[0,2])).join(" ")).toMatch(/row order/);
 const s=manifest("knitting",[1,2]);s.frames[1]={...frame(2),file:"../secret.jpg",side:"",alt:""};
 expect(sequenceProblems(s).length).toBeGreaterThanOrEqual(2);
 expect(sequenceProblems(manifest("knitting",[1,1])).join(" ")).toMatch(/repeats/);
 expect(sequenceProblems(null)).not.toEqual([]);
});
