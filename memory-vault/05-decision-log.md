# Decision Log

## Decisoes aceitas

- [[../docs/adr/0001-use-tauri-react-rust|ADR 0001]]: usar Tauri 2 com React, TypeScript e Rust.
- [[../docs/adr/0002-local-first-ai-processing|ADR 0002]]: processamento local-first com FFmpeg e whisper.cpp (revisada — llama.cpp removido).
- [[../docs/adr/0003-json-store-before-sqlite|ADR 0003]]: usar store JSON antes de SQLite.
- [[../docs/adr/0004-frameless-professional-dark-ui|ADR 0004]]: UI profissional dark mode com janela sem decoracao nativa.
- [[../docs/adr/0005-remove-summarization|ADR 0005]]: remover sumarizacao com LLM desta fase (2026-05-14).
- [[../docs/adr/0006-openrouter-summary|ADR 0006]]: reintroduzir resumo somente via OpenRouter opt-in (2026-05-15).
- Bootstrap local: `tools/` e `models/` ficam fora do Git; `scripts/bootstrap-local-ai.ps1` baixa FFmpeg, whisper.cpp e modelo Whisper para uma maquina nova.

## Decisoes pendentes

- Estrategia de sumarizacao para fase seguinte (API dedicada vs. modelo local leve).
- Modelo Whisper local padrao recomendado para CPU modesto.
- Migracao para SQLite.
- Exportacao Markdown/Obsidian de reunioes transcritas.
- Integracoes reais: calendario, Notion, CRM e chat.
