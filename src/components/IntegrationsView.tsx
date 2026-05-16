import { Database, ExternalLink, Loader2, MonitorUp, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";

interface IntegrationsViewProps {
  youtubeConnected: boolean;
  onYoutubeConnectedChange: (connected: boolean) => void;
  settings: Settings;
  onSettingsUpdated: (settings: Settings) => void;
  onNotice: (msg: string) => void;
}

const PLANNED_INTEGRATIONS = [
  { name: "Notion", icon: Database },
];

export function IntegrationsView({
  youtubeConnected,
  onYoutubeConnectedChange,
  settings,
  onSettingsUpdated,
  onNotice,
}: IntegrationsViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [clientId, setClientId] = useState(settings.youtubeClientId);
  const [clientSecret, setClientSecret] = useState(settings.youtubeClientSecret);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setClientId(settings.youtubeClientId);
    setClientSecret(settings.youtubeClientSecret);
  }, [settings.youtubeClientId, settings.youtubeClientSecret]);

  const saveCredentials = async () => {
    setIsSaving(true);
    try {
      const updated = await invoke<Settings>("save_settings", {
        settings: { ...settings, youtubeClientId: clientId.trim(), youtubeClientSecret: clientSecret.trim() },
      });
      onSettingsUpdated(updated);
      onNotice("Credenciais salvas.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const connectYoutube = async () => {
    setIsConnecting(true);
    try {
      await saveCredentials();
      await invoke("connect_youtube");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectYoutube = async () => {
    try {
      await invoke("disconnect_youtube");
      onYoutubeConnectedChange(false);
      onNotice("Conta YouTube desconectada.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const credentialsReady = clientId.trim().length > 0 && clientSecret.trim().length > 0;

  return (
    <div className="integrations-page">
      <div className="integrations-view">
        {/* YouTube — card real com status */}
        <section
          className={`integration-card${expanded ? " integration-card--active" : ""}`}
          key="YouTube"
        >
          <div>
            <MonitorUp size={22} />
            <strong>YouTube</strong>
            <span>{youtubeConnected ? "Conectado" : "Desconectado"}</span>
          </div>
          <button className="secondary-button" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Fechar" : "Configurar"} <ExternalLink size={15} />
          </button>
        </section>

        {/* Demais integrações planejadas */}
        {PLANNED_INTEGRATIONS.map(({ name, icon: Icon }) => (
          <section className="integration-card" key={name}>
            <div>
              <Icon size={22} />
              <strong>{name}</strong>
              <span>Planejado</span>
            </div>
            <button className="secondary-button" disabled>
              Configurar <ExternalLink size={15} />
            </button>
          </section>
        ))}
      </div>

      {/* Painel de configuração do YouTube — expande abaixo do grid */}
      {expanded && (
        <section className="settings-section">
          <div className="panel-heading">
            <div>
              <span>OAuth 2.0</span>
              <h2>Credenciais do Google</h2>
            </div>
            <div className="button-row inline">
              <button className="primary-button compact" onClick={saveCredentials} disabled={isSaving}>
                {isSaving && <Loader2 className="spin" size={14} />}
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "12px", margin: "0 0 12px" }}>
            Crie um projeto no{" "}
            <strong>Google Cloud Console</strong>, ative a{" "}
            <strong>YouTube Data API v3</strong> e gere credenciais OAuth 2.0 do tipo{" "}
            <strong>App de desktop</strong>.
          </p>
          <div className="settings-grid">
            <label className="span-two">
              <span>Client ID</span>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Obtido no Google Cloud Console"
              />
            </label>
            <label className="span-two">
              <span>Client Secret</span>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Obtido no Google Cloud Console"
              />
            </label>
          </div>

          <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
            {youtubeConnected ? (
              <button className="secondary-button danger" onClick={disconnectYoutube}>
                Desconectar conta
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={!credentialsReady || isConnecting}
                onClick={connectYoutube}
              >
                {isConnecting && <Loader2 className="spin" size={14} />}
                <ExternalLink size={14} /> Conectar com Google
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
