# ADR 0002: Processamento local-first com FFmpeg, whisper.cpp e llama.cpp

## Status

Aceita.

## Contexto

O usuario deseja transcrever e resumir reunioes sem depender de chaves de API ou upload de dados. O app deve funcionar localmente quando as ferramentas e modelos estiverem configurados.

## Decisao

Implementar modo `local` como padrao, usando:

- FFmpeg para extrair audio WAV mono 16 kHz.
- whisper.cpp para transcricao local.
- llama.cpp com modelo GGUF para resumo local estruturado.

Tambem manter modos `api` e `hybrid` para flexibilidade.

## Consequencias positivas

- Privacidade por padrao.
- Sem dependencia obrigatoria de API key.
- Possibilidade de usar hardware local potente.
- Controle sobre modelos e custos.

## Consequencias negativas

- Instalacao e configuracao de binarios/modelos e mais trabalhosa.
- Modelos grandes podem falhar por falta de memoria.
- Performance varia muito por CPU/GPU/modelo.
- Qualidade depende da escolha do modelo local.

## Implicacoes operacionais

- O app deve validar caminhos antes de processar.
- A UI deve mostrar progresso e mensagens de erro acionaveis.
- Defaults de contexto e tokens precisam considerar maquinas com pouca memoria livre.
- Um teste de configuracao local deve ser priorizado no roadmap.
