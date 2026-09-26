import "./style.css";
import { mountEncoder } from "./ui/encode";
import { mountDecoder } from "./ui/decode";

const decoder = mountDecoder(document.querySelector<HTMLElement>("#decoder")!);
mountEncoder(document.querySelector<HTMLElement>("#encoder")!, (p) => decoder.load(p));
