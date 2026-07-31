import { createRoot } from "react-dom/client";
import "../app/globals.css";
import Page from "../app/page";
import "./raavi-desktop";

const storageKey = "raavi:theme:v1";

try {
  const storedTheme = window.localStorage.getItem(storageKey);
  const theme =
    storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
} catch {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
}

const root = document.getElementById("root");
if (!root) throw new Error("Raavi root element is missing.");

createRoot(root).render(<Page />);
