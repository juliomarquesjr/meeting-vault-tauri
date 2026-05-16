import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import MeetPromptApp from "./MeetPromptApp";
import "./styles.css";

const isPromptMode = new URLSearchParams(window.location.search).get("mode") === "meet-prompt";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    {isPromptMode ? <MeetPromptApp /> : <App />}
  </StrictMode>
);
