import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
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
          <span className={destructive ? "confirm-dialog-icon danger" : "confirm-dialog-icon"}>
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{message}</p>
          </div>
          <button className="icon-button" onClick={onCancel} disabled={loading} title="Fechar">
            <X size={16} />
          </button>
        </header>

        {detail && <div className="confirm-dialog-detail">{detail}</div>}

        <footer className="confirm-dialog-actions">
          <button className="secondary-button" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={destructive ? "primary-button danger" : "primary-button"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="spin" size={15} />}
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
