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

## Estado rapido

- App desktop Windows com Tauri 2.
- UI React/TypeScript.
- Persistencia local em JSON.
- Gravacao via WebView2 `MediaRecorder`.
- Processamento local com FFmpeg e whisper.cpp.
- Sumarizacao com llama.cpp removida — ver ADR 0005.
- Resumo de transcricoes reintroduzido somente como opcao OpenRouter sob demanda — ver ADR 0006.
- Modo API/hibrido existe para transcricao, mas o produto deve continuar local-first.
