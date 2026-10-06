import "./style.css";
import "./studies.css";
import { h } from "./ui/h";
import { mountWordmarks } from "./ui/wordmark";
import { markSessionSeen } from "./ui/intro";
import { readingPlan, readProgress } from "./content/study-reading";
import { fabricLayout } from "./engine/fabric";
markSessionSeen();
mountWordmarks();
import data from "./content/study-sw01.json";
import { fabricSvg } from "./engine/fabric";
import { translate, type Visible } from "./engine/construction";
import { encode, decode } from "./engine/fivebit";
import { encipher, decipher } from "./engine/ciphers";
const url = (file: string) => import.meta.env.BASE_URL + file;
const button = (text: string, run: () => void) => h("button.btn", { type: "button", onclick: run }, text);
const drawing = (rows: Visible[][], label: string): HTMLElement => {
 const box = h("div"); box.innerHTML = fabricSvg(rows, { seed: 101, stitch: 19, wobble: .25, label }); return box;
};
const chart: Visible[][] = data.rows.map((r) => [...r].map((c) => c === "p" ? "purl" : "knit"));
const actions = translate(chart, { method: "flat", firstRow: "RS" });
const plan = readingPlan(data.rows, data.messageWindow);
const stage = h("div.study-stage"), info = h("p.study-readout", { "aria-live": "polite" }), evidence = h("p.study-evidence");
const row = h("input.study-row", { type: "range", min: 0, max: chart.length, value: chart.length, "aria-label": "Completed rows remaining" }) as HTMLInputElement;
const rowText = h("output.mono"), modes = h("div.study-controls"), views = h("div.study-controls", { "aria-label": "Inspection layers" });
let mode = "inspection", layer = "photo", timer: ReturnType<typeof setInterval> | undefined;
function stop(): void { if (timer) clearInterval(timer); timer = undefined; play.textContent = "Play sequence"; }
const play = button("Play sequence", () => {
 if (timer) { stop(); render(); return; }
 if (mode === "inspection") return;
 if (mode === "needles" && Number(row.value) === chart.length) row.value = "0";
 if (mode === "frog" && Number(row.value) === 0) row.value = String(chart.length);
 timer = setInterval(() => {
  const n = Number(row.value) + (mode === "needles" ? 1 : -1);
  if (n < 0 || n > chart.length) { stop(); render(); return; }
  row.value = String(n); render();
 }, 450); play.textContent = "Pause sequence"; render();
});


const useKey = h("input", { type: "checkbox", checked: true }) as HTMLInputElement;
const currentLetter = h("p.study-current", { "aria-hidden": "true" });
const currentBits = h("p.mono.study-current-bits");
const readState = h("p.study-reading-state");
const messageStrip = h("div.study-message", { "aria-label": "Current reading" });
const readingStatus = h("p.hint.study-reading-status", { "aria-live": "polite", "aria-atomic": "true" });
const liveReading = h("section.study-live", { "aria-label": "Read the changing fabric" },
 h("p.mono", {}, "READ THE CHANGING FABRIC"),
 h("label.study-key", {}, useKey, " Use the reading key"), currentLetter, currentBits, readState, messageStrip, readingStatus,
 h("p.hint", {}, "A dotted letter is a provisional guess: missing bits are temporarily read as zero. It can change until the full block is present. Red outlines mark the block being read."));
useKey.addEventListener("change", () => render());
function updateReading(n: number): void {
 liveReading.hidden = mode === "inspection";
 if (liveReading.hidden) return;
 const read = readProgress(data.rows, n, plan, useKey.checked);
 const active = read.symbols[read.active];
 currentLetter.textContent = active ? active.glyph === " " ? "␣" : active.glyph : "·";
 currentLetter.className = "study-current " + (active?.state ?? "waiting");
 currentBits.textContent = active ? active.bits + (useKey.checked ? " / 5 LETTER + PARITY + GAP" : " / FIVE-BIT GUESS") : "WAITING FOR MESSAGE STITCHES";
 readState.textContent = active ? active.state === "partial" ? "Provisional letter, this block is incomplete" : active.state === "error" ? "Check cells disagree: inspect this block" : useKey.checked ? "Letter read from a complete block" : "A guess without the window or framing key" : "No message block is available yet";
 const shown = useKey.checked ? read.symbols : read.symbols.slice(-24);
 messageStrip.replaceChildren(...shown.map((s) => h("span.study-symbol." + s.state, { title: s.bits + " / " + s.state }, s.glyph === " " ? "␣" : s.glyph || "·")));
 readingStatus.setAttribute("aria-live", timer ? "off" : "polite");
 readingStatus.textContent = (active ? "Current symbol: " + (active.glyph === " " ? "space" : active.glyph) + ". " : "") + read.status + (useKey.checked ? "" : " Showing the latest 24 guesses.");
 const svg = stage.querySelector("svg");
 if (svg && active) {
  const geometry = fabricLayout(chart.slice(0,n), {seed:101,stitch:19,wobble:.25});
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("aria-hidden", "true");
  for (const [r,c] of active.cells) {
   const pos=geometry.rows[r]; if(!pos)continue;
   const box=document.createElementNS(group.namespaceURI,"rect");
   for(const [key,value] of Object.entries({x:String(geometry.pad+c*geometry.stitch),y:String(pos.y),width:String(geometry.stitch),height:String(pos.h),fill:"none",stroke:"var(--red)","stroke-width":"1.8"}))box.setAttribute(key,value);
   if(active.state==="partial")box.setAttribute("stroke-dasharray","3 2");
   group.append(box);
  }
  svg.append(group);
 }
}

function render(): void {
 const n = Number(row.value); rowText.textContent = n + " / " + chart.length + " completed rows remain";
 row.hidden = rowText.hidden = play.hidden = mode === "inspection"; views.hidden = mode !== "inspection";
 if (mode === "inspection" && layer === "photo") {
  stage.replaceChildren(h("img", { src: url(data.photos[1]!.src), alt: data.photos[1]!.alt }));
  evidence.textContent = "MEASURED / REAL SW01 PHOTOGRAPH. Stitch read-back has not yet been verified.";
  info.textContent = "Fuzzy yarn obscures stitch boundaries. Photo/chart registration and a hand trace are still pending.";
 } else if (mode === "inspection" && layer === "chart") {
  const grid = h("div.study-cells"); grid.style.gridTemplateColumns = "repeat(" + chart[0]!.length + ", 1fr)";
  for (let r = chart.length - 1; r >= 0; r--) for (let c = 0; c < chart[r]!.length; c++) {
   const v = chart[r]![c]!, label = "Row " + (r + 1) + ", column " + (c + 1) + " from the left: " + v;
   const cell = h("button.study-cell", { type: "button", "aria-label": label, "aria-pressed": "false" }, v === "purl" ? h("span.dot", { "aria-hidden": "true" }) : "");
   cell.addEventListener("click", () => {
    grid.querySelectorAll("[aria-pressed=true]").forEach((el) => el.setAttribute("aria-pressed", "false"));
    cell.setAttribute("aria-pressed", "true");
    const w=data.messageWindow, inside=c>=w.leftCol && c<=w.rightCol && r+1>=w.bottomRow && r+1<=w.topRow;
    info.textContent = label + ". " + (inside ? "Inside the documented message window." : "In the surrounding fabric.") + " This is a visible right-side outcome, not a needle action.";
   }); grid.append(cell);
  }
  stage.replaceChildren(grid); evidence.textContent="LOGGED / CHART REBUILT FROM WRITTEN ROWS, NOT A PHOTO TRACE.";
  info.textContent="Select a cell. Row 1 sits at the bottom. Columns count from the left for inspection.";
 } else {
  stage.replaceChildren(n ? drawing(chart.slice(0,n), "Drawn study: " + n + " rows remaining") : h("p.mono", {}, "CAST-ON EDGE / NO COMPLETED ROWS"));
  const svg = stage.querySelector("svg");
  if(svg && mode!=="inspection"){
   const w=Number(svg.getAttribute("width")), g=document.createElementNS("http://www.w3.org/2000/svg","g");
   g.setAttribute("aria-hidden","true");
   if(mode==="needles"){
    const needle=document.createElementNS(g.namespaceURI,"line");
    for(const [key,val] of Object.entries({x1:"4",y1:"7",x2:String(w-4),y2:"7",stroke:"currentColor","stroke-width":"3"}))needle.setAttribute(key,val);
    g.append(needle);
   }
   const thread=document.createElementNS(g.namespaceURI,"path");
   thread.setAttribute("d","M "+(w-9)+" 7 Q "+(w-28)+" 24 "+(w-8)+" 40");
   thread.setAttribute("fill","none");thread.setAttribute("stroke","var(--red)");thread.setAttribute("stroke-width","2");g.append(thread);svg.append(g);
  }
  evidence.textContent=mode==="inspection" ? "X / DRAWING REBUILT FROM THE WRITTEN PATTERN." : "X / DRAWN ROW SEQUENCE. PHOTOGRAPHED FRAMES ARE STILL TO COME.";
  const a=actions[n-1];
  info.textContent=mode==="inspection" ? data.provenance : mode==="frog" ? "Removing rows from the top reverses making; the key reads whichever message stitches still remain. " + n + " rows remain." : a ? "Row "+n+": "+a.side+", "+a.read+". Needle actions: "+a.actions.map((x)=>x.stitch.toUpperCase()).join(" ")+". Drawing shows the right side." : "Cast-on is not counted as a knitting row.";
 }
 updateReading(n);
 revealBox.hidden = mode !== "inspection";
 modes.querySelectorAll("button").forEach((b)=>b.setAttribute("aria-pressed",String(b.dataset.mode===mode)));
 views.querySelectorAll<HTMLButtonElement>("button[data-layer]").forEach((b)=>b.setAttribute("aria-pressed",String(b.dataset.layer===layer)));
}

for(const [id,title] of [["inspection","Inspection table"],["needles","On the needles"],["frog","Pull the thread"]]){
 const b=button(title!,()=>{stop();const previous=mode;mode=id!;if(previous==="inspection" && mode!=="inspection")row.value=mode==="needles"?"0":String(chart.length);render();});b.dataset.mode=id;modes.append(b);
}
for(const [id,title] of [["photo","Photograph"],["drawing","Stitch drawing"],["chart","Chart"]]){
 const b=button(title!,()=>{layer=id!;row.value=String(chart.length);render();});b.dataset.layer=id;views.append(b);
}
views.append(h("button.btn",{type:"button",disabled:true},"Hand trace: awaiting capture"));
row.addEventListener("input",()=>{stop();render();});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
const reveal=h("p.study-letter",{hidden:true},data.message);
const revealBox=h("div",{},button("Reveal the intended message",()=>{reveal.hidden=false;}),reveal,h("p.hint",{},"The intended message is not a verified physical read-back."));
const notes=h("aside.study-card",{},h("span.mono",{},"SW01 / 30 SEPTEMBER 2026"),h("h3",{},data.title),liveReading,
 h("p",{},"Knit/purl relief. 20 stitches, flat, garter frame. Fuzzy blue yarn with a metallic thread."),
 h("p",{},"The same cloth can be an object, a pattern and a message."),
 revealBox,
 h("a",{href:"./decode.html"},"Open the decoder "));
document.getElementById("study-gallery")!.append(modes,h("div.study-grid",{},h("div",{},views,stage,evidence,h("label",{},rowText,row),play,info),notes));render();
const asset=(name:string,alt:string)=>h("img",{src:url("development/assets/"+name+".svg"),alt,loading:"lazy"});
const letter=h("input",{type:"text",maxlength:1,value:"L","aria-label":"Letter to encode"}) as HTMLInputElement;
const bits=h("div.study-bits"),small=h("div"),read=h("p.mono",{"aria-live":"polite"});
function updateLetter():void{
 const text=letter.value.toUpperCase();
 if(!/^[A-Z]$/.test(text)){bits.replaceChildren();small.replaceChildren();read.textContent="Enter one letter A to Z.";return;}
 const b=encode(text);bits.replaceChildren(...b.map((v)=>h("span.study-bit",{},String(v))));
 small.replaceChildren(drawing([b.map((v)=>v?"purl":"knit")],"Five visible cells for "+text));
 read.textContent="Read back: "+decode(b).text+". Encoding changes representation.";
}
letter.addEventListener("input",updateLetter);updateLetter();
const shift=h("input.study-row",{type:"range",min:0,max:25,value:3,"aria-label":"Caesar shift"}) as HTMLInputElement;
const cipher=h("p.study-letter"),back=h("p.mono",{"aria-live":"polite"});
function updateCipher():void{
 const setting={kind:"caesar" as const,key:shift.value},text=encipher("MEET",setting);
 cipher.textContent=text;back.textContent="Shift "+shift.value+": MEET  "+text+"  "+decipher(text,setting)+". Historical / puzzle cipher, not modern security.";
}
shift.addEventListener("input",updateCipher);updateCipher();

document.getElementById("study-lessons")!.append(h("div.study-lesson-grid",{},
 h("article.study-card",{},h("span.mono",{},"01 / ENCODE AND READ"),h("h3",{},"A letter becomes five states"),h("label",{},"Choose a letter ",letter),bits,small,read,asset("stitch-states","Knit and purl visible states")),
 h("article.study-card",{},h("span.mono",{},"02 / CHANGE THE MESSAGE"),h("h3",{},"Shift, then reverse"),cipher,h("label",{},"Caesar shift ",shift),back),
 h("article.study-card",{},h("span.mono",{},"03 / HIDE THE LOCATION"),h("h3",{},"A reading mask"),asset("reading-mask","A schematic route selects five cells among filler"),h("p",{},"A hiding key tells the reader where to look. Finding the cells and understanding their contents are separate operations."),h("p.study-evidence",{},"X / SCHEMATIC, NOT A HISTORICAL KNITTING CODE.")),
 h("article.study-card",{},h("span.mono",{},"04 / ENCRYPT BEFORE THE CARRIER"),h("h3",{},"Data before fabric"),asset("pipeline","Message, optional encryption, symbols and fabric"),h("p",{},"Secure mode uses the existing browser encryption engine. Reading stitches recovers encoded data; a passphrase is needed to decrypt it."),h("p.hint",{},"Process diagram; a live encrypted-data animation follows in development."),h("a",{href:"./lab.html"},"Explore the lab "))
));
