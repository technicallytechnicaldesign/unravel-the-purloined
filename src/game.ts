import "./style.css";
import { mountWordmarks } from "./ui/wordmark";
import { mountGame } from "./ui/game";

mountWordmarks();
mountGame(document.querySelector<HTMLElement>("#game")!);
