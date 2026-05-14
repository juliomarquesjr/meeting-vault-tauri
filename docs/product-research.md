# Product research

## Referencias analisadas

- Otter.ai: foco em transcricao, busca, resumo, identificacao de falantes e itens de acao.
- Fireflies.ai: notas automaticas, integracoes com CRM, busca na conversa e compartilhamento.
- Fathom: gravacao de reunioes, highlights, resumo rapido e follow-ups.
- Loom: gravacao de tela, biblioteca de videos, transcricao e resumo por IA.
- OBS: captura robusta de tela e audio, mas sem biblioteca e inteligencia de reunioes.

## Funcionalidades priorizadas para o MVP

- Gravacao de tela com audio em WebM compactado.
- Biblioteca local com busca, detalhes, player e metadados.
- Edicao de titulo da reuniao.
- Tray nativo no Windows com iniciar, finalizar e abrir biblioteca.
- Transcricao e resumo sob demanda.
- Resumo estruturado com decisoes e proximas acoes.
- Armazenamento local dos videos e metadados.

## Decisoes tecnicas

- Tauri + React + TypeScript para UI leve e moderna.
- Rust no backend para tray, persistencia local e chamadas de API.
- JSON local no MVP; SQLite entra quando houver filtros, tags, participantes e historico maior.
- OpenAI configuravel: `gpt-4o-mini-transcribe` para transcricao e `gpt-5.4-mini` para resumo.
- Proximo passo para producao: extrair somente a trilha de audio com FFmpeg sidecar antes de transcrever arquivos longos.
