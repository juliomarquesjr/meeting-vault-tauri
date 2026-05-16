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
  MonitorUp,
  Pause,
  Pencil,
  Play,
  Volume2,
  VolumeX,
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
import ReactMarkdown from "react-markdown";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { IntegrationsView } from "./components/IntegrationsView";
import { YoutubeUploadDialog } from "./components/YoutubeUploadDialog";
import type { FinalizeRecordingInput, Meeting, ProcessingProgress, Settings } from "./types";

type View = "dashboard" | "library" | "taxonomy" | "settings" | "summary" | "video" | "integrations";
type ContentModal = "transcript" | "summary" | null;
type RecordingFinalization = {
  active: boolean;
  message: string;
  percent: number;
};

const defaultSettings: Settings = {
  apiKey: "",
  processingMode: "local",
  transcriptionModel: "gpt-4o-mini-transcribe",
  summaryMode: "disabled",
  openRouterApiKey: "",
  openRouterModel: "arcee-ai/trinity-large-thinking:free",
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
  captureMicrophone: true,
  autoTranscribe: false,
  youtubeClientId: "",
  youtubeClientSecret: "",
  enableMeetDetection: true
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
    eyebrow: "IA local/API",
    title: "Transcricao",
    subtitle: "Transcricao, Whisper, OpenAI opcional, idioma e comportamento automatico."
  },
  summary: {
    eyebrow: "IA externa",
    title: "Resumo",
    subtitle: "Resumo de transcricoes via OpenRouter, separado do pipeline de transcricao."
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
      { view: "settings", label: "Transcricao", icon: SettingsIcon },
      { view: "summary", label: "Resumo", icon: Cloud },
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

function formatVideoTime(seconds: number) {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatTextStats(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (!words) return "Sem conteudo";
  if (words === 1) return "1 palavra";
  return `${words.toLocaleString("pt-BR")} palavras`;
}

function waitForUiPaint() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
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
  const [recordingFinalization, setRecordingFinalization] = useState<RecordingFinalization>({
    active: false,
    message: "",
    percent: 0
  });
  const [elapsed, setElapsed] = useState(0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [titleDraft, setTitleDraft] = useState("");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [recordingTagInput, setRecordingTagInput] = useState("");
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [videoIsMuted, setVideoIsMuted] = useState(false);
  const [activeContentModal, setActiveContentModal] = useState<ContentModal>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [youtubeUploadOpen, setYoutubeUploadOpen] = useState(false);
  const [isUploadingToYoutube, setIsUploadingToYoutube] = useState(false);
  const [deleteLocalConfirmOpen, setDeleteLocalConfirmOpen] = useState(false);
  const [isDeletingLocal, setIsDeletingLocal] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve());
  const startedAtRef = useRef<Date | null>(null);
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
  const isFinalizingRecording = recordingFinalization.active;
  const recordingHeaderStatus = isFinalizingRecording
    ? recordingFinalization.message
    : isRecording
      ? `Gravando · ${formatDuration(elapsed)}`
      : "Pronto";

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
    [refreshMeetings, settings.apiKey, settings.processingMode]
  );

  const summarizeMeeting = useCallback(
    async (meeting: Meeting) => {
      if (!meeting.transcript.trim()) {
        setNotice("Transcreva a reuniao antes de gerar um resumo.");
        return;
      }

      if (settings.summaryMode !== "openrouter") {
        setView("summary");
        setNotice("Ative o resumo com OpenRouter nas configuracoes.");
        return;
      }

      if (!settings.openRouterApiKey.trim()) {
        setView("summary");
        setNotice("Configure a chave do OpenRouter antes de resumir.");
        return;
      }

      setProcessingIds((current) => new Set(current).add(meeting.id));
      setMeetings((current) =>
        current.map((item) =>
          item.id === meeting.id
            ? {
                ...item,
                status: "processing",
                progressMessage: "Iniciando resumo",
                progressPercent: 1
              }
            : item
        )
      );
      setNotice("");
      try {
        const updated = await invoke<Meeting>("summarize_meeting", { id: meeting.id });
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
    [refreshMeetings, settings.openRouterApiKey, settings.summaryMode]
  );

  const stopRecording = useCallback(() => {
    if (recordingFinalization.active) return;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setRecordingFinalization({
        active: true,
        message: "Encerrando captura",
        percent: 8
      });
      recorder.stop();
    }
  }, [recordingFinalization.active]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current?.state === "recording") return;

    setNotice("");
    setRecordingFinalization({ active: false, message: "", percent: 0 });
    const { width, height } = resolutionDimensions(settings.resolution);
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: settings.frameRate, max: Math.max(settings.frameRate, 30) },
        width: { ideal: width, max: width },
        height: { ideal: height, max: height }
      },
      audio: settings.captureSystemAudio
    });

    let stream = displayStream;

    if (settings.captureMicrophone) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const destination = audioCtx.createMediaStreamDestination();

        if (displayStream.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(displayStream).connect(destination);
        }
        audioCtx.createMediaStreamSource(micStream).connect(destination);

        stream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks()
        ]);
      } catch {
        // Microphone permission denied or unavailable — record without mic
      }
    }

    streamRef.current = stream;
    startedAtRef.current = new Date();
    chunkQueueRef.current = Promise.resolve();

    let sessionId: string;
    try {
      sessionId = await invoke<string>("begin_recording_session");
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setNotice(error instanceof Error ? error.message : String(error));
      return;
    }
    sessionIdRef.current = sessionId;

    const recorder = new MediaRecorder(stream, recorderOptions(settings));
    recorderRef.current = recorder;

    stream.getVideoTracks()[0]?.addEventListener("ended", () => stopRecording(), { once: true });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0 && sessionIdRef.current) {
        const sid = sessionIdRef.current;
        const blob = event.data;
        chunkQueueRef.current = chunkQueueRef.current.then(async () => {
          const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
          await invoke("append_recording_chunk", { sessionId: sid, bytes });
        });
      }
    };

    recorder.onstop = async () => {
      setRecordingFinalization({
        active: true,
        message: "Aguardando gravacao ser escrita no disco",
        percent: 18
      });
      await waitForUiPaint();

      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
      audioCtxRef.current?.close();
      audioCtxRef.current = null;

      const startedAt = startedAtRef.current ?? new Date();
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
      const mimeType = recorder.mimeType || "video/webm";
      const sid = sessionIdRef.current;

      try {
        await chunkQueueRef.current;

        setRecordingFinalization({
          active: true,
          message: "Salvando video no cofre local",
          percent: 60
        });
        await waitForUiPaint();

        const input: FinalizeRecordingInput = {
          sessionId: sid!,
          title: recordingTitle.trim() || defaultMeetingTitle(),
          category: recordingCategory,
          tags: parseTags(recordingTags),
          startedAt: startedAt.toISOString(),
          durationSeconds,
          mimeType,
          fileExtension: settings.videoFileExtension
        };
        const saved = await invoke<Meeting>("finalize_recording_session", { input });

        setRecordingFinalization({
          active: true,
          message: "Atualizando biblioteca",
          percent: 92
        });
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
        if (sid) void invoke("cancel_recording_session", { sessionId: sid }).catch(() => {});
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        recorderRef.current = null;
        sessionIdRef.current = null;
        startedAtRef.current = null;
        setElapsed(0);
        setIsRecording(false);
        setRecordingFinalization({ active: false, message: "", percent: 0 });
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
    setIsDeletingMeeting(true);
    setNotice("");
    try {
      await invoke("delete_meeting", { id: selectedMeeting.id });
      const remaining = meetings.filter((meeting) => meeting.id !== selectedMeeting.id);
      setMeetings(remaining);
      setSelectedId(remaining[0]?.id || "");
      setDeleteConfirmOpen(false);
      setNotice("Reuniao removida.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeletingMeeting(false);
    }
  }, [meetings, selectedMeeting]);

  const uploadToYoutube = useCallback(
    async (title: string, description: string, privacy: string, deleteLocal: boolean) => {
      if (!selectedMeeting) return;
      setIsUploadingToYoutube(true);
      setYoutubeUploadOpen(false);
      setProcessingIds((current) => new Set(current).add(selectedMeeting.id));
      setMeetings((current) =>
        current.map((item) =>
          item.id === selectedMeeting.id
            ? { ...item, status: "processing", progressMessage: "Preparando upload", progressPercent: 2 }
            : item
        )
      );
      try {
        const updated = await invoke<Meeting>("upload_to_youtube", {
          id: selectedMeeting.id,
          title,
          description,
          privacy,
          deleteLocal
        });
        setMeetings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedId(updated.id);
        setNotice("Video publicado no YouTube com sucesso.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
        await refreshMeetings();
      } finally {
        setIsUploadingToYoutube(false);
        setProcessingIds((current) => {
          const next = new Set(current);
          next.delete(selectedMeeting.id);
          return next;
        });
      }
    },
    [selectedMeeting, refreshMeetings]
  );

  const deleteLocalRecording = useCallback(async () => {
    if (!selectedMeeting) return;
    setIsDeletingLocal(true);
    try {
      const updated = await invoke<Meeting>("delete_local_recording", { id: selectedMeeting.id });
      setMeetings((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setDeleteLocalConfirmOpen(false);
      setNotice("Arquivo local removido.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsDeletingLocal(false);
    }
  }, [selectedMeeting]);

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
    invoke<boolean>("get_youtube_connection_status")
      .then(setYoutubeConnected)
      .catch(() => {});
    invoke("start_meet_watcher").catch(() => {});
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
      }),
      listen("youtube-connected", () => {
        invoke<boolean>("get_youtube_connection_status")
          .then(setYoutubeConnected)
          .catch(() => {});
      }),
      listen<{ title: string }>("meet-start-recording", (event) => {
        setRecordingTitle(event.payload.title);
        startRecording().catch((error) => setNotice(String(error)));
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
    setTagInput("");
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setVideoIsPlaying(false);
    setActiveContentModal(null);
    setDeleteConfirmOpen(false);
  }, [selectedMeeting?.id]);

  useEffect(() => {
    if (!activeContentModal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveContentModal(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeContentModal]);

  const startDraggingWindow = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-no-window-drag]")) return;
    invoke("start_dragging_window").catch((error) => console.error("Failed to drag window", error));
  }, []);

  const renderWindowControls = () => (
    <div className="window-controls">
      <button className="window-control minimize" onClick={() => invoke("minimize_window")} title="Minimizar" aria-label="Minimizar">
        <span />
      </button>
      <button className="window-control maximize" onClick={() => invoke("toggle_maximize_window")} title="Maximizar" aria-label="Maximizar">
        <span />
      </button>
      <button className="window-control close" onClick={() => invoke("hide_window")} title="Fechar" aria-label="Fechar">
        <span />
      </button>
    </div>
  );

  const renderDashboard = () => (
    <div className="dashboard-view">

      {/* Zone 1 — KPI tiles */}
      <div className="kpi-row">
        <div className="kpi-tile">
          <div className="kpi-icon"><Library size={20} /></div>
          <div className="kpi-body">
            <span>Reunioes gravadas</span>
            <strong>{meetings.length}</strong>
            <em>{stats.summarized} transcritas</em>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-icon kpi-icon--neutral"><Clock3 size={20} /></div>
          <div className="kpi-body">
            <span>Tempo total gravado</span>
            <strong>{formatDuration(stats.totalDuration)}</strong>
            <em>media {formatDuration(stats.avgDuration)} / reuniao</em>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-icon kpi-icon--success"><Bot size={20} /></div>
          <div className="kpi-body">
            <span>Transcritas</span>
            <strong>{stats.summarized}</strong>
            <em>{meetings.length ? Math.round((stats.summarized / meetings.length) * 100) : 0}% do total</em>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-icon kpi-icon--neutral"><HardDrive size={20} /></div>
          <div className="kpi-body">
            <span>Armazenamento</span>
            <strong>{formatBytes(stats.totalSize)}</strong>
            <em>{stats.processing > 0 ? `${stats.processing} em processamento` : "fila vazia"}</em>
          </div>
        </div>
      </div>

      {/* Zone 2 — Gravação + Atividade recente */}
      <div className="dash-main-row">
        <section className="dashboard-frame">
          <div className="panel-heading">
            <div>
              <span>Operacao</span>
              <h2>
                {isFinalizingRecording
                  ? "Finalizando gravacao"
                  : isRecording
                    ? "Gravacao em andamento"
                    : "Nova gravacao"}
              </h2>
            </div>
            <div className="button-row inline">
              <div className="recording-state">
                <span className={isRecording ? "live-dot active" : "live-dot"} />
                <strong>
                  {isFinalizingRecording
                    ? recordingFinalization.message
                    : isRecording
                      ? formatDuration(elapsed)
                      : `${settings.resolution} · ${settings.frameRate} fps`}
                </strong>
              </div>
              <button className="secondary-button" onClick={() => setView("video")}>
                <SlidersHorizontal size={14} />
                <span>Qualidade</span>
              </button>
            </div>
          </div>

          <div className="dash-rec-form">
            <div className="dash-rec-row">
              <label>
                <span>Titulo</span>
                <input
                  value={recordingTitle}
                  onChange={(e) => setRecordingTitle(e.target.value)}
                  disabled={isRecording}
                />
              </label>
              <label>
                <span>Categoria</span>
                <select
                  value={recordingCategory}
                  onChange={(e) => setRecordingCategory(e.target.value)}
                  disabled={isRecording}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Tags</span>
              <div className={`tags-input-container${isRecording ? " tags-input-disabled" : ""}`}>
                {parseTags(recordingTags).map((tag) => (
                  <span key={tag} className="tag-badge">
                    #{tag}
                    {!isRecording && (
                      <button
                        onClick={() => setRecordingTags(parseTags(recordingTags).filter((t) => t !== tag).join(", "))}
                        tabIndex={-1}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {!isRecording && (
                  <input
                    value={recordingTagInput}
                    onChange={(e) => setRecordingTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const tag = recordingTagInput.trim().replace(/^#/, "").replace(/,/g, "");
                        if (tag && !parseTags(recordingTags).some((t) => t.toLowerCase() === tag.toLowerCase())) {
                          setRecordingTags(parseTags(recordingTags).concat(tag).join(", "));
                        }
                        setRecordingTagInput("");
                      } else if (e.key === "Backspace" && !recordingTagInput) {
                        const current = parseTags(recordingTags);
                        setRecordingTags(current.slice(0, -1).join(", "));
                      }
                    }}
                    placeholder={parseTags(recordingTags).length === 0 ? "cliente, sprint, q2..." : ""}
                  />
                )}
              </div>
            </label>
            {isFinalizingRecording && (
              <div className="recording-finalization">
                <div>
                  <Loader2 className="spin" size={15} />
                  <span>{recordingFinalization.message}</span>
                  <em>{recordingFinalization.percent}%</em>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${recordingFinalization.percent}%` }} />
                </div>
              </div>
            )}
            <div>
              <button
                className={isRecording ? "primary-button danger" : "primary-button"}
                disabled={isFinalizingRecording}
                onClick={() => (isRecording ? stopRecording() : startRecording())}
              >
                {isFinalizingRecording ? <Loader2 className="spin" size={16} /> : isRecording ? <Square size={16} /> : <Video size={16} />}
                <span>
                  {isFinalizingRecording
                    ? "Salvando gravacao"
                    : isRecording
                      ? "Finalizar gravacao"
                      : "Iniciar gravacao"}
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-frame recent-frame">
          <div className="panel-heading">
            <div>
              <span>Atividade</span>
              <h2>Reunioes recentes</h2>
            </div>
            <button className="secondary-button" onClick={() => setView("library")}>
              Ver todas <ChevronRight size={14} />
            </button>
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
                  <div className="recent-row-body">
                    <strong>{meeting.title}</strong>
                    <div className="recent-row-meta">
                      {meeting.status === "processing" ? (
                        <><Loader2 size={11} /> {meeting.progressMessage || "Processando"} · {Math.round(meeting.progressPercent || 0)}%</>
                      ) : (
                        <><CalendarDays size={11} /> {formatDate(meeting.startedAt)} · {meeting.category || "Sem categoria"}</>
                      )}
                    </div>
                  </div>
                  <span className="recent-row-duration">{formatDuration(meeting.durationSeconds)}</span>
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

      {/* Zone 3 — Pipeline + Taxonomia */}
      <div className="dash-footer-row">
        <section className="dashboard-frame">
          <div className="panel-heading">
            <div>
              <span>Pipeline</span>
              <h2>Estado da biblioteca</h2>
            </div>
            <BarChart3 size={18} color="var(--muted)" />
          </div>
          <div className="pipeline-stats">
            <div className="pipeline-stat" data-type="success">
              <CheckCircle2 size={16} />
              <span>Transcritas</span>
              <strong>{stats.summarized}</strong>
            </div>
            <div className="pipeline-stat" data-type="warning">
              <Loader2 size={16} />
              <span>Processando</span>
              <strong>{stats.processing}</strong>
            </div>
            <div className="pipeline-stat" data-type="error">
              <AlertTriangle size={16} />
              <span>Com erro</span>
              <strong>{stats.error}</strong>
            </div>
            <div className="pipeline-stat">
              <Gauge size={16} />
              <span>Duracao media</span>
              <strong>{formatDuration(stats.avgDuration)}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-frame">
          <div className="panel-heading">
            <div>
              <span>Taxonomia</span>
              <h2>Organizacao</h2>
            </div>
            <button className="secondary-button" onClick={() => setView("taxonomy")}>
              <Tag size={14} />
              <span>Gerenciar</span>
            </button>
          </div>
          <div className="taxonomy-kpi">
            <div>
              <Layers3 size={16} />
              <strong>{categories.length}</strong>
              <span>Categorias</span>
            </div>
            <div>
              <Hash size={16} />
              <strong>{tags.length}</strong>
              <span>Tags</span>
            </div>
          </div>
          <div className="tag-cloud">
            {tags.slice(0, 12).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
            {!tags.length && <span>sem tags cadastradas</span>}
          </div>
        </section>
      </div>
    </div>
  );

  const renderMeetingDetail = () => {
    if (!selectedMeeting) {
      return (
        <section className="detail-workspace">
          <div className="empty-state large">
            <Video size={34} />
            <strong>Selecione ou grave uma reuniao</strong>
            <span>A biblioteca exibira player, transcricao e metadados.</span>
          </div>
        </section>
      );
    }

    const isProcessing = processingIds.has(selectedMeeting.id);
    const percent = Math.round(Math.max(0, Math.min(100, selectedMeeting.progressPercent || 0)));

    return (
      <section className="detail-workspace">
        {/* Header: título + ações */}
        <div className="detail-header">
          <div className="detail-title-row">
            <input
              className="detail-title-input"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
            />
            <div className="detail-action-bar">
              <button className="secondary-button" onClick={saveMetadata}>
                <Pencil size={14} /> Salvar
              </button>
              <button
                className="icon-button"
                onClick={() => invoke("open_recording", { id: selectedMeeting.id })}
                title="Assistir"
              >
                <Play size={15} />
              </button>
              <button
                className="icon-button"
                onClick={() => invoke("reveal_recording", { id: selectedMeeting.id })}
                title="Abrir pasta"
              >
                <FolderOpen size={15} />
              </button>
              {youtubeConnected &&
                selectedMeeting.recordingPath &&
                !selectedMeeting.youtubeVideoId && (
                  <button
                    className="icon-button"
                    title="Publicar no YouTube"
                    disabled={isProcessing}
                    onClick={() => setYoutubeUploadOpen(true)}
                  >
                    <MonitorUp size={15} />
                  </button>
                )}
              {selectedMeeting.youtubeVideoId && selectedMeeting.recordingPath && (
                <button
                  className="icon-button danger"
                  title="Apagar arquivo local"
                  onClick={() => setDeleteLocalConfirmOpen(true)}
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button className="icon-button danger" onClick={() => setDeleteConfirmOpen(true)} title="Excluir">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Categoria + Tags */}
        <div className="detail-fields">
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
          <label>
            <span>Tags</span>
            <div className="tags-input-container">
              {parseTags(tagsDraft).map((tag) => (
                <span key={tag} className="tag-badge">
                  #{tag}
                  <button
                    onClick={() => setTagsDraft(parseTags(tagsDraft).filter((t) => t !== tag).join(", "))}
                    tabIndex={-1}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const tag = tagInput.trim().replace(/^#/, "").replace(/,/g, "");
                    if (tag && !parseTags(tagsDraft).some((t) => t.toLowerCase() === tag.toLowerCase())) {
                      setTagsDraft(parseTags(tagsDraft).concat(tag).join(", "));
                    }
                    setTagInput("");
                  } else if (e.key === "Backspace" && !tagInput) {
                    const current = parseTags(tagsDraft);
                    setTagsDraft(current.slice(0, -1).join(", "));
                  }
                }}
                placeholder={parseTags(tagsDraft).length === 0 ? "Adicionar tag..." : ""}
              />
            </div>
          </label>
        </div>

        {/* Metadados */}
        <div className="detail-meta">
          <span><CalendarDays size={13} />{formatDate(selectedMeeting.startedAt)}</span>
          <span><Clock3 size={13} />{formatDuration(selectedMeeting.durationSeconds)}</span>
          <span><HardDrive size={13} />{formatBytes(selectedMeeting.sizeBytes)}</span>
          <span><BadgeCheck size={13} />{statusLabel(selectedMeeting)}</span>
          {selectedMeeting.youtubeUrl && (
            <button
              className="icon-button"
              style={{ fontSize: "12px", gap: "4px", height: "auto", padding: "2px 6px" }}
              title="Abrir no YouTube"
              onClick={() => invoke("open_url", { url: selectedMeeting.youtubeUrl })}
            >
              <ExternalLink size={12} /> YouTube
            </button>
          )}
        </div>

        {/* Player de vídeo */}
        <div className="player-section">
          <div className="video-wrapper">
            <video
              ref={videoRef}
              src={convertFileSrc(selectedMeeting.recordingPath)}
              onTimeUpdate={() => setVideoCurrentTime(videoRef.current?.currentTime ?? 0)}
              onDurationChange={() => setVideoDuration(videoRef.current?.duration ?? 0)}
              onPlay={() => setVideoIsPlaying(true)}
              onPause={() => setVideoIsPlaying(false)}
              onEnded={() => setVideoIsPlaying(false)}
              onClick={() => {
                if (videoRef.current) {
                  videoIsPlaying ? videoRef.current.pause() : videoRef.current.play();
                }
              }}
            />
            {!videoIsPlaying && (
              <button
                className="play-overlay"
                onClick={() => videoRef.current?.play()}
                aria-label="Play"
              >
                <Play size={28} />
              </button>
            )}
          </div>
          <div className="player-controls">
            <button
              className="player-btn"
              onClick={() => videoRef.current && (videoIsPlaying ? videoRef.current.pause() : videoRef.current.play())}
              title={videoIsPlaying ? "Pausar" : "Play"}
            >
              {videoIsPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <span className="player-time">{formatVideoTime(videoCurrentTime)}</span>
            <input
              type="range"
              className="player-scrubber"
              min={0}
              max={videoDuration || 1}
              step={0.05}
              value={videoCurrentTime}
              style={{
                background: `linear-gradient(to right, var(--accent) ${(videoCurrentTime / (videoDuration || 1)) * 100}%, rgba(255,255,255,0.1) ${(videoCurrentTime / (videoDuration || 1)) * 100}%)`
              }}
              onChange={(e) => {
                const t = Number(e.target.value);
                setVideoCurrentTime(t);
                if (videoRef.current) videoRef.current.currentTime = t;
              }}
            />
            <span className="player-time">{formatVideoTime(videoDuration)}</span>
            <button
              className="player-btn"
              onClick={() => {
                const muted = !videoIsMuted;
                setVideoIsMuted(muted);
                if (videoRef.current) videoRef.current.muted = muted;
              }}
              title={videoIsMuted ? "Ativar som" : "Silenciar"}
            >
              {videoIsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button
              className="player-btn"
              onClick={() => videoRef.current?.requestFullscreen()}
              title="Tela cheia"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        <div className="content-actions">
          {isProcessing && (
            <div className="content-processing">
              <div className="transcript-processing-info">
                <div>
                  <span>{selectedMeeting.progressMessage || "Processando..."}</span>
                </div>
                <em>{percent}%</em>
              </div>
              <div className="progress-track">
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}

          <section className="content-action-card">
            <div className="content-action-copy">
              <span className="content-action-icon"><Bot size={16} /></span>
              <div>
                <strong>Transcricao</strong>
                <em>
                  {selectedMeeting.transcript
                    ? `Disponivel · ${formatTextStats(selectedMeeting.transcript)}`
                    : "Ainda nao gerada"}
                </em>
              </div>
            </div>
            <div className="content-action-buttons">
              {selectedMeeting.transcript ? (
                <button className="secondary-button compact" onClick={() => setActiveContentModal("transcript")}>
                  <ExternalLink size={14} /> Abrir
                </button>
              ) : (
                <button
                  className="primary-button compact"
                  disabled={isProcessing}
                  onClick={() => transcribeMeeting(selectedMeeting)}
                >
                  <Bot size={15} /> Transcrever
                </button>
              )}
            </div>
          </section>

          <section className="content-action-card">
            <div className="content-action-copy">
              <span className="content-action-icon"><Cloud size={16} /></span>
              <div>
                <strong>Resumo</strong>
                <em>
                  {selectedMeeting.summary
                    ? `Disponivel · ${formatTextStats(selectedMeeting.summary)}`
                    : selectedMeeting.transcript
                      ? "Pode ser gerado com OpenRouter"
                      : "Exige transcricao primeiro"}
                </em>
              </div>
            </div>
            <div className="content-action-buttons">
              {selectedMeeting.summary ? (
                <button className="secondary-button compact" onClick={() => setActiveContentModal("summary")}>
                  <ExternalLink size={14} /> Abrir
                </button>
              ) : selectedMeeting.transcript ? (
                <button
                  className="secondary-button compact"
                  disabled={isProcessing}
                  onClick={() => summarizeMeeting(selectedMeeting)}
                >
                  <Cloud size={14} /> Gerar
                </button>
              ) : (
                <button className="secondary-button compact" disabled>
                  <Cloud size={14} /> Indisponivel
                </button>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  };

  const renderLibrary = () => (
    <div className="library-view">
      <section className="library-panel">
        <div style={{ display: "grid", gap: 8 }}>
          <div className="lib-search">
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por titulo, tag ou transcricao"
              />
            </div>
          </div>
          <div className="lib-filters">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="Todas">Todas categorias</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="Todas">Todas tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
            <button className="icon-button" onClick={refreshMeetings} title="Atualizar">
              <RefreshCcw size={15} />
            </button>
          </div>
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
                <div className="record-body">
                  <strong>{meeting.title}</strong>
                  <div className="record-meta">
                    <span>{formatDate(meeting.startedAt)}</span>
                    <span>·</span>
                    <span>{formatDuration(meeting.durationSeconds)}</span>
                    {meeting.category && <><span>·</span><span>{meeting.category}</span></>}
                  </div>
                  {meeting.tags.length > 0 && (
                    <div className="meeting-tags">
                      {meeting.tags.slice(0, 3).map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="record-status">
                  <em>{statusLabel(meeting)}</em>
                </div>
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

  const renderSummarySettings = () => (
    <div className="settings-view">
      <section className="settings-section">
        <div className="panel-heading">
          <div>
            <span>IA externa</span>
            <h2>Resumo via OpenRouter</h2>
          </div>
          <button className="primary-button compact" onClick={saveSettings}>
            <Save size={16} /> Salvar
          </button>
        </div>
        <div className="settings-grid">
          <label>
            <span>Resumo de transcricoes</span>
            <select
              value={settingsDraft.summaryMode}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, summaryMode: event.target.value }))
              }
            >
              <option value="disabled">Desativado</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </label>
          <label>
            <span>Modelo OpenRouter</span>
            <input
              value={settingsDraft.openRouterModel}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, openRouterModel: event.target.value }))
              }
              placeholder="arcee-ai/trinity-large-thinking:free"
            />
          </label>
          <label className="span-two">
            <span>OpenRouter API key</span>
            <input
              type="password"
              value={settingsDraft.openRouterApiKey}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, openRouterApiKey: event.target.value }))
              }
              placeholder="Usada apenas para enviar transcricoes ao OpenRouter"
            />
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
          <label className="toggle-row span-two">
            <input
              type="checkbox"
              checked={settingsDraft.captureMicrophone}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, captureMicrophone: event.target.checked }))
              }
            />
            <span>Capturar audio do microfone durante a gravacao</span>
          </label>
          <label className="toggle-row span-two">
            <input
              type="checkbox"
              checked={settingsDraft.enableMeetDetection}
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, enableMeetDetection: event.target.checked }))
              }
            />
            <span>Detectar reunioes no Google Meet e sugerir gravacao</span>
          </label>
        </div>
      </section>
    </div>
  );


  const renderContentModal = () => {
    if (!selectedMeeting || !activeContentModal) return null;
    const isTranscript = activeContentModal === "transcript";
    const content = isTranscript ? selectedMeeting.transcript : selectedMeeting.summary;
    if (!content) return null;
    const title = isTranscript ? "Transcricao" : "Resumo";
    const Icon = isTranscript ? Bot : Cloud;
    const rerunLabel = isTranscript ? "Retranscrever" : "Regenerar";
    const rerunAction = isTranscript ? transcribeMeeting : summarizeMeeting;
    const modalIsProcessing = selectedMeeting.status === "processing" || processingIds.has(selectedMeeting.id);

    return (
      <div className="content-modal-backdrop" onMouseDown={() => setActiveContentModal(null)}>
        <section className="content-modal" onMouseDown={(event) => event.stopPropagation()}>
          <header className="content-modal-header">
            <div>
              <span><Icon size={15} /> {title}</span>
              <h2>{selectedMeeting.title}</h2>
              <em>{formatTextStats(content)}</em>
            </div>
            <div className="content-modal-actions">
              {!modalIsProcessing && (
                <button
                  className="secondary-button compact"
                  onClick={() => {
                    setActiveContentModal(null);
                    void rerunAction(selectedMeeting);
                  }}
                >
                  <RefreshCcw size={13} /> {rerunLabel}
                </button>
              )}
              <button className="icon-button" onClick={() => setActiveContentModal(null)} title="Fechar">
                <X size={16} />
              </button>
            </div>
          </header>
          <div className={isTranscript ? "content-modal-text transcript-text" : "content-modal-text markdown-content"}>
            {isTranscript ? content : <ReactMarkdown>{content}</ReactMarkdown>}
          </div>
        </section>
      </div>
    );
  };

  const renderContent = () => {
    if (view === "dashboard") return renderDashboard();
    if (view === "library") return renderLibrary();
    if (view === "taxonomy") return renderTaxonomy();
    if (view === "settings") return renderSettings();
    if (view === "summary") return renderSummarySettings();
    if (view === "video") return renderVideoSettings();
    return (
      <IntegrationsView
        youtubeConnected={youtubeConnected}
        onYoutubeConnectedChange={setYoutubeConnected}
        settings={settings}
        onSettingsUpdated={(updated) => {
          const merged = { ...defaultSettings, ...updated };
          setSettings(merged);
          setSettingsDraft(merged);
        }}
        onNotice={setNotice}
      />
    );
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
            <em>{recordingHeaderStatus}</em>
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
              disabled={isFinalizingRecording}
              onClick={() => (isRecording ? stopRecording() : startRecording())}
            >
              {isFinalizingRecording ? <Loader2 className="spin" size={16} /> : isRecording ? <Square size={16} /> : <Video size={16} />}
              {isFinalizingRecording ? "Salvando" : isRecording ? "Finalizar" : "Gravar"}
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

        <section className={`content-body${view === "library" ? " content-body--library" : ""}`}>
          {renderContent()}
        </section>
      </main>
      {renderContentModal()}
      <ConfirmDialog
        open={Boolean(selectedMeeting && deleteConfirmOpen)}
        title="Remover gravacao?"
        message="Esta acao remove a reuniao da biblioteca e apaga o arquivo de video local."
        detail={selectedMeeting ? selectedMeeting.title : undefined}
        confirmLabel="Remover video"
        destructive
        loading={isDeletingMeeting}
        onConfirm={deleteMeeting}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
      {selectedMeeting && (
        <YoutubeUploadDialog
          open={youtubeUploadOpen}
          meeting={selectedMeeting}
          onConfirm={uploadToYoutube}
          onCancel={() => setYoutubeUploadOpen(false)}
          loading={isUploadingToYoutube}
        />
      )}
      <ConfirmDialog
        open={Boolean(selectedMeeting && deleteLocalConfirmOpen)}
        title="Apagar arquivo local?"
        message="O video sera removido do disco, mas a reuniao e o link do YouTube serao mantidos."
        detail={selectedMeeting ? selectedMeeting.title : undefined}
        confirmLabel="Apagar arquivo"
        destructive
        loading={isDeletingLocal}
        onConfirm={deleteLocalRecording}
        onCancel={() => setDeleteLocalConfirmOpen(false)}
      />
    </div>
  );
}

export default App;
