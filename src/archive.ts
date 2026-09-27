import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { mountArchive } from "./ui/archive";

mountWordmarks();
mountArchive(document.querySelector<HTMLElement>("#archive")!);
