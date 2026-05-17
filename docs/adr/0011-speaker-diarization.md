# ADR 0011 — Diarização de Falantes via pyannote.audio

**Data:** 2026-05-16  
**Status:** Aceito

---

## Contexto

O transcript gerado pelo whisper.cpp é uma string plana sem identificação de quem está falando. Em reuniões com múltiplos participantes, isso torna o conteúdo difícil de acompanhar. A funcionalidade de diarização (speaker diarization) identifica automaticamente os diferentes falantes e segmenta o transcript por falante.

---

## Decisão

Adicionar diarização local via **pyannote.audio** chamado como subprocesso Python após a transcrição com whisper.cpp, usando o modelo HuggingFace `pyannote/speaker-diarization-3.1`. A diarização é **opt-in** — desabilitada por padrão, requer setup manual (Python + pyannote + modelo HuggingFace).

O whisper.cpp passa a usar `-oj` (JSON) em vez de `-otxt` para obter timestamps por segmento, necessários para o merge com os labels de falante.

---

## Alternativas Consideradas

| Opção | Motivo de descarte |
|---|---|
| whisper.cpp `--tinydiarize` | Modelos só em inglês; apenas detecta trocas, sem labels A/B |
| API externa (AssemblyAI, OpenAI) | Custo por minuto, dados saem do dispositivo |
| ONNX nativo em Rust | Pipeline de diarização multi-etapa difícil de portar para ONNX |
| WhisperX (Python) | Substitui whisper.cpp por faster-whisper — quebra a pipeline local existente |

---

## Pipeline

```
recording.webm
    │
    ▼ FFmpeg (sem mudança)
audio.wav (mono 16 kHz)
    │
    ├─▶ whisper-cli -oj  →  transcript.json  (segmentos com timestamps)
    │
    └─▶ scripts/diarize.py
              args: audio.wav transcript.json diarization.json [--num-speakers N]
              │
              └─▶ pyannote/speaker-diarization-3.1
                        │
                        └─▶ merge por sobreposição de timestamps
                              ↓
                         diarization.json
                    [{speaker, text, start, end}, ...]
```

Sem diarização habilitada: só whisper com `-oj`, texto extraído do JSON e salvo como string.

---

## Implementação

**Backend (`src-tauri/src/lib.rs`):**
- `TranscriptSegment` struct: `{ speaker, text, start, end }`
- `Meeting.transcript_segments: Vec<TranscriptSegment>` — `#[serde(default)]` para retrocompatibilidade
- `Settings`: `enable_diarization`, `diarization_num_speakers`, `python_path`, `diarization_script_path`, `huggingface_token`
- `transcribe_with_whisper()` retorna `(String, PathBuf)` — transcript texto + caminho do JSON
- `run_diarization()` — spawn Python subprocess, parse JSON resultado
- `run_local_pipeline()` — chama diarização quando habilitada; a etapa é não bloqueante (emite warning, salva transcript sem segmentos)
- `check_diarization_setup()` — valida Python, importação de `pyannote.audio` e cache local do modelo, retornando detalhes de erro para a UI
- `download_diarization_model()` — baixa/cacheia o modelo com token HuggingFace informado pelo usuário

**Script (`scripts/diarize.py`):**
- Args: `audio.wav whisper.json output.json [--num-speakers N] [--model-path PATH]`
- Usa cache local do HuggingFace após download inicial (token não necessário em runtime)
- Exit 1 com mensagem de erro legível se pyannote não instalado ou modelo não encontrado

**Frontend (`src/App.tsx`, `src/types.ts`, `src/styles.css`):**
- `TranscriptSegment` interface
- `transcriptSegments?: TranscriptSegment[]` no Meeting
- `TranscriptSegmentedView` component — blocos coloridos por falante com label e timestamp
- Modal de transcript: exibe view segmentada se `transcriptSegments.length > 0`, senão string plana
- Settings "Diarização" na view de video e qualidade: toggle, num_speakers, python_path, diarization_script_path, huggingface_token (password)

**Bootstrap (`scripts/bootstrap-local-ai.ps1`):**
- Parâmetros: `-SkipDiarization`, `-HuggingFaceToken`
- Instala `pyannote.audio` via PyPI e a pilha `torch`, `torchaudio`, `torchcodec` via índice CPU do PyTorch (~2GB) se Python disponível
- Baixa modelo se token fornecido; exibe paths para configurar no app

---

## Retrocompatibilidade

- `transcript_segments` usa `#[serde(default)]` → reuniões antigas deserializam com `[]`
- `transcript` (string) continua presente em todas as reuniões
- UI renderiza view segmentada só se `transcriptSegments?.length > 0`

---

## Limitações / Consequências

- Requer Python 3.10+ instalado manualmente pelo usuário
- Download inicial de ~2GB (PyTorch CPU + pyannote)
- Modelo pyannote/speaker-diarization-3.1 requer aceite de termos em HuggingFace
- Token HuggingFace necessário apenas no download inicial — depois fica em cache local
- Diarização é não bloqueante: se falhar durante a transcrição, o transcript sem segmentos é salvo normalmente; o painel de diagnóstico mostra detalhes quando o usuário verifica a instalação
- Qualidade de identificação depende da clareza do áudio e sobreposição de vozes
- Falantes são identificados como A, B, C... (sem nomes reais — renomeação manual futura)
