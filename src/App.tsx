import {
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  Database,
  ExternalLink,
  FolderOpen,
  Gauge,
  HardDrive,
  Hash,
  Home,
  Layers3,
  Library,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  MonitorUp,
  Pencil,
  Play,
  RefreshCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Square,
  Tag,
  Trash2,
  Video,
  Workflow,
  X
} from "lucide-react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { Meeting, ProcessingProgress, SaveRecordingInput, Settings } from "./types";

type View = "dashboard" | "library" | "taxonomy" | "settings" | "video" | "integrations";

const defaultSettings: Settings = {
  apiKey: "",
  processingMode: "local",
  transcriptionModel: "gpt-4o-mini-transcribe",
  language: "pt",
  ffmpegPath: "ffmpeg",
  whisperCliPath: "whisper-cli",
  whisperModelPath: "",
  whisperThreads: 8,
  videoFileExtension: "webm",
  qualityPreset: "balanced",
  resolution: "1080p",
  frameRate: 24,
  videoBitsPerSecond: 2_400_000,
  audioBitsPerSecond: 128_000,
  captureSystemAudio: true,
  autoTranscribe: false
};

const defaultCategories = ["Cliente", "Interna", "Produto", "Comercial", "Treinamento", "Suporte"];

const viewMeta: Record<View, { eyebrow: string; title: string; subtitle: string }> = {
  dashboard: {
    eyebrow: "Visao operacional",
    title: "Dashboard",
    subtitle: "Resumo de gravacoes, armazenamento, transcricoes e atividade recente."
  },
  library: {
    eyebrow: "Arquivo central",
    title: "Biblioteca",
    subtitle: "Organize reunioes por categoria, tags, status e conteudo pesquisavel."
  },
  taxonomy: {
    eyebrow: "Organizacao",
    title: "Categorias e tags",
    subtitle: "Acompanhe a taxonomia usada para localizar reunioes rapidamente."
  },
  settings: {
    eyebrow: "Sistema",
    title: "Configuracoes",
    subtitle: "Chaves, modelos de IA, idioma e comportamento automatico."
  },
  video: {
    eyebrow: "Captura",
    title: "Video e qualidade",
    subtitle: "Formato, resolucao, taxa de quadros, bitrate e audio da gravacao."
  },
  integrations: {
    eyebrow: "Conectores",
    title: "Integracoes",
    subtitle: "Preparado para calendario, chamadas, notas, CRM e automacoes."
  }
};

const navGroups: Array<{
  label: string;
  items: Array<{ view: View; label: string; icon: typeof Home }>;
}> = [
  {
    label: "Operacao",
    items: [
      { view: "dashboard", label: "Dashboard", icon: Home },
      { view: "library", label: "Biblioteca", icon: Library }
    ]
  },
  {
    label: "Organizacao",
    items: [{ view: "taxonomy", label: "Categorias e tags", icon: Tag }]
  },
  {
    label: "Sistema",
    items: [
      { view: "settings", label: "Configuracoes", icon: SettingsIcon },
      { view: "video", label: "Video e qualidade", icon: SlidersHorizontal },
      { view: "integrations", label: "Integracoes", icon: Workflow }
    ]
  }
];

const qualityPresets: Record<
  string,
  { label: string; videoBitsPerSecond: number; audioBitsPerSecond: number }
> = {
  compact: { label: "Compacta", videoBitsPerSecond: 1_400_000, audioBitsPerSecond: 96_000 },
  balanced: { label: "Equilibrada", videoBitsPerSecond: 2_400_000, audioBitsPerSecond: 128_000 },
  high: { label: "Alta qualidade", videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 160_000 },
  archive: { label: "Arquivo premium", videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 }
};

function defaultMeetingTitle() {
  return `Reuniao ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date())}`;
}

function parseTags(value: string) {
  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .filter((tag, index, list) => list.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index);
}

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function statusLabel(meeting: Meeting) {
  if (meeting.status === "processing" && meeting.progressMessage) return meeting.progressMessage;
  if (meeting.status === "completed") return "Transcrita";
  if (meeting.status === "processing") return "Processando";
  if (meeting.status === "error") return "Revisar erro";
  return "Gravada";
}

function resolutionDimensions(resolution: string) {
  if (resolution === "720p") return { width: 1280, height: 720 };
  if (resolution === "1440p") return { width: 2560, height: 1440 };
  return { width: 1920, height: 1080 };
}

function recorderOptions(settings: Settings): MediaRecorderOptions {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
  return {
    mimeType,
    videoBitsPerSecond: settings.videoBitsPerSecond || defaultSettings.videoBitsPerSecond,
    audioBitsPerSecond: settings.audioBitsPerSecond || defaultSettings.audioBitsPerSecond
  };
}

function App() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [tagFilter, setTagFilter] = useState("Todas");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(defaultSettings);
  const [recordingTitle, setRecordingTitle] = useState(defaultMeetingTitle);
  const [recordingCategory, setRecordingCategory] = useState(defaultCategories[0]);
  const [recordingTags, setRecordingTags] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [titleDraft, setTitleDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [notice, setNotice] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<Date | null>(null);
  const timerRef = useRef<number | null>(null);

  const categories = useMemo(() => {
    return Array.from(
      new Set([...defaultCategories, ...meetings.map((meeting) => meeting.category).filter(Boolean)])
    ).sort((a, b) => a.localeCompare(b));
  }, [meetings]);

  const tags = useMemo(() => {
    return Array.from(new Set(meetings.flatMap((meeting) => meeting.tags))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [meetings]);

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedId) ?? meetings[0],
    [meetings, selectedId]
  );

  const filteredMeetings = useMemo(() => {
    const term = query.trim().toLowerCase();
    return meetings.filter((meeting) => {
      const matchesCategory = categoryFilter === "Todas" || meeting.category === categoryFilter;
      const matchesTag = tagFilter === "Todas" || meeting.tags.includes(tagFilter);
      const haystack = [
        meeting.title,
        meeting.category,
        meeting.transcript,
        ...meeting.tags,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !term || haystack.includes(term);
      return matchesCategory && matchesTag && matchesQuery;
    });
  }, [categoryFilter, meetings, query, tagFilter]);

  const stats = useMemo(() => {
    const totalDuration = meetings.reduce((sum, meeting) => sum + meeting.durationSeconds, 0);
    const totalSize = meetings.reduce((sum, meeting) => sum + meeting.sizeBytes, 0);
    const summarized = meetings.filter((meeting) => meeting.transcript).length;
    const processing = meetings.filter((meeting) => meeting.status === "processing").length;
    const error = meetings.filter((meeting) => meeting.status === "error").length;
    const avgDuration = meetings.length ? totalDuration / meetings.length : 0;
    return { totalDuration, totalSize, summarized, processing, error, avgDuration };
  }, [meetings]);

  const recentMeetings = useMemo(() => meetings.slice(0, 5), [meetings]);
  const currentMeta = viewMeta[view];

  const refreshMeetings = useCallback(async () => {
    const loaded = await invoke<Meeting[]>("list_meetings");
    setMeetings(loaded);
    setSelectedId((current) => current || loaded[0]?.id || "");
  }, []);

  const refreshSettings = useCallback(async () => {
    const loaded = await invoke<Settings>("get_settings");
    const merged = { ...defaultSettings, ...loaded };
    setSettings(merged);
    setSettingsDraft(merged);
  }, []);

  const transcribeMeeting = useCallback(
    async (meeting: Meeting) => {
      if (settings.processingMode === "api" && !settings.apiKey.trim()) {
        setView("settings");
        setNotice("Configure a chave da API antes de transcrever.");
        return;
      }

      setProcessingIds((current) => new Set(current).add(meeting.id));
      setMeetings((current) =>
        current.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                status: "processing",
                progressMessage: "Iniciando transcricao",
                progressPercent: 1
              }
            : item
        )
      );
      setNotice("");
      try {
        const updated = await invoke<Meeting>("transcribe_meeting", { id: meeting.id });
        setMeetings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedId(updated.id);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
        await refreshMeetings();
      } finally {
        setProcessingIds((current) => {
          const next = new Set(current);
          next.delete(meeting.id);
          return next;
        });
      }
    },
    [refreshMeetings, settings.apiKey]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return;

    setNotice("");
    const { width, height } = resolutionDimensions(settings.resolution);
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: settings.frameRate, max: Math.max(settings.frameRate, 30) },
        width: { ideal: width, max: width },
        height: { ideal: height, max: height }
      },
      audio: settings.captureSystemAudio
    });

    streamRef.current = stream;
    chunksRef.current = [];
    startedAtRef.current = new Date();

    const recorder = new MediaRecorder(stream, recorderOptions(settings));
    recorderRef.current = recorder;

    stream.getVideoTracks()[0]?.addEventListener("ended", () => stopRecording(), { once: true });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = async () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const startedAt = startedAtRef.current ?? new Date();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });

      try {
        const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
        const input: SaveRecordingInput = {
          title: recordingTitle.trim() || defaultMeetingTitle(),
          category: recordingCategory,
          tags: parseTags(recordingTags),
          startedAt: startedAt.toISOString(),
          durationSeconds,
          mimeType: blob.type || "video/webm",
          fileExtension: settings.videoFileExtension,
          bytes
        };
        const saved = await invoke<Meeting>("save_recording", { input });
        setMeetings((current) => [saved, ...current.filter((meeting) => meeting.id !== saved.id)]);
        setSelectedId(saved.id);
        setView("library");
        setRecordingTitle(defaultMeetingTitle());
        setRecordingTags("");

        if (
          settings.autoTranscribe &&
          (settings.processingMode !== "api" || settings.apiKey.trim())
        ) {
          void transcribeMeeting(saved);
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        recorderRef.current = null;
        chunksRef.current = [];
        startedAtRef.current = null;
        setElapsed(0);
        setIsRecording(false);
      }
    };

    recorder.start(1000);
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      const startedAt = startedAtRef.current?.getTime() ?? Date.now();
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 500);
  }, [
    transcribeMeeting,
    recordingCategory,
    recordingTags,
    recordingTitle,
    settings,
    stopRecording
  ]);

  const saveSettings = useCallback(async () => {
    const saved = await invoke<Settings>("save_settings", { settings: settingsDraft });
    const merged = { ...defaultSettings, ...saved };
    setSettings(merged);
    setSettingsDraft(merged);
    setNotice("Configuracao salva.");
  }, [settingsDraft]);

  const saveMetadata = useCallback(async () => {
    if (!selectedMeeting) return;
    const updated = await invoke<Meeting>("update_meeting_metadata", {
      id: selectedMeeting.id,
      title: titleDraft.trim() || selectedMeeting.title,
      category: categoryDraft.trim(),
      tags: parseTags(tagsDraft)
    });
    setMeetings((current) => current.map((meeting) => (meeting.id === updated.id ? updated : meeting)));
    setSelectedId(updated.id);
    setNotice("Metadados atualizados.");
  }, [categoryDraft, selectedMeeting, tagsDraft, titleDraft]);

  const deleteMeeting = useCallback(async () => {
    if (!selectedMeeting) return;
    await invoke("delete_meeting", { id: selectedMeeting.id });
    const remaining = meetings.filter((meeting) => meeting.id !== selectedMeeting.id);
    setMeetings(remaining);
    setSelectedId(remaining[0]?.id || "");
  }, [meetings, selectedMeeting]);

  const updateQualityPreset = useCallback((preset: string) => {
    const profile = qualityPresets[preset] ?? qualityPresets.balanced;
    setSettingsDraft((current) => ({
      ...current,
      qualityPreset: preset,
      videoBitsPerSecond: profile.videoBitsPerSecond,
      audioBitsPerSecond: profile.audioBitsPerSecond
    }));
  }, []);

  useEffect(() => {
    refreshMeetings().catch((error) => setNotice(String(error)));
    refreshSettings().catch((error) => setNotice(String(error)));
  }, [refreshMeetings, refreshSettings]);

  useEffect(() => {
    const unlisten = Promise.all([
      listen("tray-start-recording", () => {
        startRecording().catch((error) => setNotice(String(error)));
      }),
      listen("tray-stop-recording", () => stopRecording()),
      listen("tray-open-library", () => setView("library")),
      listen<ProcessingProgress>("processing-progress", (event) => {
        const progress = event.payload;
        setMeetings((current) =>
          current.map((meeting) =>
            meeting.id === progress.id
              ? {
                  ...meeting,
                  status: progress.status,
                  progressMessage: progress.message,
                  progressPercent: progress.percent
                }
              : meeting
          )
        );
      })
    ]);

    return () => {
      unlisten.then((callbacks) => callbacks.forEach((callback) => callback()));
    };
  }, [startRecording, stopRecording]);

  useEffect(() => {
    if (!selectedMeeting) return;
    setTitleDraft(selectedMeeting.title);
    setCategoryDraft(selectedMeeting.category || "");
    setTagsDraft(selectedMeeting.tags.join(", "));
  }, [selectedMeeting]);

  const startDraggingWindow = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-no-window-drag]")) return;
    invoke("start_dragging_window").catch((error) => console.error("Failed to drag window", error));
  }, []);

  const renderWindowControls = () => (
    <div className="window-controls">
      <button onClick={() => invoke("minimize_window")} title="Minimizar">
        <Minimize2 size={15} />
      </button>
      <button onClick={() => invoke("toggle_maximize_window")} title="Maximizar">
        <Maximize2 size={15} />
      </button>
      <button className="close" onClick={() => invoke("hide_window")} title="Ocultar">
        <X size={16} />
      </button>
    </div>
  );

  const renderRecordingPanel = (variant: "compact" | "wide") => (
    <section className={`recording-module ${variant}`}>
      <div className="panel-heading">
        <div>
          <span>Captura</span>
          <h2>{isRecording ? "Gravacao em andamento" : "Nova gravacao"}</h2>
        </div>
        <div className="recording-state">
          <span className={isRecording ? "live-dot active" : "live-dot"} />
          <strong>{isRecording ? formatDuration(elapsed) : `${settings.resolution} · ${settings.frameRate} fps`}</strong>
        </div>
      </div>

      <div className="recording-form">
        <label>
          <span>Titulo</span>
          <input
            value={recordingTitle}
            onChange={(event) => setRecordingTitle(event.target.value)}
            disabled={isRecording}
          />
        </label>
        <label>
          <span>Categoria</span>
          <select
            value={recordingCategory}
            onChange={(event) => setRecordingCategory(event.target.value)}
            disabled={isRecording}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="wide-field">
          <span>Tags</span>
          <input
            value={recordingTags}
            onChange={(event) => setRecordingTags(event.target.value)}
            placeholder="cliente, proposta, sprint"
            disabled={isRecording}
          />
        </label>
      </div>

      <div className="button-row">
        <button
          className={isRecording ? "primary-button danger" : "primary-button"}
          onClick={() => (isRecording ? stopRecording() : startRecording())}
        >
          {isRecording ? <Square size={17} /> : <Video size={17} />}
          <span>{isRecording ? "Finalizar gravacao" : "Iniciar gravacao"}</span>
        </button>
      </div>
    </section>
  );

  const renderDashboard = () => (
    <div className="dashboard-view">
      <section className="dashboard-frame metrics-frame">
        <div className="panel-heading">
          <div>
            <span>Indicadores</span>
            <h2>Resumo operacional</h2>
          </div>
          <div className="button-row inline">
            <button className="secondary-button" onClick={() => setView("library")}>
              <Library size={16} />
              <span>Biblioteca</span>
            </button>
            <button className="secondary-button" onClick={() => setView("settings")}>
              <SettingsIcon size={16} />
              <span>Configurar</span>
            </button>
          </div>
        </div>
        <div className="metric-grid">
          <div className="metric-tile">
            <Library size={18} />
            <span>Reunioes</span>
            <strong>{meetings.length}</strong>
          </div>
          <div className="metric-tile">
            <Clock3 size={18} />
            <span>Tempo gravado</span>
            <strong>{formatDuration(stats.totalDuration)}</strong>
          </div>
          <div className="metric-tile">
            <Bot size={18} />
            <span>Transcritas</span>
            <strong>{stats.summarized}</strong>
          </div>
          <div className="metric-tile">
            <HardDrive size={18} />
            <span>Armazenamento</span>
            <strong>{formatBytes(stats.totalSize)}</strong>
          </div>
        </div>

        <div className="summary-card-grid">
          <section className="summary-card">
            <div className="panel-heading">
              <div>
                <span>Pipeline</span>
                <h2>Estado da biblioteca</h2>
              </div>
              <BarChart3 size={20} />
            </div>
            <div className="pipeline-list">
              <div>
                <CheckCircle2 size={17} />
                <span>Transcritas</span>
                <strong>{stats.summarized}</strong>
              </div>
              <div>
                <Loader2 size={17} />
                <span>Processando</span>
                <strong>{stats.processing}</strong>
              </div>
              <div>
                <AlertTriangle size={17} />
                <span>Com erro</span>
                <strong>{stats.error}</strong>
              </div>
              <div>
                <Gauge size={17} />
                <span>Duracao media</span>
                <strong>{formatDuration(stats.avgDuration)}</strong>
              </div>
            </div>
          </section>

          <section className="summary-card">
            <div className="panel-heading">
              <div>
                <span>Taxonomia</span>
                <h2>Organizacao atual</h2>
              </div>
              <Tag size={20} />
            </div>
            <div className="taxonomy-summary">
              <div>
                <strong>{categories.length}</strong>
                <span>Categorias</span>
              </div>
              <div>
                <strong>{tags.length}</strong>
                <span>Tags</span>
              </div>
            </div>
            <div className="tag-cloud">
              {tags.slice(0, 10).map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
              {!tags.length && <span>sem tags</span>}
            </div>
          </section>
        </div>
      </section>

      <section className="dashboard-frame actions-frame">
        <div className="panel-heading">
          <div>
            <span>Operacao</span>
            <h2>Gravacao e atividade</h2>
          </div>
          <div className="button-row inline">
            <button className="secondary-button" onClick={() => setView("video")}>
              <SlidersHorizontal size={16} />
              <span>Qualidade</span>
            </button>
          </div>
        </div>

        <div className="action-card-grid">
          {renderRecordingPanel("wide")}

          <section className="summary-card recent-card">
          <div className="panel-heading">
            <div>
              <span>Atividade</span>
              <h2>Reunioes recentes</h2>
            </div>
            <div className="button-row inline">
              <button className="secondary-button" onClick={() => setView("library")}>
                Ver biblioteca <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="recent-list">
            {recentMeetings.length ? (
              recentMeetings.map((meeting) => (
                <button
                  key={meeting.id}
                  className="recent-row"
                  onClick={() => {
                    setSelectedId(meeting.id);
                    setView("library");
                  }}
                >
                  <span className="status-line" data-status={meeting.status} />
                  <div>
                    <strong>{meeting.title}</strong>
                    <small>
                      {meeting.status === "processing"
                        ? `${meeting.progressMessage || "Processando"} · ${Math.round(meeting.progressPercent || 0)}%`
                        : `${formatDate(meeting.startedAt)} · ${meeting.category || "Sem categoria"}`}
                    </small>
                  </div>
                  <span>{formatDuration(meeting.durationSeconds)}</span>
                </button>
              ))
            ) : (
              <div className="empty-state compact">
                <Video size={22} />
                <strong>Nenhuma reuniao gravada</strong>
              </div>
            )}
          </div>
        </section>
        </div>
      </section>
    </div>
  );

  const renderMeetingDetail = () => {
    if (!selectedMeeting) {
      return (
        <div className="empty-state large">
          <Video size={34} />
          <strong>Selecione ou grave uma reuniao</strong>
          <span>A biblioteca exibira player, transcricao e metadados.</span>
        </div>
      );
    }

    return (
      <section className="detail-workspace">
        <div className="detail-top">
          <div className="metadata-editor">
            <label>
              <span>Titulo</span>
              <input value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
            </label>
            <label>
              <span>Categoria</span>
              <input
                value={categoryDraft}
                onChange={(event) => setCategoryDraft(event.target.value)}
                list="category-options"
              />
              <datalist id="category-options">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <label className="span-two">
              <span>Tags</span>
              <input
                value={tagsDraft}
                onChange={(event) => setTagsDraft(event.target.value)}
                placeholder="Separadas por virgula"
              />
            </label>
          </div>
          <div className="detail-actions">
            <button className="secondary-button" onClick={saveMetadata}>
              <Pencil size={16} /> Salvar metadados
            </button>
            <button
              className="secondary-button"
              onClick={() => invoke("open_recording", { id: selectedMeeting.id })}
            >
              <Play size={16} /> Assistir
            </button>
            <button
              className="secondary-button"
              onClick={() => invoke("reveal_recording", { id: selectedMeeting.id })}
            >
              <FolderOpen size={16} /> Pasta
            </button>
            <button className="icon-button danger" onClick={deleteMeeting} title="Excluir">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="detail-meta">
          <span><CalendarDays size={15} />{formatDate(selectedMeeting.startedAt)}</span>
          <span><Clock3 size={15} />{formatDuration(selectedMeeting.durationSeconds)}</span>
          <span><HardDrive size={15} />{formatBytes(selectedMeeting.sizeBytes)}</span>
          <span><BadgeCheck size={15} />{statusLabel(selectedMeeting)}</span>
        </div>

        {(selectedMeeting.status === "processing" || selectedMeeting.progressMessage) && (
          <div className="processing-panel">
            <div>
              <span>{selectedMeeting.status === "processing" ? "Em andamento" : "Ultimo processamento"}</span>
              <strong>{selectedMeeting.progressMessage || statusLabel(selectedMeeting)}</strong>
            </div>
            <em>{Math.round(selectedMeeting.progressPercent || 0)}%</em>
            <div className="progress-track">
              <span style={{ width: `${Math.max(0, Math.min(100, selectedMeeting.progressPercent || 0))}%` }} />
            </div>
          </div>
        )}

        <div className="player-section">
          <video src={convertFileSrc(selectedMeeting.recordingPath)} controls />
        </div>

        <div className="analysis-heading">
          <div>
            <span>Transcricao</span>
            <h2>{selectedMeeting.transcript ? "Transcricao disponivel" : "Sem transcricao"}</h2>
          </div>
          <button
            className="primary-button compact"
            onClick={() => transcribeMeeting(selectedMeeting)}
            disabled={processingIds.has(selectedMeeting.id)}
          >
            {processingIds.has(selectedMeeting.id) ? (
              <Loader2 size={17} className="spin" />
            ) : (
              <Bot size={17} />
            )}
            <span>{processingIds.has(selectedMeeting.id) ? "Processando" : "Transcrever"}</span>
          </button>
        </div>

        <div className="insight-layout">
          <section>
            <h3><Bot size={17} />Transcricao</h3>
            <p className="transcript">{selectedMeeting.transcript || "Sem transcricao."}</p>
          </section>
        </div>
      </section>
    );
  };

  const renderLibrary = () => (
    <div className="library-view">
      <section className="library-panel">
        <div className="filter-row">
          <div className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por titulo, tag ou transcricao"
            />
          </div>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="Todas">Todas categorias</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="Todas">Todas tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
          <button className="secondary-button" onClick={refreshMeetings}>
            <RefreshCcw size={16} /> Atualizar
          </button>
        </div>

        <div className="meeting-table">
          {filteredMeetings.length ? (
            filteredMeetings.map((meeting) => (
              <button
                key={meeting.id}
                className={`meeting-record ${meeting.id === selectedMeeting?.id ? "selected" : ""}`}
                onClick={() => setSelectedId(meeting.id)}
              >
                <span className="status-line" data-status={meeting.status} />
                <div>
                  <strong>{meeting.title}</strong>
                  <small>{formatDate(meeting.startedAt)} · {meeting.category || "Sem categoria"}</small>
                </div>
                <div className="meeting-tags">
                  {meeting.tags.slice(0, 3).map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
                <span>{formatDuration(meeting.durationSeconds)}</span>
                <em>{statusLabel(meeting)}</em>
                {meeting.status === "processing" && (
                  <div className="row-progress">
                    <span style={{ width: `${Math.max(0, Math.min(100, meeting.progressPercent || 0))}%` }} />
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="empty-state">
              <FolderOpen size={28} />
              <strong>Nenhuma reuniao encontrada</strong>
              <span>Ajuste filtros ou grave uma nova reuniao.</span>
            </div>
          )}
        </div>
      </section>
      {renderMeetingDetail()}
    </div>
  );

  const renderTaxonomy = () => (
    <div className="taxonomy-view">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Categorias</span>
            <h2>Distribuicao da biblioteca</h2>
          </div>
          <Layers3 size={20} />
        </div>
        <div className="taxonomy-list">
          {categories.map((category) => {
            const count = meetings.filter((meeting) => meeting.category === category).length;
            return (
              <button
                key={category}
                onClick={() => {
                  setCategoryFilter(category);
                  setView("library");
                }}
              >
                <span>{category}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span>Tags</span>
            <h2>Marcadores usados</h2>
          </div>
          <Hash size={20} />
        </div>
        <div className="tag-directory">
          {tags.length ? (
            tags.map((tag) => {
              const count = meetings.filter((meeting) => meeting.tags.includes(tag)).length;
              return (
                <button
                  key={tag}
                  onClick={() => {
                    setTagFilter(tag);
                    setView("library");
                  }}
                >
                  <span>#{tag}</span>
                  <strong>{count}</strong>
                </button>
              );
            })
          ) : (
            <div className="empty-state compact">
              <Tag size={22} />
              <strong>Nenhuma tag criada</strong>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderSettings = () => (
    <div className="settings-view">
      <section className="settings-section">
        <div className="panel-heading">
          <div>
            <span>IA</span>
            <h2>Transcricao</h2>
          </div>
          <button className="primary-button compact" onClick={saveSettings}>
            <Save size={16} /> Salvar
          </button>
        </div>
        <div className="settings-grid">
          <label>
            <span>Modo de processamento</span>
            <select
              value={settingsDraft.processingMode}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, processingMode: event.target.value }))
              }
            >
              <option value="local">Local/offline</option>
              <option value="api">API</option>
              <option value="hybrid">Hibrido: local com fallback API</option>
            </select>
          </label>
          <label>
            <span>Idioma</span>
            <select
              value={settingsDraft.language}
              onChange={(event) => setSettingsDraft((current) => ({ ...current, language: event.target.value }))}
            >
              <option value="pt">Portugues</option>
              <option value="en">Ingles</option>
              <option value="es">Espanhol</option>
            </select>
          </label>
          <label>
            <span>FFmpeg</span>
            <input
              value={settingsDraft.ffmpegPath}
              onChange={(event) => setSettingsDraft((current) => ({ ...current, ffmpegPath: event.target.value }))}
              placeholder="ffmpeg ou C:\\tools\\ffmpeg.exe"
            />
          </label>
          <label>
            <span>whisper-cli</span>
            <input
              value={settingsDraft.whisperCliPath}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, whisperCliPath: event.target.value }))
              }
              placeholder="whisper-cli ou C:\\tools\\whisper-cli.exe"
            />
          </label>
          <label className="span-two">
            <span>Modelo Whisper local</span>
            <input
              value={settingsDraft.whisperModelPath}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, whisperModelPath: event.target.value }))
              }
              placeholder="C:\\models\\ggml-large-v3-turbo.bin"
            />
          </label>
          <label>
            <span>Threads Whisper</span>
            <input
              type="number"
              min={1}
              value={settingsDraft.whisperThreads}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, whisperThreads: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            <span>Modelo de transcricao API</span>
            <input
              value={settingsDraft.transcriptionModel}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, transcriptionModel: event.target.value }))
              }
            />
          </label>
          <label className="span-two">
            <span>OpenAI API key</span>
            <input
              type="password"
              value={settingsDraft.apiKey}
              onChange={(event) => setSettingsDraft((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="Opcional para modo API ou fallback hibrido"
            />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settingsDraft.autoTranscribe}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, autoTranscribe: event.target.checked }))
              }
            />
            <span>Transcrever automaticamente apos gravar</span>
          </label>
        </div>
      </section>
    </div>
  );

  const renderVideoSettings = () => (
    <div className="settings-view">
      <section className="settings-section">
        <div className="panel-heading">
          <div>
            <span>Captura</span>
            <h2>Formato e qualidade</h2>
          </div>
          <button className="primary-button compact" onClick={saveSettings}>
            <Save size={16} /> Salvar
          </button>
        </div>
        <div className="settings-grid">
          <label>
            <span>Extensao do arquivo</span>
            <select
              value={settingsDraft.videoFileExtension}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, videoFileExtension: event.target.value }))
              }
            >
              <option value="webm">WEBM nativo</option>
              <option value="mkv">MKV pos-processamento</option>
              <option value="mp4">MP4 pos-processamento</option>
            </select>
          </label>
          <label>
            <span>Perfil de qualidade</span>
            <select
              value={settingsDraft.qualityPreset}
              onChange={(event) => updateQualityPreset(event.target.value)}
            >
              {Object.entries(qualityPresets).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Resolucao maxima</span>
            <select
              value={settingsDraft.resolution}
              onChange={(event) => setSettingsDraft((current) => ({ ...current, resolution: event.target.value }))}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="1440p">1440p</option>
            </select>
          </label>
          <label>
            <span>Quadros por segundo</span>
            <input
              type="number"
              min={15}
              max={60}
              value={settingsDraft.frameRate}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, frameRate: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            <span>Bitrate de video</span>
            <input
              type="number"
              value={settingsDraft.videoBitsPerSecond}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  videoBitsPerSecond: Number(event.target.value)
                }))
              }
            />
          </label>
          <label>
            <span>Bitrate de audio</span>
            <input
              type="number"
              value={settingsDraft.audioBitsPerSecond}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  audioBitsPerSecond: Number(event.target.value)
                }))
              }
            />
          </label>
          <label className="toggle-row span-two">
            <input
              type="checkbox"
              checked={settingsDraft.captureSystemAudio}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, captureSystemAudio: event.target.checked }))
              }
            />
            <span>Capturar audio do sistema quando a fonte permitir</span>
          </label>
        </div>
      </section>
    </div>
  );

  const renderIntegrations = () => {
    const integrations = [
      { name: "Microsoft Teams", icon: MonitorUp, status: "Planejado" },
      { name: "Outlook Calendar", icon: CalendarDays, status: "Planejado" },
      { name: "Google Calendar", icon: CalendarDays, status: "Planejado" },
      { name: "Notion", icon: Database, status: "Planejado" },
      { name: "Slack", icon: Link2, status: "Planejado" },
      { name: "CRM", icon: Cloud, status: "Planejado" }
    ];

    return (
      <div className="integrations-view">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <section className="integration-card" key={integration.name}>
              <div>
                <Icon size={22} />
                <strong>{integration.name}</strong>
                <span>{integration.status}</span>
              </div>
              <button className="secondary-button">
                Configurar <ExternalLink size={15} />
              </button>
            </section>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (view === "dashboard") return renderDashboard();
    if (view === "library") return renderLibrary();
    if (view === "taxonomy") return renderTaxonomy();
    if (view === "settings") return renderSettings();
    if (view === "video") return renderVideoSettings();
    return renderIntegrations();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-symbol">
            <Video size={19} />
          </div>
          <div>
            <strong>Meeting Vault</strong>
            <span>Desktop intelligence</span>
          </div>
        </div>

        <div className="nav-groups">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.view}
                    className={view === item.view ? "active" : ""}
                    onClick={() => setView(item.view)}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      <main className="main-region">
        <header className="chrome-bar" data-tauri-drag-region onPointerDown={startDraggingWindow}>
          <div className="chrome-title" data-tauri-drag-region>
            <span>Meeting Vault</span>
            <em>{isRecording ? `Gravando · ${formatDuration(elapsed)}` : "Pronto"}</em>
          </div>
          {renderWindowControls()}
        </header>

        <section className="content-header">
          <div>
            <span>{currentMeta.eyebrow}</span>
            <h1>{currentMeta.title}</h1>
            <p>{currentMeta.subtitle}</p>
          </div>
          <div className="header-actions">
            <button className="secondary-button" onClick={refreshMeetings}>
              <RefreshCcw size={16} /> Atualizar
            </button>
            <button
              className={isRecording ? "primary-button danger" : "primary-button"}
              onClick={() => (isRecording ? stopRecording() : startRecording())}
            >
              {isRecording ? <Square size={16} /> : <Video size={16} />}
              {isRecording ? "Finalizar" : "Gravar"}
            </button>
          </div>
        </section>

        {notice && (
          <div className="notice">
            <AlertTriangle size={17} />
            <span>{notice}</span>
            <button onClick={() => setNotice("")} title="Fechar aviso">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="content-body">{renderContent()}</section>
      </main>
    </div>
  );
}

export default App;
