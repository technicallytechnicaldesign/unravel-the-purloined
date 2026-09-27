import "./style.css";
import { mountEncoder } from "./ui/encode";
import { mountDecoder } from "./ui/decode";
import { mountDesigner } from "./ui/designer";

const decoder = mountDecoder(document.querySelector<HTMLElement>("#decoder")!);
const encoder = mountEncoder(document.querySelector<HTMLElement>("#encoder")!, (p) => decoder.load(p));
mountDesigner(document.querySelector<HTMLElement>("#designer")!, (a) => {
  encoder.useAlphabet(a);
  decoder.useAlphabet(a);
  document.querySelector("#enc-h")!.scrollIntoView({ behavior: "smooth" });
});
