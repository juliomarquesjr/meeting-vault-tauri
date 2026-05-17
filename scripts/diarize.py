#!/usr/bin/env python3
"""
Diarização de áudio com pyannote.audio — identificação de falantes.

Uso:
  python diarize.py <audio.wav> <whisper.json> <output.json> [--num-speakers N] [--model-path PATH]

Argumentos:
  audio.wav      Arquivo de áudio WAV (mono, 16 kHz) extraído pelo FFmpeg
  whisper.json   Saída JSON do whisper-cli (-oj) com timestamps por segmento
  output.json    Arquivo de saída com segmentos enriquecidos: [{speaker, text, start, end}]

Opções:
  --num-speakers N    Número de falantes (0 = detectar automaticamente, padrão: 0)
  --model-path PATH   Caminho local do modelo pyannote (usa cache HuggingFace se omitido)

Pré-requisitos:
  python -m pip install -U pyannote.audio
  python -m pip install -U --force-reinstall torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu

Download inicial do modelo (necessita token HuggingFace):
  python -c "import huggingface_hub; huggingface_hub.login(token='hf_SEU_TOKEN'); \
      from pyannote.audio import Pipeline; Pipeline.from_pretrained('pyannote/speaker-diarization-3.1')"
  Após o download, o modelo fica em cache local e o token não é mais necessário.
"""

import sys
import json
import argparse


def parse_time(t: str) -> float:
    """Converte timestamp whisper 'HH:MM:SS,mmm' em segundos float."""
    t = t.replace(",", ".")
    parts = t.split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])


def dominant_speaker(diarization, start: float, end: float) -> str:
    """Retorna o rótulo do falante com maior sobreposição no intervalo [start, end]."""
    best_label = "SPEAKER_00"
    best_overlap = 0.0
    for turn, _, label in diarization.itertracks(yield_label=True):
        overlap = max(0.0, min(end, turn.end) - max(start, turn.start))
        if overlap > best_overlap:
            best_overlap = overlap
            best_label = label
    # SPEAKER_00 → A, SPEAKER_01 → B, ...
    try:
        idx = int(best_label.split("_")[-1])
        return chr(ord("A") + min(idx, 25))  # cap em Z
    except (ValueError, IndexError):
        return "A"


def main():
    parser = argparse.ArgumentParser(
        description="Diarização de áudio com pyannote.audio"
    )
    parser.add_argument("audio", help="Arquivo WAV de entrada")
    parser.add_argument("whisper_json", help="JSON do whisper-cli (-oj)")
    parser.add_argument("output", help="Arquivo JSON de saída")
    parser.add_argument(
        "--num-speakers", type=int, default=0,
        help="Número de falantes (0 = auto)"
    )
    parser.add_argument(
        "--model-path", default=None,
        help="Caminho local do modelo pyannote (omitir para usar cache HuggingFace)"
    )
    args = parser.parse_args()

    try:
        from pyannote.audio import Pipeline
    except ImportError:
        print(
            "ERRO: pyannote.audio não está instalado.\n"
            "Execute:\n"
            "  python -m pip install -U pyannote.audio\n"
            "  python -m pip install -U --force-reinstall torch torchaudio torchcodec "
            "--index-url https://download.pytorch.org/whl/cpu",
            file=sys.stderr,
        )
        sys.exit(1)

    model_id = args.model_path or "pyannote/speaker-diarization-3.1"
    try:
        import warnings
        warnings.filterwarnings("ignore")
        pipeline = Pipeline.from_pretrained(model_id)
    except Exception as e:
        print(
            f"ERRO ao carregar modelo '{model_id}': {e}\n"
            "Verifique se o modelo foi baixado com o token HuggingFace.\n"
            "Consulte as instruções em scripts/diarize.py.",
            file=sys.stderr,
        )
        sys.exit(1)

    num_spk = args.num_speakers if args.num_speakers > 0 else None
    try:
        diarization = pipeline(args.audio, num_speakers=num_spk)
    except Exception as e:
        print(f"ERRO na diarização: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(args.whisper_json, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"ERRO ao ler {args.whisper_json}: {e}", file=sys.stderr)
        sys.exit(1)

    segments = []
    for seg in data.get("transcription", []):
        timestamps = seg.get("timestamps", {})
        raw_from = timestamps.get("from", "00:00:00,000")
        raw_to = timestamps.get("to", "00:00:00,000")
        start = parse_time(raw_from)
        end = parse_time(raw_to)
        text = seg.get("text", "").strip()
        if not text:
            continue
        speaker = dominant_speaker(diarization, start, end)
        segments.append({
            "speaker": speaker,
            "text": text,
            "start": round(start, 3),
            "end": round(end, 3),
        })

    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(segments, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"ERRO ao escrever {args.output}: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"OK: {len(segments)} segmentos escritos em {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
