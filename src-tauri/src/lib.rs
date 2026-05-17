use chrono::Utc;
use reqwest::multipart;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
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
    #[serde(default)]
    summary: String,
    status: String,
    #[serde(default)]
    progress_message: String,
    #[serde(default)]
    progress_percent: u8,
    error: String,
    #[serde(default)]
    youtube_video_id: String,
    #[serde(default)]
    youtube_url: String,
    #[serde(default)]
    transcript_segments: Vec<TranscriptSegment>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiarizationCheckResult {
    python_ok: bool,
    python_version: String,
    python_error: String,
    pyannote_ok: bool,
    pyannote_version: String,
    pyannote_error: String,
    model_ok: bool,
    model_error: String,
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
    #[serde(default = "default_summary_mode")]
    summary_mode: String,
    #[serde(default)]
    open_router_api_key: String,
    #[serde(default = "default_open_router_model")]
    open_router_model: String,
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
    #[serde(default)]
    youtube_client_id: String,
    #[serde(default)]
    youtube_client_secret: String,
    #[serde(default = "default_true")]
    enable_meet_detection: bool,
    #[serde(default)]
    enable_diarization: bool,
    #[serde(default)]
    diarization_num_speakers: u8,
    #[serde(default = "default_python_path")]
    python_path: String,
    #[serde(default)]
    diarization_script_path: String,
    #[serde(default)]
    huggingface_token: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            processing_mode: default_processing_mode(),
            transcription_model: "gpt-4o-mini-transcribe".into(),
            summary_mode: default_summary_mode(),
            open_router_api_key: String::new(),
            open_router_model: default_open_router_model(),
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
            youtube_client_id: String::new(),
            youtube_client_secret: String::new(),
            enable_meet_detection: true,
            enable_diarization: false,
            diarization_num_speakers: 0,
            python_path: default_python_path(),
            diarization_script_path: String::new(),
            huggingface_token: String::new(),
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TranscriptSegment {
    speaker: String,
    text: String,
    start: f64,
    end: f64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct YoutubeTokens {
    #[serde(default)]
    access_token: String,
    #[serde(default)]
    refresh_token: String,
    #[serde(default)]
    expires_at: i64,
}

fn default_processing_mode() -> String {
    "local".into()
}

fn default_summary_mode() -> String {
    "disabled".into()
}

fn default_open_router_model() -> String {
    "arcee-ai/trinity-large-thinking:free".into()
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

fn default_python_path() -> String {
    "python".into()
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
struct Store {
    meetings: Vec<Meeting>,
    settings: Settings,
    #[serde(default)]
    youtube_tokens: YoutubeTokens,
}

#[derive(Debug)]
struct AppState {
    store: Mutex<Store>,
    meet_watcher_active: Arc<AtomicBool>,
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
        summary: String::new(),
        status: "recorded".into(),
        progress_message: String::new(),
        progress_percent: 0,
        error: String::new(),
        youtube_video_id: String::new(),
        youtube_url: String::new(),
        transcript_segments: Vec::new(),
    };

    let mut store = state.store.lock().map_err(|error| error.to_string())?;
    store.meetings.push(meeting.clone());
    persist_store(&app, &store)?;
    Ok(meeting)
}

#[tauri::command]
fn begin_recording_session(app: AppHandle) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let temp_path = recordings_dir(&app)?.join(format!("{session_id}.tmp"));
    fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    Ok(session_id)
}

#[tauri::command]
fn append_recording_chunk(app: AppHandle, session_id: String, bytes: Vec<u8>) -> Result<(), String> {
    let temp_path = recordings_dir(&app)?.join(format!("{session_id}.tmp"));
    let mut file = fs::OpenOptions::new()
        .append(true)
        .open(&temp_path)
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FinalizeRecordingInput {
    session_id: String,
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
}

#[tauri::command]
fn finalize_recording_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: FinalizeRecordingInput,
) -> Result<Meeting, String> {
    let recordings_dir = recordings_dir(&app)?;
    let temp_path = recordings_dir.join(format!("{}.tmp", input.session_id));
    let extension = normalize_extension(&input.file_extension);
    let final_path = recordings_dir.join(format!("{}.{extension}", input.session_id));
    fs::rename(&temp_path, &final_path).map_err(|e| e.to_string())?;
    let size_bytes = fs::metadata(&final_path).map(|m| m.len()).unwrap_or(0);

    let meeting = Meeting {
        id: input.session_id,
        title: input.title.trim().to_string(),
        created_at: Utc::now().to_rfc3339(),
        started_at: input.started_at,
        category: input.category.trim().to_string(),
        tags: normalize_tags(input.tags),
        duration_seconds: input.duration_seconds,
        size_bytes,
        recording_path: final_path.to_string_lossy().to_string(),
        mime_type: input.mime_type,
        transcript: String::new(),
        summary: String::new(),
        status: "recorded".into(),
        progress_message: String::new(),
        progress_percent: 0,
        error: String::new(),
        youtube_video_id: String::new(),
        youtube_url: String::new(),
        transcript_segments: Vec::new(),
    };

    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.meetings.push(meeting.clone());
    persist_store(&app, &store)?;
    Ok(meeting)
}

#[tauri::command]
fn cancel_recording_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let temp_path = recordings_dir(&app)?.join(format!("{session_id}.tmp"));
    if temp_path.exists() {
        fs::remove_file(&temp_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─── YouTube integration ─────────────────────────────────────────────────────

#[tauri::command]
fn get_youtube_connection_status(state: State<'_, AppState>) -> Result<bool, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    Ok(!store.youtube_tokens.refresh_token.is_empty())
}

#[tauri::command]
fn disconnect_youtube(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    store.youtube_tokens = YoutubeTokens::default();
    persist_store(&app, &store)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    Command::new("cmd")
        .args(["/c", "start", "", &url])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_local_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Meeting, String> {
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    let meeting = store
        .meetings
        .iter_mut()
        .find(|m| m.id == id)
        .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;
    if !meeting.recording_path.is_empty() && Path::new(&meeting.recording_path).exists() {
        fs::remove_file(&meeting.recording_path).map_err(|e| e.to_string())?;
    }
    meeting.recording_path = String::new();
    let meeting = meeting.clone();
    persist_store(&app, &store)?;
    Ok(meeting)
}

#[tauri::command]
async fn connect_youtube(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client_id, client_secret) = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        (
            store.settings.youtube_client_id.trim().to_string(),
            store.settings.youtube_client_secret.trim().to_string(),
        )
    };
    if client_id.is_empty() || client_secret.is_empty() {
        return Err("Configure o Client ID e Client Secret do YouTube nas configuracoes.".into());
    }

    let redirect_uri = "http://localhost:8765/oauth/callback";
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth\
         ?client_id={client_id}\
         &redirect_uri=http%3A%2F%2Flocalhost%3A8765%2Foauth%2Fcallback\
         &response_type=code\
         &scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload\
         &access_type=offline\
         &prompt=consent"
    );

    // Unblock any lingering listener from a previous failed attempt so port 8765 is freed
    {
        use std::net::TcpStream;
        let _ = TcpStream::connect_timeout(
            &"127.0.0.1:8765".parse::<std::net::SocketAddr>().unwrap(),
            std::time::Duration::from_millis(100),
        );
        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    // Start local HTTP server to capture OAuth callback
    let (tx, rx) = std::sync::mpsc::channel::<Result<String, String>>();
    std::thread::spawn(move || {
        use std::io::{BufRead, BufReader, Write};
        use std::net::TcpListener;

        // Retry bind in case the old thread is still releasing the port
        let listener = {
            let mut last_err = String::new();
            let mut bound = None;
            for _ in 0..6 {
                match TcpListener::bind("127.0.0.1:8765") {
                    Ok(l) => { bound = Some(l); break; }
                    Err(e) => {
                        last_err = e.to_string();
                        std::thread::sleep(std::time::Duration::from_millis(300));
                    }
                }
            }
            match bound {
                Some(l) => l,
                None => {
                    let _ = tx.send(Err(format!("Falha ao abrir servidor local: {last_err}")));
                    return;
                }
            }
        };

        match listener.accept() {
            Ok((stream, _)) => {
                let reader = BufReader::new(&stream);
                let first_line = reader
                    .lines()
                    .next()
                    .and_then(|r| r.ok())
                    .unwrap_or_default();

                // Extract code from "GET /oauth/callback?code=XXX HTTP/1.1"
                let code = first_line
                    .split('?')
                    .nth(1)
                    .and_then(|q| q.split('&').find(|p| p.starts_with("code=")))
                    .and_then(|p| p.strip_prefix("code="))
                    .map(|c| c.split_whitespace().next().unwrap_or(c).to_string());

                let html = "<html><body><h2>Autorizacao concluida! Pode fechar esta aba.</h2></body></html>";
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\n\r\n{html}",
                    html.len()
                );
                let _ = (&stream).write_all(response.as_bytes());

                match code {
                    Some(c) => { let _ = tx.send(Ok(c)); }
                    None => { let _ = tx.send(Err("Codigo de autorizacao nao encontrado.".into())); }
                }
            }
            Err(e) => { let _ = tx.send(Err(format!("Timeout ou erro na autorizacao: {e}"))); }
        }
    });

    // Open browser — cmd /c start splits URL on '&'; rundll32 avoids shell interpretation
    Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &auth_url])
        .spawn()
        .map_err(|e| format!("Falha ao abrir o navegador: {e}"))?;

    // Wait for code from the callback thread (2 minute timeout)
    let code = rx
        .recv_timeout(std::time::Duration::from_secs(120))
        .map_err(|_| "Timeout: autorizacao nao concluida dentro de 2 minutos.".to_string())??;

    // Exchange code for tokens
    let client = reqwest::Client::new();
    let params = [
        ("code", code.as_str()),
        ("client_id", &client_id),
        ("client_secret", &client_secret),
        ("redirect_uri", redirect_uri),
        ("grant_type", "authorization_code"),
    ];
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Falha ao trocar token: {e}"))?;

    let body: Value = response.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = body["error"].as_str() {
        let desc = body["error_description"].as_str().unwrap_or("");
        return Err(format!("Erro OAuth do Google: {err} — {desc}"));
    }

    let access_token = body["access_token"]
        .as_str()
        .ok_or_else(|| format!("Token de acesso ausente. Resposta: {body}"))?
        .to_string();
    let refresh_token = body["refresh_token"]
        .as_str()
        .ok_or("Token de atualizacao ausente. Certifique-se de usar prompt=consent.")?
        .to_string();
    let expires_in = body["expires_in"].as_i64().unwrap_or(3600);
    let expires_at = Utc::now().timestamp() + expires_in;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.youtube_tokens = YoutubeTokens { access_token, refresh_token, expires_at };
        persist_store(&app, &store)?;
    }

    let _ = app.emit("youtube-connected", ());
    Ok(())
}

async fn refresh_youtube_token_if_needed(
    client: &reqwest::Client,
    app: &AppHandle,
    state: &State<'_, AppState>,
) -> Result<String, String> {
    let (access_token, refresh_token, expires_at, client_id, client_secret) = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        (
            store.youtube_tokens.access_token.clone(),
            store.youtube_tokens.refresh_token.clone(),
            store.youtube_tokens.expires_at,
            store.settings.youtube_client_id.trim().to_string(),
            store.settings.youtube_client_secret.trim().to_string(),
        )
    };

    if refresh_token.is_empty() {
        return Err("YouTube nao conectado. Configure a integracao nas configuracoes.".into());
    }

    // Refresh if expires within 60 seconds
    if Utc::now().timestamp() + 60 < expires_at {
        return Ok(access_token);
    }

    let params = [
        ("refresh_token", refresh_token.as_str()),
        ("client_id", &client_id),
        ("client_secret", &client_secret),
        ("grant_type", "refresh_token"),
    ];
    let body: Value = client
        .post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Falha ao renovar token: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let new_token = body["access_token"]
        .as_str()
        .ok_or("Falha ao renovar token de acesso.")?
        .to_string();
    let expires_in = body["expires_in"].as_i64().unwrap_or(3600);
    let new_expires_at = Utc::now().timestamp() + expires_in;

    {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        store.youtube_tokens.access_token = new_token.clone();
        store.youtube_tokens.expires_at = new_expires_at;
        persist_store(app, &store)?;
    }

    Ok(new_token)
}

#[tauri::command]
async fn upload_to_youtube(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    title: String,
    description: String,
    privacy: String,
    delete_local: bool,
) -> Result<Meeting, String> {
    let (recording_path, mime_type) = {
        let store = state.store.lock().map_err(|e| e.to_string())?;
        let meeting = store
            .meetings
            .iter()
            .find(|m| m.id == id)
            .ok_or("Reuniao nao encontrada.")?;
        if meeting.recording_path.is_empty() {
            return Err("Arquivo local nao disponivel para upload.".into());
        }
        if !Path::new(&meeting.recording_path).exists() {
            return Err("Arquivo de video nao encontrado no disco.".into());
        }
        (meeting.recording_path.clone(), meeting.mime_type.clone())
    };

    emit_processing_progress(&app, &id, "Preparando upload", 2, "processing");

    let client = reqwest::Client::new();
    let access_token = refresh_youtube_token_if_needed(&client, &app, &state).await?;

    let file_meta = fs::metadata(&recording_path).map_err(|e| e.to_string())?;
    let file_size = file_meta.len();

    // Initiate resumable upload session
    let metadata = json!({
        "snippet": {
            "title": title.trim(),
            "description": description.trim(),
            "categoryId": "22"
        },
        "status": {
            "privacyStatus": privacy
        }
    });

    let init_response = client
        .post("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status")
        .bearer_auth(&access_token)
        .header("X-Upload-Content-Type", &mime_type)
        .header("X-Upload-Content-Length", file_size.to_string())
        .json(&metadata)
        .send()
        .await
        .map_err(|e| format!("Falha ao iniciar sessao de upload: {e}"))?;

    if !init_response.status().is_success() {
        let status = init_response.status();
        let body = init_response.text().await.unwrap_or_default();
        return Err(format!("Erro ao iniciar upload no YouTube ({status}): {body}"));
    }

    let upload_uri = init_response
        .headers()
        .get("Location")
        .and_then(|v| v.to_str().ok())
        .ok_or("YouTube nao retornou URI de upload.")?
        .to_string();

    emit_processing_progress(&app, &id, "Sessao de upload iniciada", 5, "processing");

    // Upload in 8 MB chunks
    const CHUNK_SIZE: u64 = 8 * 1024 * 1024;
    let mut file = tokio::fs::File::open(&recording_path)
        .await
        .map_err(|e| e.to_string())?;
    let mut bytes_sent: u64 = 0;
    let video_id;

    loop {
        let start = bytes_sent;
        let end = (start + CHUNK_SIZE - 1).min(file_size - 1);
        let chunk_len = end - start + 1;

        let mut buf = vec![0u8; chunk_len as usize];
        use tokio::io::AsyncReadExt;
        file.read_exact(&mut buf)
            .await
            .map_err(|e| format!("Falha ao ler chunk: {e}"))?;

        let content_range = format!("bytes {start}-{end}/{file_size}");
        let response = client
            .put(&upload_uri)
            .header("Content-Range", &content_range)
            .header("Content-Type", &mime_type)
            .body(buf)
            .send()
            .await
            .map_err(|e| format!("Falha ao enviar chunk: {e}"))?;

        bytes_sent += chunk_len;

        let status = response.status().as_u16();
        if status == 308 {
            // Resume Incomplete — continue to next chunk
            let percent = (5 + bytes_sent * 90 / file_size) as u8;
            emit_processing_progress(&app, &id, "Enviando video...", percent, "processing");
            continue;
        } else if status == 200 || status == 201 {
            let body: Value = response.json().await.map_err(|e| e.to_string())?;
            video_id = body["id"].as_str().unwrap_or("").to_string();
            break;
        } else {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Erro durante upload ({status}): {body}"));
        }
    }

    if video_id.is_empty() {
        return Err("YouTube nao retornou ID do video apos upload.".into());
    }

    let youtube_url = format!("https://www.youtube.com/watch?v={video_id}");
    emit_processing_progress(&app, &id, "Finalizando publicacao", 98, "processing");

    // Persist result
    let updated_meeting = {
        let mut store = state.store.lock().map_err(|e| e.to_string())?;
        let meeting = store
            .meetings
            .iter_mut()
            .find(|m| m.id == id)
            .ok_or("Reuniao nao encontrada.")?;
        meeting.youtube_video_id = video_id;
        meeting.youtube_url = youtube_url;
        meeting.status = "completed".into();
        meeting.progress_message = String::new();
        meeting.progress_percent = 0;
        if delete_local && !meeting.recording_path.is_empty() {
            if Path::new(&meeting.recording_path).exists() {
                fs::remove_file(&meeting.recording_path).map_err(|e| e.to_string())?;
            }
            meeting.recording_path = String::new();
        }
        let m = meeting.clone();
        persist_store(&app, &store)?;
        m
    };

    emit_processing_progress(&app, &id, "Video publicado no YouTube", 100, "completed");
    Ok(updated_meeting)
}

// ─────────────────────────────────────────────────────────────────────────────

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

    let result: Result<(String, Vec<TranscriptSegment>), String> =
        match settings.processing_mode.as_str() {
            "local" => run_local_pipeline(&app, &state, &meeting, &settings),
            "hybrid" => match run_local_pipeline(&app, &state, &meeting, &settings) {
                Ok(pair) => Ok(pair),
                Err(local_error) => {
                    if settings.api_key.trim().is_empty() {
                        Err(format!(
                            "Processamento local falhou e a API nao esta configurada: {local_error}"
                        ))
                    } else {
                        update_meeting_progress(
                            &app,
                            &state,
                            &id,
                            "Fallback para API",
                            12,
                            "processing",
                        )?;
                        run_api_pipeline(&app, &state, &meeting, &settings)
                            .await
                            .map(|t| (t, vec![]))
                            .map_err(|api_error| {
                                format!("Local falhou: {local_error}. API falhou: {api_error}")
                            })
                    }
                }
            },
            _ => run_api_pipeline(&app, &state, &meeting, &settings)
                .await
                .map(|t| (t, vec![])),
        };

    let (transcript, segments) = match result {
        Ok(pair) => pair,
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
    updated.transcript_segments = segments;
    updated.status = "completed".into();
    updated.progress_message = "Transcricao concluida".into();
    updated.progress_percent = 100;
    updated.error.clear();
    let meeting = updated.clone();
    persist_store(&app, &store)?;
    emit_processing_progress(&app, &meeting.id, "Transcricao concluida", 100, "completed");
    Ok(meeting)
}

#[tauri::command]
async fn summarize_meeting(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Meeting, String> {
    let (meeting, settings) = {
        let mut store = state.store.lock().map_err(|error| error.to_string())?;
        let settings = store.settings.clone();
        if settings.summary_mode != "openrouter" {
            return Err("Ative o resumo com OpenRouter nas configuracoes.".to_string());
        }
        if settings.open_router_api_key.trim().is_empty() {
            return Err("Configure a chave do OpenRouter antes de resumir.".to_string());
        }

        let meeting = store
            .meetings
            .iter_mut()
            .find(|meeting| meeting.id == id)
            .ok_or_else(|| "Reuniao nao encontrada.".to_string())?;

        if meeting.transcript.trim().is_empty() {
            return Err("Transcreva a reuniao antes de gerar um resumo.".to_string());
        }

        meeting.status = "processing".into();
        meeting.progress_message = "Preparando resumo".into();
        meeting.progress_percent = 2;
        meeting.error.clear();
        let meeting_clone = meeting.clone();
        persist_store(&app, &store)?;
        (meeting_clone, settings)
    };

    update_meeting_progress(&app, &state, &id, "Preparando resumo", 2, "processing")?;

    let result = summarize_transcript_openrouter(&app, &state, &meeting, &settings).await;
    let summary = match result {
        Ok(summary) => summary,
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
    updated.summary = summary;
    updated.status = "completed".into();
    updated.progress_message = "Resumo concluido".into();
    updated.progress_percent = 100;
    updated.error.clear();
    let meeting = updated.clone();
    persist_store(&app, &store)?;
    emit_processing_progress(&app, &meeting.id, "Resumo concluido", 100, "completed");
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
) -> Result<(String, Vec<TranscriptSegment>), String> {
    update_meeting_progress(app, state, &meeting.id, "Validando configuracao local", 5, "processing")?;
    validate_local_settings(settings)?;
    let work_dir = processing_dir(app)?.join(&meeting.id);
    fs::create_dir_all(&work_dir).map_err(|error| error.to_string())?;

    let audio_path = work_dir.join("audio.wav");
    update_meeting_progress(app, state, &meeting.id, "Extraindo audio com FFmpeg", 15, "processing")?;
    extract_audio_with_ffmpeg(meeting, settings, &audio_path)?;

    update_meeting_progress(app, state, &meeting.id, "Transcrevendo com Whisper", 50, "processing")?;
    let (transcript, json_path) = transcribe_with_whisper(settings, &audio_path, &work_dir)?;

    let mut segments: Vec<TranscriptSegment> = Vec::new();
    if settings.enable_diarization && !settings.diarization_script_path.trim().is_empty() {
        update_meeting_progress(app, state, &meeting.id, "Identificando falantes", 80, "processing")?;
        let seg_path = work_dir.join("diarization.json");
        match run_diarization(settings, &audio_path, &json_path, &seg_path) {
            Ok(segs) => segments = segs,
            Err(e) => {
                let _ = app.emit(
                    "processing-progress",
                    json!({
                        "id": meeting.id,
                        "message": format!("Diarizacao falhou (transcript salvo sem falantes): {e}"),
                        "percent": 85,
                        "status": "processing"
                    }),
                );
            }
        }
    }

    let _ = fs::remove_dir_all(&work_dir);
    Ok((transcript, segments))
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
) -> Result<(String, PathBuf), String> {
    let output_base = work_dir.join("transcript");
    let threads = settings.whisper_threads.max(1).to_string();
    let audio_path_string = audio_path.to_string_lossy().to_string();
    let output_base_string = output_base.to_string_lossy().to_string();
    let mut cmd = Command::new(settings.whisper_cli_path.trim());
    cmd.arg("-m")
        .arg(settings.whisper_model_path.trim())
        .arg("-f")
        .arg(audio_path_string)
        .arg("-t")
        .arg(threads)
        .arg("-oj")
        .arg("-of")
        .arg(output_base_string);
    if !settings.language.trim().is_empty() {
        cmd.arg("-l").arg(settings.language.trim());
    }
    let output = cmd
        .output()
        .map_err(|error| format!("Falha ao executar whisper.cpp: {error}"))?;

    if !output.status.success() {
        return Err(command_failure("whisper.cpp", &output));
    }

    let json_path = output_base.with_extension("json");
    let transcript = if json_path.exists() {
        let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
        let data: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        data["transcription"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|seg| seg["text"].as_str())
            .map(|t| t.trim())
            .filter(|t| !t.is_empty())
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    };

    let transcript = transcript.trim().to_string();
    if transcript.is_empty() {
        Err("A transcricao local retornou vazia.".to_string())
    } else {
        Ok((transcript, json_path))
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

fn diagnostic_failure(label: &str, output: &std::process::Output) -> String {
    const MAX_CHARS: usize = 1200;
    let message = command_failure(label, output);
    if message.chars().count() <= MAX_CHARS {
        return message;
    }

    let mut truncated: String = message.chars().take(MAX_CHARS).collect();
    truncated.push_str("\n... detalhes truncados");
    truncated
}

fn run_diarization(
    settings: &Settings,
    audio_path: &Path,
    whisper_json_path: &Path,
    output_path: &Path,
) -> Result<Vec<TranscriptSegment>, String> {
    let mut cmd = Command::new(settings.python_path.trim());
    cmd.arg(settings.diarization_script_path.trim())
        .arg(audio_path)
        .arg(whisper_json_path)
        .arg(output_path);

    if settings.diarization_num_speakers > 0 {
        cmd.arg("--num-speakers")
            .arg(settings.diarization_num_speakers.to_string());
    }

    let out = cmd
        .output()
        .map_err(|e| format!("Falha ao executar Python para diarizacao: {e}"))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(format!("diarize.py falhou: {stderr}"));
    }

    let content = fs::read_to_string(output_path)
        .map_err(|e| format!("Falha ao ler resultado da diarizacao: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("JSON de diarizacao invalido: {e}"))
}

#[tauri::command]
fn check_diarization_setup(python_path: String) -> DiarizationCheckResult {
    let python = if python_path.trim().is_empty() {
        "python"
    } else {
        python_path.trim()
    };

    // 1. Check Python availability
    let (python_ok, python_version, python_error) = match Command::new(python).arg("--version").output() {
        Ok(out) if out.status.success() => {
            let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let v = if v.is_empty() {
                String::from_utf8_lossy(&out.stderr).trim().to_string()
            } else {
                v
            };
            (true, v, String::new())
        }
        Ok(out) => {
            let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
            let details = if msg.is_empty() {
                "Nao encontrado".to_string()
            } else {
                msg
            };
            (false, String::new(), details)
        }
        Err(e) => (false, String::new(), format!("Nao encontrado: {e}")),
    };

    // 2. Check pyannote.audio installation
    let (pyannote_ok, pyannote_version, pyannote_error) = if python_ok {
        match Command::new(python)
            .args(["-c", "import pyannote.audio; print(pyannote.audio.__version__)"])
            .output()
        {
            Ok(out) if out.status.success() => {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                (true, v, String::new())
            }
            Ok(out) => (false, String::new(), diagnostic_failure("pyannote.audio", &out)),
            Err(e) => (false, String::new(), format!("pyannote.audio falhou: {e}")),
        }
    } else {
        (false, String::new(), String::new())
    };

    // 3. Check if model is in local HuggingFace cache (no network call)
    let (model_ok, model_error) = if pyannote_ok {
        match Command::new(python)
            .args([
                "-c",
                "from huggingface_hub import hf_hub_download; \
                 hf_hub_download('pyannote/speaker-diarization-3.1', 'config.yaml', local_files_only=True)",
            ])
            .output()
        {
            Ok(out) if out.status.success() => (true, String::new()),
            Ok(out) => (false, diagnostic_failure("Modelo pyannote", &out)),
            Err(e) => (false, format!("Modelo pyannote falhou: {e}")),
        }
    } else {
        (false, String::new())
    };

    DiarizationCheckResult {
        python_ok,
        python_version,
        python_error,
        pyannote_ok,
        pyannote_version,
        pyannote_error,
        model_ok,
        model_error,
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AutoConfigureResult {
    python_path: String,
    script_path: String,
}

#[tauri::command]
fn auto_configure_diarization(app: tauri::AppHandle) -> Result<AutoConfigureResult, String> {
    // Find Python executable
    #[cfg(target_os = "windows")]
    let python_path = {
        let out = Command::new("where").arg("python").output().ok();
        out.and_then(|o| {
            if o.status.success() {
                let s = String::from_utf8_lossy(&o.stdout);
                s.lines().next().map(|l| l.trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "python".to_string())
    };
    #[cfg(not(target_os = "windows"))]
    let python_path = {
        let out = Command::new("which").arg("python3").output().ok();
        out.and_then(|o| {
            if o.status.success() {
                Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "python3".to_string())
    };

    // Resolve diarize.py path relative to the app's resource directory or executable
    let script_path = {
        // Try resource dir first (for packaged app)
        let resource_dir = app.path().resource_dir().ok();
        let candidate_resource = resource_dir.map(|d| d.join("scripts").join("diarize.py"));

        // Try executable dir (for dev mode)
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()));
        let candidate_exe = exe_dir.map(|d| {
            // Walk up until we find a scripts/diarize.py
            let mut dir = d.clone();
            for _ in 0..5 {
                let candidate = dir.join("scripts").join("diarize.py");
                if candidate.exists() {
                    return candidate;
                }
                if let Some(parent) = dir.parent() {
                    dir = parent.to_path_buf();
                } else {
                    break;
                }
            }
            d.join("scripts").join("diarize.py")
        });

        if let Some(p) = candidate_resource.filter(|p| p.exists()) {
            p.to_string_lossy().to_string()
        } else if let Some(p) = candidate_exe.filter(|p| p.exists()) {
            p.to_string_lossy().to_string()
        } else {
            String::new()
        }
    };

    // Persist settings update
    let state = app.state::<AppState>();
    let mut store = state.store.lock().map_err(|e| e.to_string())?;
    if store.settings.python_path.trim() == "python" || store.settings.python_path.trim().is_empty() {
        store.settings.python_path = python_path.clone();
    }
    if store.settings.diarization_script_path.trim().is_empty() && !script_path.is_empty() {
        store.settings.diarization_script_path = script_path.clone();
    }
    persist_store(&app, &store)?;

    Ok(AutoConfigureResult { python_path, script_path })
}

#[tauri::command]
async fn download_diarization_model(python_path: String, token: String) -> Result<(), String> {
    let python = if python_path.trim().is_empty() {
        "python".to_string()
    } else {
        python_path.trim().to_string()
    };

    let out = Command::new(&python)
        .args([
            "-c",
            "import warnings; warnings.filterwarnings('ignore'); \
             from pyannote.audio import Pipeline; import os; \
             Pipeline.from_pretrained('pyannote/speaker-diarization-3.1', \
             token=os.environ['HF_TOKEN'])",
        ])
        .env("HF_TOKEN", token.trim())
        .output()
        .map_err(|e| format!("Falha ao executar Python: {e}"))?;

    if out.status.success() {
        Ok(())
    } else {
        Err(command_failure("Download do modelo pyannote", &out))
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

async fn summarize_transcript_openrouter(
    app: &AppHandle,
    state: &State<'_, AppState>,
    meeting: &Meeting,
    settings: &Settings,
) -> Result<String, String> {
    if settings.summary_mode != "openrouter" {
        return Err("Ative o resumo com OpenRouter nas configuracoes.".to_string());
    }
    if settings.open_router_api_key.trim().is_empty() {
        return Err("Configure a chave do OpenRouter antes de resumir.".to_string());
    }

    let model = {
        let configured = settings.open_router_model.trim();
        if configured.is_empty() {
            default_open_router_model()
        } else {
            configured.to_string()
        }
    };

    let chunks = split_text_chunks(&meeting.transcript, 24_000);
    if chunks.is_empty() {
        return Err("A transcricao esta vazia.".to_string());
    }

    update_meeting_progress(
        app,
        state,
        &meeting.id,
        "Enviando transcricao ao OpenRouter",
        15,
        "processing",
    )?;

    if chunks.len() == 1 {
        let summary =
            request_openrouter_summary(settings, &model, &meeting.title, &chunks[0], false).await?;
        return Ok(summary);
    }

    let mut partial_summaries = Vec::with_capacity(chunks.len());
    for (index, chunk) in chunks.iter().enumerate() {
        let percent = 15 + (((index + 1) * 55) / chunks.len()) as u8;
        update_meeting_progress(
            app,
            state,
            &meeting.id,
            &format!("Resumindo parte {} de {}", index + 1, chunks.len()),
            percent,
            "processing",
        )?;
        let partial =
            request_openrouter_summary(settings, &model, &meeting.title, chunk, true).await?;
        partial_summaries.push(partial);
    }

    update_meeting_progress(
        app,
        state,
        &meeting.id,
        "Consolidando resumo",
        82,
        "processing",
    )?;
    let combined = partial_summaries.join("\n\n---\n\n");
    request_openrouter_summary(settings, &model, &meeting.title, &combined, false).await
}

async fn request_openrouter_summary(
    settings: &Settings,
    model: &str,
    title: &str,
    transcript: &str,
    partial: bool,
) -> Result<String, String> {
    let scope = if partial {
        "Gere um resumo parcial deste trecho de transcricao."
    } else {
        "Gere um resumo final desta transcricao de reuniao."
    };
    let prompt = format!(
        "{scope}\n\nTitulo da reuniao: {title}\n\nRetorne em Markdown conciso, em portugues, com estas secoes:\n- Resumo executivo\n- Pontos-chave\n- Decisoes\n- Proximos passos\n\nTranscricao:\n{transcript}"
    );

    let request = json!({
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Voce resume reunioes corporativas com foco em clareza, decisoes, riscos e proximas acoes. Nao invente informacoes ausentes."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.2,
        "max_tokens": if partial { 900 } else { 1400 }
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(settings.open_router_api_key.trim())
        .header("HTTP-Referer", "https://meeting-vault.local")
        .header("X-OpenRouter-Title", "Meeting Vault")
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("Falha ao chamar OpenRouter: {error}"))?;

    let status = response.status();
    let text = response.text().await.map_err(|error| error.to_string())?;
    let body: Value = serde_json::from_str(&text).unwrap_or_else(|_| json!({ "raw": text }));
    if !status.is_success() {
        return Err(api_error_message(body, "Falha ao gerar resumo no OpenRouter."));
    }

    body.pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .ok_or_else(|| "O OpenRouter retornou um resumo vazio.".to_string())
}

fn split_text_chunks(text: &str, max_chars: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();

    for paragraph in text.split("\n\n") {
        let paragraph = paragraph.trim();
        if paragraph.is_empty() {
            continue;
        }

        if current.len() + paragraph.len() + 2 > max_chars && !current.is_empty() {
            chunks.push(current.trim().to_string());
            current.clear();
        }

        if paragraph.len() > max_chars {
            for sentence in paragraph.split_terminator(['.', '!', '?']) {
                let sentence = sentence.trim();
                if sentence.is_empty() {
                    continue;
                }
                if current.len() + sentence.len() + 2 > max_chars && !current.is_empty() {
                    chunks.push(current.trim().to_string());
                    current.clear();
                }
                current.push_str(sentence);
                current.push_str(". ");
            }
        } else {
            current.push_str(paragraph);
            current.push_str("\n\n");
        }
    }

    if !current.trim().is_empty() {
        chunks.push(current.trim().to_string());
    }

    chunks
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

#[cfg(windows)]
unsafe extern "system" fn enum_window_callback(
    hwnd: windows::Win32::Foundation::HWND,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::BOOL {
    let titles = &mut *(lparam.0 as *mut Vec<String>);
    let mut buf = [0u16; 512];
    let len = windows::Win32::UI::WindowsAndMessaging::GetWindowTextW(hwnd, &mut buf);
    if len > 0 {
        let title = String::from_utf16_lossy(&buf[..len as usize]);
        if title.contains("Google Meet") || title.starts_with("Meet:") {
            titles.push(title);
        }
    }
    windows::Win32::Foundation::BOOL(1)
}

#[cfg(windows)]
fn detect_google_meet_window() -> Option<String> {
    let mut titles: Vec<String> = Vec::new();
    let ptr = &mut titles as *mut Vec<String>;
    unsafe {
        let _ = windows::Win32::UI::WindowsAndMessaging::EnumWindows(
            Some(enum_window_callback),
            windows::Win32::Foundation::LPARAM(ptr as isize),
        );
    }
    titles.first().map(|title| {
        if title.contains("Google Meet") {
            // "Daily Standup - Google Meet" ou "Daily Standup - Google Meet - Google Chrome"
            title
                .split(" - Google Meet")
                .next()
                .unwrap_or("Reuniao Google Meet")
                .trim()
                .to_string()
        } else {
            // "Meet: gcq-bsde-heu - Google Chrome" (link direto sem nome)
            "Reuniao Google Meet".to_string()
        }
    })
}

#[cfg(not(windows))]
fn detect_google_meet_window() -> Option<String> {
    None
}

fn show_meet_prompt(app: &AppHandle, title: &str) {
    let label = "meet-prompt";

    if let Some(existing) = app.get_webview_window(label) {
        let _ = existing.close();
    }

    let (screen_w, screen_h) = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|m| {
            let scale = m.scale_factor();
            let size = m.size();
            (size.width as f64 / scale, size.height as f64 / scale)
        })
        .unwrap_or((1920.0, 1080.0));

    let win_w = 320.0_f64;
    let win_h = 155.0_f64;
    let margin = 16.0_f64;
    let taskbar_h = 56.0_f64;

    let encoded: String = title
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' | '.' | '~' => c.to_string(),
            ' ' => "%20".to_string(),
            c => format!("%{:02X}", c as u32),
        })
        .collect();

    let _ = tauri::WebviewWindowBuilder::new(
        app,
        label,
        tauri::WebviewUrl::App(
            format!("index.html?mode=meet-prompt&title={}", encoded).into(),
        ),
    )
    .title("")
    .inner_size(win_w, win_h)
    .position(
        screen_w - win_w - margin,
        screen_h - win_h - taskbar_h - margin,
    )
    .always_on_top(true)
    .decorations(false)
    .transparent(true)
    .skip_taskbar(true)
    .resizable(false)
    .build();
}

#[tauri::command]
async fn start_meet_watcher(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let active = state.meet_watcher_active.clone();
    if active.load(Ordering::SeqCst) {
        return Ok(());
    }
    active.store(true, Ordering::SeqCst);

    tokio::spawn(async move {
        let mut was_in_meet = false;
        let mut last_title = String::new();

        while active.load(Ordering::SeqCst) {
            tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

            let detection_enabled = app
                .try_state::<AppState>()
                .map(|s| {
                    s.store
                        .lock()
                        .map(|store| store.settings.enable_meet_detection)
                        .unwrap_or(true)
                })
                .unwrap_or(true);

            if !detection_enabled {
                if was_in_meet {
                    if let Some(w) = app.get_webview_window("meet-prompt") {
                        let _ = w.close();
                    }
                    was_in_meet = false;
                    last_title.clear();
                }
                continue;
            }

            match detect_google_meet_window() {
                Some(title) => {
                    if !was_in_meet || title != last_title {
                        show_meet_prompt(&app, &title);
                        last_title = title;
                        was_in_meet = true;
                    }
                }
                None => {
                    if was_in_meet {
                        if let Some(w) = app.get_webview_window("meet-prompt") {
                            let _ = w.close();
                        }
                        was_in_meet = false;
                        last_title.clear();
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_meet_watcher(state: State<'_, AppState>) -> Result<(), String> {
    state.meet_watcher_active.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn accept_meet_prompt(app: AppHandle, title: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("meet-prompt") {
        let _ = w.close();
    }
    show_main_window(&app);
    let _ = app.emit_to("main", "meet-start-recording", json!({ "title": title }));
    Ok(())
}

#[tauri::command]
fn dismiss_meet_prompt(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("meet-prompt") {
        let _ = w.close();
    }
    Ok(())
}

fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir biblioteca", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Iniciar gravacao", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Finalizar gravacao", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &start, &stop, &quit])?;

    let icon = {
        let mut rgba: Vec<u8> = Vec::with_capacity(32 * 32 * 4);
        for y in 0u32..32 {
            for x in 0u32..32 {
                let cx = x as f32 - 15.5;
                let cy = y as f32 - 15.5;
                if cx * cx + cy * cy < 12.5 * 12.5 {
                    rgba.extend_from_slice(&[124, 58, 237, 255]);
                } else {
                    rgba.extend_from_slice(&[0, 0, 0, 0]);
                }
            }
        }
        tauri::image::Image::new_owned(rgba, 32, 32)
    };

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
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
                meet_watcher_active: Arc::new(AtomicBool::new(false)),
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
            begin_recording_session,
            append_recording_chunk,
            finalize_recording_session,
            cancel_recording_session,
            get_youtube_connection_status,
            connect_youtube,
            disconnect_youtube,
            upload_to_youtube,
            delete_local_recording,
            open_url,
            update_meeting_title,
            update_meeting_metadata,
            delete_meeting,
            open_recording,
            reveal_recording,
            transcribe_meeting,
            summarize_meeting,
            minimize_window,
            toggle_maximize_window,
            hide_window,
            start_dragging_window,
            start_meet_watcher,
            stop_meet_watcher,
            accept_meet_prompt,
            dismiss_meet_prompt,
            check_diarization_setup,
            download_diarization_model,
            auto_configure_diarization
        ])
        .run(tauri::generate_context!())
        .expect("error while running Meeting Vault");
}
