import { describe, expect, it } from "vitest";
import { EXHIBITS } from "../src/content/exhibits";
import { publicExhibit, visibleExhibit } from "../src/content/archive-visibility";
import { parseExhibit, writeExhibit } from "../src/content/markdown";
describe("public archive drafts",()=>{
 it("exposes only the chosen draft publicly",()=>{
  expect(EXHIBITS.filter(publicExhibit).map((e)=>[e.slug,e.status])).toEqual([["norway","draft"]]);
  expect(EXHIBITS.every((e)=>visibleExhibit(e,true))).toBe(true);
 });
 it("refuses opt-ins with unchecked or absent citations",()=>{
  const e=EXHIBITS.find((x)=>x.slug==="norway")!;
  expect(publicExhibit({...e,claims:[{...e.claims[0]!,sources:["S03"]}]})).toBe(false);
  expect(publicExhibit({...e,claims:[{...e.claims[0]!,sources:[]}]})).toBe(false);
  expect(publicExhibit({...e,visibility:undefined})).toBe(false);
 });
 it("round-trips the opt-in and keeps draft status",()=>{
  const e=EXHIBITS.find((x)=>x.slug==="norway")!;
  expect(parseExhibit(writeExhibit(e),"norway.md")).toEqual(e);
  expect(()=>parseExhibit(writeExhibit(e).replace("visibility: public","visibility: maybe"),"bad.md")).toThrow(/visibility/);
 });
});
