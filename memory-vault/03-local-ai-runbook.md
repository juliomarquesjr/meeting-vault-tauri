# Local AI Runbook

## Pipeline

1. Validar configuracao local.
2. Extrair audio com FFmpeg.
3. Transcrever com whisper.cpp.
4. Resumir com llama.cpp.
5. Persistir transcricao, resumo, acoes e decisoes.

## Ferramentas esperadas

- `tools/ffmpeg/.../bin/ffmpeg.exe`
- `tools/whisper.cpp/Release/whisper-cli.exe`
- `tools/llama.cpp/llama-cli.exe`
- `models/whisper/*.bin`
- `models/llm/*.gguf`

## Problemas comuns

### Caminho duplicado ou invalido

Sintoma: erro dizendo que o caminho do FFmpeg, Whisper ou LLM nao existe.

Acao: abrir Configuracoes e garantir que cada campo contenha somente um caminho absoluto, sem duplicacao.

### llama.cpp falha por memoria

Sintoma: mensagens com `failed to allocate buffer`, `kv cache`, `failed to create context` ou `out of memory`.

Acao:

- Reduzir `Contexto LLM`.
- Reduzir `Tokens maximos do resumo`.
- Fechar apps pesados antes do processamento.
- Preferir modelo GGUF menor para CPU.
- Usar GPU apenas quando o build do llama.cpp e o hardware estiverem prontos.

### Whisper passa, resumo falha

Isso indica que FFmpeg e Whisper estao configurados. O foco deve ser `llama-cli`, modelo GGUF, contexto, memoria livre e parametros do LLM.

## Regras para agentes

- Nunca versionar API keys.
- Evitar commitar modelos e zips grandes se o projeto passar a usar Git remoto.
- Ao mudar o pipeline, manter mensagens de progresso claras.
- Ao alterar prompts, preservar saida esperada em JSON com `summary`, `action_items` e `decisions`.
