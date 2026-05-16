# Architecture Map

## Arquivos centrais

- `src/App.tsx`: UI, estado, gravacao, comandos Tauri e eventos.
- `src/components/ConfirmDialog.tsx`: componente global de confirmacao para acoes destrutivas.
- `src/components/IntegrationsView.tsx`: pagina de integracoes — autonoma (chama `invoke` diretamente, excecao documentada).
- `src/components/YoutubeUploadDialog.tsx`: modal de publicacao no YouTube (titulo, descricao, privacidade, apagar local).
- `src/types.ts`: contratos TypeScript de `Meeting`, `Settings` e inputs.
- `src/styles.css`: sistema visual dark mode.
- `src-tauri/src/lib.rs`: comandos Tauri, persistencia, tray e pipelines.
- `src-tauri/tauri.conf.json`: janela, bundle, dev server e protocolo de assets.
- `src-tauri/capabilities/default.json`: permissoes Tauri.

## Convencao de componentes React

- `App.tsx` deve ser tratado como container/orquestrador, nao como destino padrao para todo JSX novo.
- `src/components/` concentra componentes globais e reutilizaveis.
- Componentes especificos de view podem ser agrupados por dominio conforme a extracao avancar.
- Componentes recebem props/callbacks tipados; chamadas Tauri devem permanecer preferencialmente no container ou em camada explicitamente documentada.
- **Excecao documentada:** `IntegrationsView` chama `invoke` diretamente para `save_settings`, `connect_youtube` e `disconnect_youtube` porque seu estado de credenciais e local ao componente e o fluxo OAuth requer sequencia atomica de salvar + conectar sem passar pelo App.
- Novas classes ou estruturas visuais extraidas devem ser registradas em `docs/ui-style-guide.md`.

## Fluxo de dados

1. React carrega reunioes com `list_meetings`.
2. React carrega configuracoes com `get_settings`.
3. React verifica status YouTube com `get_youtube_connection_status` no startup.
4. Gravacao inicia com `begin_recording_session`; chunks sao enviados com `append_recording_chunk` a cada segundo; `finalize_recording_session` fecha e renomeia o arquivo `.tmp`.
5. Rust grava video em `recordings/` e metadados em `store.json`.
6. Processamento atualiza `Meeting` e emite `processing-progress`.
7. React reflete progresso e resultado.
8. Resumo OpenRouter, quando acionado, usa a transcricao existente e salva `summary`.
9. Upload YouTube: `upload_to_youtube` faz upload em chunks de 8 MB via Resumable Upload API, emite `processing-progress` e salva `youtubeUrl` na reuniao.

## Comandos Tauri usados pela UI

**Reunioes e configuracoes:**
- `list_meetings`
- `get_settings`
- `save_settings`
- `update_meeting_metadata`
- `delete_meeting`
- `open_recording`
- `reveal_recording`
- `transcribe_meeting`
- `summarize_meeting`

**Gravacao em streaming (substituem `save_recording`):**
- `begin_recording_session` — cria arquivo `.tmp` em `recordings/`
- `append_recording_chunk` — anexa chunk de bytes ao arquivo `.tmp`
- `finalize_recording_session` — renomeia `.tmp` para `.webm`, cria Meeting, persiste
- `cancel_recording_session` — apaga o `.tmp` sem criar Meeting

**YouTube:**
- `get_youtube_connection_status` — retorna `bool`
- `connect_youtube` — inicia OAuth flow (abre browser, escuta porta 8765, troca code por tokens)
- `disconnect_youtube` — limpa tokens
- `upload_to_youtube` — upload em chunks com progresso; atualiza Meeting com `youtubeUrl`
- `delete_local_recording` — apaga arquivo local, zera `recordingPath`
- `open_url` — abre URL no browser padrao

**Janela:**
- `minimize_window`
- `toggle_maximize_window`
- `hide_window`
- `start_dragging_window`

## Modelo de dados — Meeting

Campos ativos: `id`, `title`, `createdAt`, `startedAt`, `category`, `tags`, `durationSeconds`, `sizeBytes`, `recordingPath`, `mimeType`, `transcript`, `summary`, `status`, `progressMessage`, `progressPercent`, `error`, `youtubeVideoId`, `youtubeUrl`.

Campos removidos (nao mais presentes nos tipos): `actionItems`, `decisions`. Dados antigos no `store.json` com esses campos sao ignorados silenciosamente.

## Modelo de dados — Settings

Inclui todos os campos anteriores mais: `youtubeClientId`, `youtubeClientSecret`.

## Modelo de dados — Store

Inclui `meetings`, `settings` e `youtubeTokens` (struct com `accessToken`, `refreshToken`, `expiresAt`). Todos os campos novos usam `#[serde(default)]` para compatibilidade retroativa com `store.json` existentes.

## Dados locais

No Windows, o Tauri usa:

- `%APPDATA%\\com.julio.meetingvault\\store.json`
- `%APPDATA%\\com.julio.meetingvault\\recordings\\`
- `%APPDATA%\\com.julio.meetingvault\\processing\\`

Nao assuma que estes caminhos estao dentro do repositorio.
