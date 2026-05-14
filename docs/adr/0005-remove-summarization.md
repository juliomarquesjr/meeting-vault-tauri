# ADR 0005: Remover sumarizacao com LLM nesta fase

## Status

Aceita.

## Contexto

O produto foi implementado com um pipeline completo: FFmpeg → Whisper → llama.cpp. O recurso de resumo (llama.cpp com modelo GGUF local e API de chat completions) adicionou ~350 linhas de logica no backend, dependencia de modelo de ~4,9 GB, configuracoes extras e superficie de falha significativa em maquinas com pouca memoria.

Apos a implementacao inicial, decidiu-se simplificar o escopo: o produto deve, nesta fase, focar em gravar e transcrever. O resumo sera reintroduzido quando houver estrategia clara de modelo, experiencia de usuario e possivelmente via API dedicada ou servico proprio.

## Decisao

Remover o recurso de sumarizacao do pipeline e da interface:

- Remover llama.cpp do backend: funcoes `summarize_transcript_local`, `run_llama_summary`, chunking, consolidacao, prompts e parsing de JSON.
- Remover sumarizacao via API: funcao `summarize_transcript` e chamada ao endpoint de chat completions da OpenAI.
- Renomear comando `transcribe_and_summarize` para `transcribe_meeting`.
- Remover campos `summary`, `action_items` e `decisions` dos tipos `Meeting`.
- Remover configuracoes de LLM da interface e do backend: `llama_cli_path`, `llama_model_path`, `llama_context_size`, `llama_max_tokens`, `summary_model`, `local_hardware_mode`, `auto_summarize`.
- Remover arquivos fisicos: modelo `Qwen3-8B-Q4_K_M.gguf` (~4,9 GB) e diretorio `tools/llama.cpp/`.
- Atualizar interface: botao "Gerar resumo" → "Transcrever", metrica "Resumidas" → "Transcritas", secoes de resumo/acoes/decisoes removidas.

## Consequencias positivas

- Pipeline mais simples e confiavel.
- Eliminacao de ~4,9 GB de modelo e binarios do llama.cpp.
- Reducao de superficie de falha por falta de memoria.
- Configuracao local menos complexa para o usuario.
- Codigo backend mais facil de manter.

## Consequencias negativas

- Usuarios que dependiam do resumo precisam usar alternativa externa.
- Reintroducao do recurso exigira planejamento de modelo, UX e possivelmente backend dedicado.

## Caminhos de retorno

Para reintroduzir sumarizacao no futuro:

- Criar um novo comando `summarize_meeting(id)` separado de `transcribe_meeting`.
- Considerar API de resumo (OpenAI, Anthropic) como modo primario, com local como opcional.
- Avaliar modelos menores para CPU (ex: Phi-3-mini, Gemma 2B) antes de propor GGUF grande.
- Adicionar estimativa de RAM necessaria na tela de configuracao.
