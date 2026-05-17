# Local AI Runbook

## Pipeline atual

1. Validar configuracao local (FFmpeg, whisper-cli, modelo Whisper).
2. Extrair audio com FFmpeg (WAV mono 16 kHz).
3. Transcrever com whisper.cpp.
4. Se habilitado, executar diarizacao local via `scripts/diarize.py` + pyannote.audio.
5. Persistir transcricao e segmentos de falantes quando houver.

O resumo com llama.cpp foi removido desta fase. Ver [[../docs/adr/0005-remove-summarization|ADR 0005]]. O resumo voltou apenas como opcao OpenRouter sob demanda, separada do pipeline local.

## Ferramentas esperadas

- `tools/ffmpeg/.../bin/ffmpeg.exe`
- `tools/whisper.cpp/Release/whisper-cli.exe`
- `models/whisper/*.bin`
- Python 3.10+ com `pyannote.audio`, `torch`, `torchaudio` e `torchcodec` para diarizacao opt-in.

O diretorio `tools/llama.cpp/` e o modelo `models/llm/*.gguf` foram removidos do projeto.

## Bootstrap local

Em uma maquina nova, rode:

```powershell
npm run bootstrap:local-ai
```

O script baixa FFmpeg, `whisper-cli.exe` e um modelo Whisper para `tools/` e `models/`, que sao diretorios locais ignorados pelo Git.

## Problemas comuns

### Diarizacao acusa pyannote.audio ou modelo pendente

Sintoma: painel de diarizacao indica `pyannote.audio` pendente ou falha ao carregar.

Acao:

- Confirmar que o campo "Caminho do Python" aponta para o mesmo Python usado no terminal.
- Instalar/atualizar `pyannote.audio` pelo Python configurado:

```powershell
python -m pip install -U pyannote.audio
```

- Reparar a pilha PyTorch CPU separadamente, usando o indice do PyTorch apenas para `torch`, `torchaudio` e `torchcodec`:

```powershell
python -m pip install -U --force-reinstall torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu
```

- Se o item pendente for o modelo, aceitar os termos em `https://hf.co/pyannote/speaker-diarization-3.1`, gerar um token HuggingFace e usar o botao de download do app.
- Ler o detalhe exibido no painel antes de reinstalar tudo; o diagnostico separa erro de Python, importacao de `pyannote.audio` e cache do modelo.

### Caminho invalido para FFmpeg ou Whisper

Sintoma: erro dizendo que o caminho nao existe ou a ferramenta nao foi encontrada.

Acao: abrir Configuracoes e garantir que cada campo contenha somente um caminho absoluto valido, sem duplicacao ou espacos extras.

### whisper.cpp nao gera saida

Sintoma: transcricao retorna vazia ou processo falha sem stderr claro.

Acao:

- Confirmar que o modelo `.bin` existe no caminho configurado.
- Confirmar que o arquivo de audio foi gerado pelo FFmpeg (verificar pasta `processing/`).
- Reduzir o numero de threads se a maquina tiver poucos nucleos.
- Testar com modelo menor (ex: `ggml-base.bin`) para isolar problema de modelo.

### FFmpeg nao extrai audio

Sintoma: erro na etapa de extracao, mensagem menciona FFmpeg.

Acao:

- Confirmar que o caminho do FFmpeg esta correto e o binario e executavel.
- Confirmar que o video gravado existe no caminho armazenado em `store.json`.
- Verificar se o formato do video (WebM) e suportado pela versao do FFmpeg instalada.

## Regras para agentes

- Nunca versionar API keys.
- Evitar commitar modelos e binarios grandes.
- Ao mudar o pipeline, manter mensagens de progresso claras em cada etapa.
- O comando Tauri e `transcribe_meeting`, nao `transcribe_and_summarize`.
- O comando de resumo e `summarize_meeting` e deve aceitar apenas os modos `disabled` e `openrouter`.
