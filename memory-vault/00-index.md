# Meeting Vault Memory

Este vault e uma memoria operacional do projeto em Markdown, pronto para abrir no Obsidian. Use como ponto de partida para entender produto, arquitetura e decisoes antes de alterar codigo.

## Mapa

- [[01-product-context]]
- [[02-architecture-map]]
- [[03-local-ai-runbook]]
- [[04-agent-handoff]]
- [[05-decision-log]]

## Documentos formais relacionados

- [PRD](../docs/PRD.md)
- [Arquitetura](../docs/architecture.md)
- [Pesquisa de produto](../docs/product-research.md)
- [ADR 0001](../docs/adr/0001-use-tauri-react-rust.md)
- [ADR 0002](../docs/adr/0002-local-first-ai-processing.md)
- [ADR 0003](../docs/adr/0003-json-store-before-sqlite.md)
- [ADR 0004](../docs/adr/0004-frameless-professional-dark-ui.md)
- [ADR 0005](../docs/adr/0005-remove-summarization.md)
- [ADR 0006](../docs/adr/0006-openrouter-summary.md)
- [ADR 0007](../docs/adr/0007-recording-streaming-to-disk.md)
- [ADR 0008](../docs/adr/0008-youtube-oauth-integration.md)
- [ADR 0009](../docs/adr/0009-google-meet-detection.md)
- [ADR 0010](../docs/adr/0010-microphone-capture-mix.md)
- [ADR 0011](../docs/adr/0011-speaker-diarization.md)

## Estado rapido

- App desktop Windows com Tauri 2.
- UI React/TypeScript.
- Persistencia local em JSON.
- Gravacao via WebView2 `MediaRecorder` — chunks streamados diretamente ao disco via IPC (sem acumulo em memoria).
- Processamento local com FFmpeg e whisper.cpp.
- Sumarizacao com llama.cpp removida — ver ADR 0005.
- Resumo de transcricoes reintroduzido somente como opcao OpenRouter sob demanda — ver ADR 0006.
- Modo API/hibrido existe para transcricao, mas o produto deve continuar local-first.
- Integracao YouTube implementada: OAuth 2.0, upload via Resumable Upload API, armazenamento do link no Meeting.
- Integracao Notion planejada (card visivel na tela de Integracoes, sem implementacao).
- Deteccao automatica de Google Meet implementada: polling Win32 a cada 3s, popup always-on-top, pre-preenche titulo da gravacao.
- Captura de microfone implementada: getUserMedia + AudioContext mixagem com audio do sistema.
- Diarizacao local opt-in implementada via Python/pyannote.audio; ver ADR 0011 e runbook local.
