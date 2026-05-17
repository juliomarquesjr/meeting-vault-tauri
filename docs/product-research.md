# Product research

## Referencias analisadas

- Otter.ai: foco em transcricao, busca, resumo, identificacao de falantes e itens de acao.
- Fireflies.ai: notas automaticas, integracoes com CRM, busca na conversa e compartilhamento.
- Fathom: gravacao de reunioes, highlights, resumo rapido e follow-ups.
- Loom: gravacao de tela, biblioteca de videos, transcricao e resumo por IA.
- OBS: captura robusta de tela e audio, mas sem biblioteca e inteligencia de reunioes.

## Funcionalidades priorizadas para o MVP atual

- Gravacao de tela com audio em WebM compactado.
- Biblioteca local com busca, detalhes, player e metadados.
- Edicao de titulo da reuniao, categorias e tags.
- Tray nativo no Windows com iniciar, finalizar e abrir biblioteca.
- Transcricao sob demanda (local via whisper.cpp ou API via OpenAI).
- Armazenamento local dos videos e metadados.
- Diarizacao local opt-in para identificar falantes, com setup manual por Python/pyannote.

## Funcionalidades diferidas

- Resumo estruturado com decisoes e proximas acoes — reintroduzido apenas via OpenRouter opt-in (ver ADR 0006).
- Identificacao nominal de participantes e edicao rica de falantes apos diarizacao.
- Integracoes externas (calendario, Notion, CRM).

## Decisoes tecnicas

- Tauri + React + TypeScript para UI leve e moderna.
- Rust no backend para tray, persistencia local e chamadas de API.
- JSON local no MVP; SQLite entra quando houver filtros, tags, participantes e historico maior.
- OpenAI configuravel: `gpt-4o-mini-transcribe` como modelo padrao de transcricao via API.
- Proximo passo para producao: exportar transcricao/resumo em Markdown/TXT e adicionar teste de configuracao local.
