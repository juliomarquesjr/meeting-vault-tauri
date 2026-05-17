export type MeetingStatus = "recorded" | "processing" | "completed" | "error";

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface Meeting {
  id: string;
  title: string;
  createdAt: string;
  startedAt: string;
  category: string;
  tags: string[];
  durationSeconds: number;
  sizeBytes: number;
  recordingPath: string;
  mimeType: string;
  transcript: string;
  summary: string;
  status: MeetingStatus;
  progressMessage: string;
  progressPercent: number;
  error: string;
  youtubeVideoId: string;
  youtubeUrl: string;
  transcriptSegments?: TranscriptSegment[];
}

export interface ProcessingProgress {
  id: string;
  message: string;
  percent: number;
  status: MeetingStatus;
}

export interface Settings {
  apiKey: string;
  processingMode: string;
  transcriptionModel: string;
  summaryMode: string;
  openRouterApiKey: string;
  openRouterModel: string;
  language: string;
  ffmpegPath: string;
  whisperCliPath: string;
  whisperModelPath: string;
  whisperThreads: number;
  videoFileExtension: string;
  qualityPreset: string;
  resolution: string;
  frameRate: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  captureSystemAudio: boolean;
  captureMicrophone: boolean;
  autoTranscribe: boolean;
  youtubeClientId: string;
  youtubeClientSecret: string;
  enableMeetDetection: boolean;
  enableDiarization: boolean;
  diarizationNumSpeakers: number;
  pythonPath: string;
  diarizationScriptPath: string;
  huggingfaceToken: string;
}

export interface SaveRecordingInput {
  title: string;
  category: string;
  tags: string[];
  startedAt: string;
  durationSeconds: number;
  mimeType: string;
  fileExtension: string;
  bytes: number[];
}

export interface DiarizationCheckResult {
  pythonOk: boolean;
  pythonVersion: string;
  pythonError: string;
  pyannoteOk: boolean;
  pyannoteVersion: string;
  pyannoteError: string;
  modelOk: boolean;
  modelError: string;
}

export interface FinalizeRecordingInput {
  sessionId: string;
  title: string;
  category: string;
  tags: string[];
  startedAt: string;
  durationSeconds: number;
  mimeType: string;
  fileExtension: string;
}
