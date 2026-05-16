import { useEffect, useState } from "react";
import { Video, X } from "lucide-react";

const COUNTDOWN_SECONDS = 15;

interface MeetDetectedPromptProps {
  meetingTitle: string;
  onStart: (title: string) => void;
  onDismiss: () => void;
  standalone?: boolean;
}

export default function MeetDetectedPrompt({ meetingTitle, onStart, onDismiss, standalone }: MeetDetectedPromptProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className={`meet-prompt${standalone ? " meet-prompt--standalone" : ""}`} role="alertdialog" aria-label="Reuniao detectada">
      <div className="meet-prompt__header">
        <div className="meet-prompt__icon">
          <Video size={16} />
        </div>
        <span className="meet-prompt__label">Reuniao detectada</span>
        <button className="meet-prompt__close" onClick={onDismiss} aria-label="Ignorar">
          <X size={14} />
        </button>
      </div>
      <p className="meet-prompt__title">{meetingTitle || "Google Meet"}</p>
      <div className="meet-prompt__actions">
        <button className="primary-button compact" onClick={() => onStart(meetingTitle)}>
          Iniciar gravacao
        </button>
        <button className="secondary-button compact" onClick={onDismiss}>
          Ignorar
        </button>
      </div>
      <div
        className="meet-prompt__countdown-bar"
        style={{ width: `${(countdown / COUNTDOWN_SECONDS) * 100}%` }}
      />
    </div>
  );
}
