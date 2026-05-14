use chrono::Utc;
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App, AppHandle, Emitter, Manager, State, WindowEvent,
};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Meeting {
    id: String,
    title: String,
    created_at: String,
    started_at: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    tags: Vec<String>,
    duration_seconds: f64,
    size_bytes: u64,
    recording_path: String,
    mime_type: String,
    transcript: String,
    status: String,
    #[serde(default)]
    progress_message: String,
    #[serde(default)]
    progress_percent: u8,
    error: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProcessingProgress {
    id: String,
    message: String,
    percent: u8,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Settings {
    api_key: String,
    #[serde(default = "default_processing_mode")]
    processing_mode: String,
    transcription_model: String,
    language: String,
    #[serde(default = "default_ffmpeg_path")]
    ffmpeg_path: String,
    #[serde(default = "default_whisper_cli_path")]
    whisper_cli_path: String,
    #[serde(default)]
    whisper_model_path: String,
    #[serde(default = "default_whisper_threads")]
    whisper_threads: u32,
    #[serde(default = "default_video_file_extension")]
    video_file_extension: String,
    #[serde(default = "default_quality_preset")]
    quality_preset: String,
    #[serde(default = "default_resolution")]
    resolution: String,
    #[serde(default = "default_frame_rate")]
    frame_rate: u32,
    #[serde(default = "default_video_bits_per_second")]
    video_bits_per_second: u32,
    #[serde(default = "default_audio_bits_per_second")]
    audio_bits_per_second: u32,
    #[serde(default = "default_true")]
    capture_system_audio: bool,
    #[serde(default)]
    auto_transcribe: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            processing_mode: default_processing_mode(),
            transcription_model: "gpt-4o-mini-transcribe".into(),
            language: "pt".into(),
            ffmpeg_path: default_ffmpeg_path(),
            whisper_cli_path: default_whisper_cli_path(),
            whisper_model_path: String::new(),
            whisper_threads: default_whisper_threads(),
            video_file_extension: default_video_file_extension(),
            quality_preset: default_quality_preset(),
            resolution: default_resolution(),
            frame_rate: default_frame_rate(),
            video_bits_per_second: default_video_bits_per_second(),
            audio_bits_per_second: default_audio_bits_per_second(),
            capture_system_audio: true,
            auto_transcribe: false,
        }
    }
}

fn default_processing_mode() -> String {
    "local".into()
}

fn default_ffmpeg_path() -> String {
    "ffmpeg".into()
}

fn default_whisper_cli_path() -> String {
    "whisper-cli".into()
}

fn default_whisper_threads() -> u32 {
    8
}

fn default_video_file_extension() -> String {
    "webm".into()
}

fn default_quality_preset() -> String {
    "balanced".into()
}

fn default_resolution() -> String {
    "1080p".into()
}

fn default_frame_rate() -> u32 {
    24
}

fn default_video_bits_per_second() -> u32 {
    2_400_000
}

fn default_audio_bits_per_second() -> u32 {
    128_000
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
struct Store {
    meetings: Vec<Meeting>,
    settings: Settings,
}

#[derive(Debug)]
struct AppState {
    store: Mutex<Store>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveRecordingInput {
    title: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    tags: Vec<String>,
    started_at: String,
    duration_seconds: f64,
    mime_type: String,
    #[serde(default = "default_video_file_extension")]
    file_extension: String,
    bytes: Vec<u8>,
}

#[tauri::command]
fn list_meetings(state: State<'_, AppState>) -> Result<Vec<Meeting>, String> {
    let store = state.store.lock().map_err(|error| error.to_string())?;
    let mut meetings = store.meetings.clone();
    meetings.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(meetings)
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let store = state.store.lock().map_err(|error| error.to_string())?;
    Ok(store.settings.clone())
}

#[tauri::command]
fn save_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    store.settings = settings;
    persist_store(&app, &store)?;
    Ok(store.settings.clone())
}

#[tauri::command]
fn save_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SaveRecordingInput,
) -> Result<Meeting, String> {
    let id = Uuid::new_v4().to_string();
    let recordings_dir = recordings_dir(&app)?;
    let extension = normalize_extension(&input.file_extension);
    let file_name = format!("{id}.{extension}");
    let recording_path = recordings_dir.join(file_name);
    fs::write(&recording_path, &input.bytes).map_err(|error| error.to_string())?;

    let meeting = Meeting {
        id,
        title: input.title.trim().to_string(),
        created_at: Utc::now().to_rfc3339(),
        started_at: input.started_at,
        category: input.category.trim().to_string(),
        tags: normalize_tags(input.tags),
        duration_seconds: input.duration_seconds,
        size_bytes: input.bytes.len() as u64,
        recording_path: recording_path.to_string_lossy().to_string(),
        mime_type: input.mime_type,
        transcript: String::new(),
        status: "recorded".into(),
        progress_message: String::new(),
        progress_percent: 0,
        error: String::new(),
    };

    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    store.meetings.push(meeting.clone());
    persist_store(&app, &store)?;
    Ok(meeting)
}

#[tauri::command]
fn update_meeting_title(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<Meeting, String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let updated = store
        .meetings
        .iter_mut()
        .find(|meeting| meeting.id == id)
        .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;
    updated.title = title.trim().to_string();
    let meeting = updated.clone();
    persist_store(&app, &store)?;
    Ok(meeting)
}

#[tauri::command]
fn update_meeting_metadata(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    title: String,
    category: String,
    tags: Vec<String>,
) -> Result<Meeting, String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let updated = store
        .meetings
        .iter_mut()
        .find(|meeting| meeting.id == id)
        .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;
    updated.title = title.trim().to_string();
    updated.category = category.trim().to_string();
    updated.tags = normalize_tags(tags);
    let meeting = updated.clone();
    persist_store(&app, &store)?;
    Ok(meeting)
}

#[tauri::command]
fn delete_meeting(app: AppHandle, state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let Some(index) = store.meetings.iter().position(|meeting| meeting.id == id) else {
        return Ok(());
    };
    let meeting = store.meetings.remove(index);
    if Path::new(&meeting.recording_path).exists() {
        fs::remove_file(&meeting.recording_path).map_err(|error| error.to_string())?;
    }
    persist_store(&app, &store)
}

#[tauri::command]
fn open_recording(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let path = recording_path_for(&state, &id)?;
    open_path(&path)
}

#[tauri::command]
fn reveal_recording(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let path = recording_path_for(&state, &id)?;
    if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", path.to_string_lossy()))
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    open_path(path.parent().unwrap_or_else(|| Path::new(".")))
}

#[tauri::command]
async fn transcribe_meeting(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Meeting, String> {
    let (meeting, settings) = {
        let mut store = state.store.lock().map_err(|error| error.to_string())?;
        let meeting = store
            .meetings
            .iter_mut()
            .find(|meeting| meeting.id == id)
            .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;
        meeting.status = "processing".into();
        meeting.progress_message = "Preparando processamento".into();
        meeting.progress_percent = 2;
        meeting.error.clear();
        let meeting_clone = meeting.clone();
        let settings = store.settings.clone();
        persist_store(&app, &store)?;
        (meeting_clone, settings)
    };
    update_meeting_progress(&app, &state, &id, "Preparando processamento", 2, "processing")?;

    let result = match settings.processing_mode.as_str() {
        "local" => run_local_pipeline(&app, &state, &meeting, &settings),
        "hybrid" => match run_local_pipeline(&app, &state, &meeting, &settings) {
            Ok(transcript) => Ok(transcript),
            Err(local_error) => {
                if settings.api_key.trim().is_empty() {
                    Err(format!(
                        "Processamento local falhou e a API nao esta configurada: {local_error}"
                    ))
                } else {
                    update_meeting_progress(&app, &state, &id, "Fallback para API", 12, "processing")?;
                    run_api_pipeline(&app, &state, &meeting, &settings)
                        .await
                        .map_err(|api_error| {
                            format!("Local falhou: {local_error}. API falhou: {api_error}")
                        })
                }
            }
        },
        _ => run_api_pipeline(&app, &state, &meeting, &settings).await,
    };

    let transcript = match result {
        Ok(transcript) => transcript,
        Err(error) => {
            mark_meeting_error(&app, &state, &id, &error)?;
            return Err(error);
        }
    };

    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    let updated = store
        .meetings
        .iter_mut()
        .find(|meeting| meeting.id == id)
        .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;
    updated.transcript = transcript;
    updated.status = "completed".into();
    updated.progress_message = "Transcricao concluida".into();
    updated.progress_percent = 100;
    updated.error.clear();
    let meeting = updated.clone();
    persist_store(&app, &store)?;
    emit_processing_progress(&app, &meeting.id, "Transcricao concluida", 100, "completed");
    Ok(meeting)
}

async fn run_api_pipeline(
    app: &AppHandle,
    state: &State<'_, AppState>,
    meeting: &Meeting,
    settings: &Settings,
) -> Result<String, String> {
    if settings.api_key.trim().is_empty() {
        return Err("Configure a chave da API antes de transcrever.".to_string());
    }

    update_meeting_progress(app, state, &meeting.id, "Enviando audio para transcricao via API", 20, "processing")?;
    let transcript = transcribe_recording(meeting, settings).await?;
    Ok(transcript)
}

fn run_local_pipeline(
    app: &AppHandle,
    state: &State<'_, AppState>,
    meeting: &Meeting,
    settings: &Settings,
) -> Result<String, String> {
    update_meeting_progress(app, state, &meeting.id, "Validando configuracao local", 5, "processing")?;
    validate_local_settings(settings)?;
    let work_dir = processing_dir(app)?.join(&meeting.id);
    fs::create_dir_all(&work_dir).map_err(|error| error.to_string())?;

    let audio_path = work_dir.join("audio.wav");
    update_meeting_progress(app, state, &meeting.id, "Extraindo audio com FFmpeg", 15, "processing")?;
    extract_audio_with_ffmpeg(meeting, settings, &audio_path)?;

    update_meeting_progress(app, state, &meeting.id, "Transcrevendo com Whisper", 50, "processing")?;
    let transcript = transcribe_with_whisper(settings, &audio_path, &work_dir)?;

    let _ = fs::remove_dir_all(&work_dir);
    Ok(transcript)
}

fn validate_local_settings(settings: &Settings) -> Result<(), String> {
    validate_command_path(&settings.ffmpeg_path, "FFmpeg")?;
    validate_command_path(&settings.whisper_cli_path, "whisper.cpp")?;
    validate_file_path(&settings.whisper_model_path, "modelo Whisper")?;
    Ok(())
}

fn validate_command_path(path: &str, label: &str) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err(format!("Configure o caminho do {label}."));
    }

    let looks_like_path = path.contains('\\') || path.contains('/') || path.contains(':');
    if looks_like_path && !Path::new(path).exists() {
        return Err(format!("O caminho do {label} nao existe: {path}"));
    }

    Ok(())
}

fn validate_file_path(path: &str, label: &str) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err(format!("Configure o caminho do {label}."));
    }
    if !Path::new(path).exists() {
        return Err(format!("O caminho do {label} nao existe: {path}"));
    }
    Ok(())
}

fn extract_audio_with_ffmpeg(
    meeting: &Meeting,
    settings: &Settings,
    audio_path: &Path,
) -> Result<(), String> {
    let output = Command::new(settings.ffmpeg_path.trim())
        .args([
            "-y",
            "-i",
            &meeting.recording_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
        ])
        .arg(audio_path)
        .output()
        .map_err(|error| format!("Falha ao executar FFmpeg: {error}"))?;

    if !output.status.success() {
        return Err(command_failure("FFmpeg", &output));
    }

    if !audio_path.exists() {
        return Err("FFmpeg concluiu, mas o arquivo de audio nao foi gerado.".to_string());
    }

    Ok(())
}

fn transcribe_with_whisper(
    settings: &Settings,
    audio_path: &Path,
    work_dir: &Path,
) -> Result<String, String> {
    let output_base = work_dir.join("transcript");
    let threads = settings.whisper_threads.max(1).to_string();
    let audio_path_string = audio_path.to_string_lossy().to_string();
    let output_base_string = output_base.to_string_lossy().to_string();
    let output = Command::new(settings.whisper_cli_path.trim())
        .arg("-m")
        .arg(settings.whisper_model_path.trim())
        .arg("-f")
        .arg(audio_path_string)
        .arg("-l")
        .arg(settings.language.as_str())
        .arg("-t")
        .arg(threads)
        .arg("-otxt")
        .arg("-of")
        .arg(output_base_string)
        .output()
        .map_err(|error| format!("Falha ao executar whisper.cpp: {error}"))?;

    if !output.status.success() {
        return Err(command_failure("whisper.cpp", &output));
    }

    let transcript_path = output_base.with_extension("txt");
    let transcript = if transcript_path.exists() {
        fs::read_to_string(transcript_path).map_err(|error| error.to_string())?
    } else {
        String::from_utf8_lossy(&output.stdout).to_string()
    };

    let transcript = transcript.trim().to_string();
    if transcript.is_empty() {
        Err("A transcricao local retornou vazia.".to_string())
    } else {
        Ok(transcript)
    }
}

fn command_failure(label: &str, output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        format!("{label} falhou: {stderr}")
    } else if !stdout.is_empty() {
        format!("{label} falhou: {stdout}")
    } else {
        format!("{label} falhou sem detalhes.")
    }
}

async fn transcribe_recording(meeting: &Meeting, settings: &Settings) -> Result<String, String> {
    let bytes = fs::read(&meeting.recording_path).map_err(|error| error.to_string())?;
    let part = multipart::Part::bytes(bytes)
        .file_name("meeting.webm")
        .mime_str(&meeting.mime_type)
        .map_err(|error| error.to_string())?;
    let form = multipart::Form::new()
        .text("model", settings.transcription_model.clone())
        .text("language", settings.language.clone())
        .text(
            "prompt",
            "Reuniao corporativa. Preserve nomes, decisoes, prazos, valores e proximos passos.",
        )
        .part("file", part);

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .bearer_auth(settings.api_key.trim())
        .multipart(form)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(api_error_message(body, "Falha ao transcrever a reuniao."));
    }

    body.get("text")
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| "A transcricao retornou vazia.".to_string())
}

fn api_error_message(body: Value, fallback: &str) -> String {
    body.pointer("/error/message")
        .and_then(Value::as_str)
        .unwrap_or(fallback)
        .to_string()
}

fn recording_path_for(state: &State<'_, AppState>, id: &str) -> Result<PathBuf, String> {
    let store = state.store.lock().map_err(|error| error.to_string())?;
    let meeting = store
        .meetings
        .iter()
        .find(|meeting| meeting.id == id)
        .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;
    Ok(PathBuf::from(&meeting.recording_path))
}

fn open_path(path: &Path) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn minimize_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal nao encontrada.".to_string())?;
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn toggle_maximize_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal nao encontrada.".to_string())?;
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn hide_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal nao encontrada.".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
fn start_dragging_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal nao encontrada.".to_string())?;
    window.start_dragging().map_err(|error| error.to_string())
}

fn mark_meeting_error(
    app: &AppHandle,
    state: &State<'_, AppState>,
    id: &str,
    error: &str,
) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    if let Some(meeting) = store.meetings.iter_mut().find(|meeting| meeting.id == id) {
        meeting.status = "error".into();
        meeting.progress_message = "Processamento interrompido".into();
        meeting.error = error.to_string();
    }
    persist_store(app, &store)?;
    emit_processing_progress(app, id, "Processamento interrompido", 0, "error");
    Ok(())
}

fn update_meeting_progress(
    app: &AppHandle,
    state: &State<'_, AppState>,
    id: &str,
    message: &str,
    percent: u8,
    status: &str,
) -> Result<(), String> {
    let percent = percent.min(100);
    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    if let Some(meeting) = store.meetings.iter_mut().find(|meeting| meeting.id == id) {
        meeting.status = status.to_string();
        meeting.progress_message = message.to_string();
        meeting.progress_percent = percent;
    }
    persist_store(app, &store)?;
    emit_processing_progress(app, id, message, percent, status);
    Ok(())
}

fn emit_processing_progress(
    app: &AppHandle,
    id: &str,
    message: &str,
    percent: u8,
    status: &str,
) {
    let _ = app.emit(
        "processing-progress",
        ProcessingProgress {
            id: id.to_string(),
            message: message.to_string(),
            percent,
            status: status.to_string(),
        },
    );
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn recordings_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("recordings");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn processing_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("processing");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("store.json"))
}

fn load_store(app: &AppHandle) -> Result<Store, String> {
    let path = store_path(app)?;
    if !path.exists() {
        return Ok(Store::default());
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

fn persist_store(app: &AppHandle, store: &Store) -> Result<(), String> {
    let path = store_path(app)?;
    let raw = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

fn normalize_extension(extension: &str) -> String {
    let normalized = extension
        .trim()
        .trim_start_matches('.')
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
        .to_lowercase();
    if normalized.is_empty() {
        "webm".into()
    } else {
        normalized
    }
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut normalized: Vec<String> = Vec::new();
    for tag in tags {
        let tag = tag.trim().trim_start_matches('#').to_string();
        if !tag.is_empty() && !normalized.iter().any(|item| item.eq_ignore_ascii_case(&tag)) {
            normalized.push(tag);
        }
    }
    normalized
}

fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir biblioteca", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Iniciar gravacao", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Finalizar gravacao", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &start, &stop, &quit])?;

    TrayIconBuilder::with_id("main-tray")
        .tooltip("Meeting Vault")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                show_main_window(app);
                let _ = app.emit("tray-open-library", ());
            }
            "start" => {
                show_main_window(app);
                let _ = app.emit("tray-start-recording", ());
            }
            "stop" => {
                let _ = app.emit("tray-stop-recording", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let store = load_store(app.handle()).unwrap_or_default();
            app.manage(AppState {
                store: Mutex::new(store),
            });
            setup_tray(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let window_for_close = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_for_close.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_meetings,
            get_settings,
            save_settings,
            save_recording,
            update_meeting_title,
            update_meeting_metadata,
            delete_meeting,
            open_recording,
            reveal_recording,
            transcribe_meeting,
            minimize_window,
            toggle_maximize_window,
            hide_window,
            start_dragging_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running Meeting Vault");
}
