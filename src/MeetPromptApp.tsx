import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import MeetDetectedPrompt from "./components/MeetDetectedPrompt";

export default function MeetPromptApp() {
  const [title, setTitle] = useState("Reuniao Google Meet");

  useEffect(() => {
    document.body.style.background = "transparent";
    const t = new URLSearchParams(window.location.search).get("title");
    if (t) setTitle(decodeURIComponent(t));
  }, []);

  return (
    <div className="meet-prompt-root">
      <MeetDetectedPrompt
        standalone
        meetingTitle={title}
        onStart={(t) => invoke("accept_meet_prompt", { title: t })}
        onDismiss={() => invoke("dismiss_meet_prompt")}
      />
    </div>
  );
}
