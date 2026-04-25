import "./styles.css";
import { EditorApp } from "./app/EditorApp";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root is missing.");

const editorApp = new EditorApp(app);
void editorApp.boot();
