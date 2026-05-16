# ADR 0009: Detecção automática de Google Meet via polling de título de janela

**Data:** 2026-05-16  
**Status:** Aceita

## Contexto

O usuário queria que o app detectasse automaticamente quando o Google Meet está aberto no Chrome e exibisse um prompt sugerindo o início da gravação — comportamento similar ao recurso do Notion.

As alternativas consideradas foram:

| Abordagem | Prós | Contras |
|---|---|---|
| Polling de título de janela (Win32 `EnumWindows`) | Simples, sem fricção, sem extensão de browser | Só detecta quando Meet é a aba ativa |
| Extensão Chrome | Detecta todas as abas, acesso a eventos WebRTC | Exige publicação na Chrome Store, permissões explícitas, manutenção separada |
| `chrome://webrtc-internals/` | Detecta sessões WebRTC ativas | Requer extensão ou scraping, altamente frágil |
| Hook de processo (WMI / ETW) | Detecção profunda | Complexidade elevada, impacto de performance, permissões de sistema |

## Decisão

Usar polling de título de janela via Windows API (`EnumWindows` + `GetWindowTextW` do crate `windows` 0.58), rodando em background task tokio a cada 3 segundos.

O Chrome expõe o título da reunião no título da janela em dois formatos:
- `"Daily Standup - Google Meet - Google Chrome"` (reuniões agendadas pelo Google Calendar)
- `"Meet: gcq-bsde-heu - Google Chrome"` (link direto)

O backend filtra os dois formatos e extrai o nome da reunião quando disponível.

## Implementação

**Backend (`src-tauri/src/lib.rs`):**
- `detect_google_meet_window()` — enumera janelas Win32, filtra por título contendo `"Google Meet"` ou iniciando com `"Meet:"`.
- `show_meet_prompt(app, title)` — cria janela Tauri separada (`"meet-prompt"`) com `always_on_top(true)`, `decorations(false)`, `transparent(true)`, `skip_taskbar(true)`, posicionada no canto inferior direito acima da taskbar.
- `start_meet_watcher` — comando que inicia background task de polling controlada por `AtomicBool`.
- `stop_meet_watcher` — desativa o polling.
- `accept_meet_prompt` — fecha popup, traz janela principal ao foco, emite `meet-start-recording` para o frontend pré-preencher título e iniciar gravação.
- `dismiss_meet_prompt` — fecha popup sem ação.
- Setting `enable_meet_detection: bool` — permite desabilitar nas configurações.

**Frontend:**
- `src/MeetPromptApp.tsx` — componente raiz renderizado no popup (modo `?mode=meet-prompt`).
- `src/components/MeetDetectedPrompt.tsx` — prompt com countdown de 15s, botões "Iniciar gravação" e "Ignorar", barra de progresso animada.
- `src/main.tsx` — detecta `?mode=meet-prompt` na URL e renderiza `MeetPromptApp` em vez de `App`.
- `src/App.tsx` — escuta evento `meet-start-recording`, pré-preenche título e inicia gravação.
- `src-tauri/capabilities/default.json` — label `"meet-prompt"` adicionado à lista de janelas permitidas.

## Consequências

**Positivas:**
- Sem fricção para o usuário — nenhuma extensão ou permissão adicional.
- Extrai o nome da reunião para pré-preencher o título da gravação.
- O popup flutua sobre o Chrome (sempre no topo) sem bloquear a interface.
- Fallback gracioso: se o Chrome minimizar, a janela fica sem foco mas o polling continua.
- Compilação condicional `#[cfg(windows)]` não afeta builds de outras plataformas.

**Limitações:**
- Detecta apenas quando Meet é a aba ativa (título da janela reflete a aba em foco).
- Múltiplas janelas Chrome com Meet: usa a primeira encontrada por `EnumWindows`.
- Formato de código curto (`"Meet: xyz-abc-def"`) não permite extrair nome descritivo da reunião.
