# ADR 0007: Gravacao de chunks diretamente ao disco via IPC streaming

**Data:** 2026-05-15
**Status:** Aceito

## Contexto

Gravacoes longas (20+ minutos) falhavam ao finalizar porque o `MediaRecorder` acumulava todos os chunks de video em memoria no frontend, que entao tentava serializar um blob inteiro como `number[]` em uma unica chamada IPC para `save_recording`. Uma gravacao de 20 minutos em WebM a 2.4 Mbps + 128 kbps de audio gera ~375 MB; esse payload serializado como JSON e muito grande para o canal IPC do Tauri, causando erro na finalizacao.

O usuario mencionou FLV como alternativa de formato, mas o problema nao era o formato e sim o acumulo em memoria.

## Decisao

Substituir `save_recording` por um pipeline de streaming em tres etapas:

1. `begin_recording_session(session_id, mime_type)` — cria `<session_id>.tmp` em `recordings/` no momento em que a gravacao comeca.
2. `append_recording_chunk(session_id, bytes)` — chamado a cada `ondataavailable` (intervalo de 1 segundo). Anexa o chunk ao `.tmp` via `std::io::Write`. O payload de cada chunk e ~316 KB — dentro dos limites IPC.
3. `finalize_recording_session(session_id, title, ...)` — fecha o arquivo, renomeia `.tmp` para `<uuid>.webm`, cria a entrada `Meeting` e persiste o store.

`cancel_recording_session` apaga o `.tmp` sem criar `Meeting`.

No frontend, `chunkQueueRef` serializa os `append_recording_chunk` para evitar race conditions; `finalize` aguarda a fila vazar antes de chamar o backend.

## Consequencias

- **Gravacoes longas funcionam:** o pico de memoria por chamada IPC cai de 375 MB para ~316 KB.
- **Formato mantido em WebM:** nenhuma necessidade de FLV ou conversao adicional.
- **Arquivo `.tmp` visivel em disco durante gravacao:** e intencionalmente parcial; nao deve ser aberto durante a gravacao.
- **Crash mid-recording:** se o app fechar durante a gravacao, o `.tmp` fica em `recordings/` como orfao. Nao ha limpeza automatica nesta fase.
- **Compatibilidade retroativa:** `save_recording` pode ser mantido no backend para uso legado; os tipos TypeScript foram atualizados para usar `FinalizeRecordingInput`.
