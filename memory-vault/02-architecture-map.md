# Architecture Map

## Arquivos centrais

- `src/App.tsx`: UI, estado, gravacao, comandos Tauri e eventos.
- `src/types.ts`: contratos TypeScript de `Meeting`, `Settings` e inputs.
- `src/styles.css`: sistema visual dark mode.
- `src-tauri/src/lib.rs`: comandos Tauri, persistencia, tray e pipelines.
- `src-tauri/tauri.conf.json`: janela, bundle, dev server e protocolo de assets.
- `src-tauri/capabilities/default.json`: permissoes Tauri.

## Fluxo de dados

1. React carrega reunioes com `list_meetings`.
2. React carrega configuracoes com `get_settings`.
3. Gravacao gera blob no frontend.
4. Blob vira `bytes` e segue para `save_recording`.
5. Rust grava video em `recordings/` e metadados em `store.json`.
6. Processamento atualiza `Meeting` e emite `processing-progress`.
7. React reflete progresso e resultado.
8. Resumo OpenRouter, quando acionado, usa a transcricao existente e salva `summary`.

## Comandos Tauri usados pela UI

- `list_meetings`
- `get_settings`
- `save_settings`
- `save_recording`
- `update_meeting_metadata`
- `delete_meeting`
- `open_recording`
- `reveal_recording`
- `transcribe_meeting`
- `summarize_meeting`
- `minimize_window`
- `toggle_maximize_window`
- `hide_window`
- `start_dragging_window`

## Modelo de dados — Meeting

Campos ativos: `id`, `title`, `createdAt`, `startedAt`, `category`, `tags`, `durationSeconds`, `sizeBytes`, `recordingPath`, `mimeType`, `transcript`, `summary`, `status`, `progressMessage`, `progressPercent`, `error`.

Campos removidos (nao mais presentes nos tipos): `actionItems`, `decisions`. Dados antigos no `store.json` com esses campos sao ignorados silenciosamente.

## Dados locais

No Windows, o Tauri usa:

- `%APPDATA%\\com.julio.meetingvault\\store.json`
- `%APPDATA%\\com.julio.meetingvault\\recordings\\`
- `%APPDATA%\\com.julio.meetingvault\\processing\\`

Nao assuma que estes caminhos estao dentro do repositorio.
