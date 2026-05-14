# ADR 0002: Processamento local-first com FFmpeg e whisper.cpp

## Status

Parcialmente revisada — ver ADR 0005.

## Contexto

O usuario deseja transcrever reunioes sem depender de chaves de API ou upload de dados. O app deve funcionar localmente quando as ferramentas e modelos estiverem configurados.

## Decisao original

Implementar modo `local` como padrao, usando:

- FFmpeg para extrair audio WAV mono 16 kHz.
- whisper.cpp para transcricao local.
- llama.cpp com modelo GGUF para resumo local estruturado (removido — ver ADR 0005).

Tambem manter modos `api` e `hybrid` para flexibilidade.

## Revisao (ADR 0005)

O componente de resumo com llama.cpp foi removido do pipeline em 2026-05-14. O pipeline local atual e:

```
video → FFmpeg (audio.wav) → whisper.cpp (transcript.txt)
```

O modo `hybrid` continua funcionando para transcricao: tenta whisper.cpp local e cai para a API da OpenAI em caso de falha.

## Consequencias positivas

- Privacidade por padrao.
- Sem dependencia obrigatoria de API key.
- Possibilidade de usar hardware local potente.
- Controle sobre modelos e custos.

## Consequencias negativas

- Instalacao e configuracao de binarios e modelos e mais trabalhosa.
- Performance da transcricao varia muito por CPU/GPU/modelo.
- Qualidade depende da escolha do modelo Whisper.

## Implicacoes operacionais

- O app deve validar caminhos antes de processar.
- A UI deve mostrar progresso e mensagens de erro acionaveis.
- Um teste de configuracao local deve ser priorizado no roadmap.
