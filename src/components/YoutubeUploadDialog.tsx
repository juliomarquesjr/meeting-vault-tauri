import { Loader2, MonitorUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Meeting } from "../types";

interface YoutubeUploadDialogProps {
  open: boolean;
  meeting: Meeting;
  onConfirm: (title: string, description: string, privacy: string, deleteLocal: boolean) => void;
  onCancel: () => void;
  loading: boolean;
}

export function YoutubeUploadDialog({
  open,
  meeting,
  onConfirm,
  onCancel,
  loading
}: YoutubeUploadDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState("unlisted");
  const [deleteLocal, setDeleteLocal] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(meeting.title);
      setDescription("");
      setPrivacy("unlisted");
      setDeleteLocal(false);
    }
  }, [open, meeting.title]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" onMouseDown={() => !loading && onCancel()}>
      <section className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="confirm-dialog-header">
          <span className="confirm-dialog-icon">
            <MonitorUp size={18} />
          </span>
          <div>
            <h2>Publicar no YouTube</h2>
            <p>Preencha os detalhes do video antes de enviar.</p>
          </div>
          <button className="icon-button" onClick={onCancel} disabled={loading} title="Fechar">
            <X size={16} />
          </button>
        </header>

        <div className="confirm-dialog-detail">
          <div className="settings-grid">
            <label className="span-two">
              <span>Titulo</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titulo do video no YouTube"
                disabled={loading}
              />
            </label>
            <label className="span-two">
              <span>Descricao</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descricao opcional do video"
                rows={3}
                disabled={loading}
                style={{ resize: "vertical" }}
              />
            </label>
            <label>
              <span>Privacidade</span>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                disabled={loading}
              >
                <option value="private">Privado</option>
                <option value="unlisted">Nao listado</option>
                <option value="public">Publico</option>
              </select>
            </label>
            <label className="toggle-row span-two">
              <input
                type="checkbox"
                checked={deleteLocal}
                onChange={(e) => setDeleteLocal(e.target.checked)}
                disabled={loading}
              />
              <span>Apagar arquivo local apos publicacao</span>
            </label>
          </div>
        </div>

        <footer className="confirm-dialog-actions">
          <button className="secondary-button" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            className="primary-button"
            onClick={() => onConfirm(title.trim() || meeting.title, description, privacy, deleteLocal)}
            disabled={loading || !title.trim()}
          >
            {loading && <Loader2 className="spin" size={15} />}
            Publicar
          </button>
        </footer>
      </section>
    </div>
  );
}
