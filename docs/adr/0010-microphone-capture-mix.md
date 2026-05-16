# ADR 0010: Captura de microfone via getUserMedia + mixagem AudioContext

**Data:** 2026-05-16  
**Status:** Aceita

## Contexto

Gravações feitas com o app não capturavam o áudio do microfone do usuário. O `getDisplayMedia` — usado para capturar a tela — pode incluir o áudio do sistema (abas/speakers) quando a fonte permitir, mas **não captura o microfone**.

O usuário relatou que gravações de reuniões saíam sem voz, tornando a transcrição inútil para reuniões online.

## Decisão

Capturar o microfone via `getUserMedia({ audio: true })` em paralelo ao `getDisplayMedia`, e misturar as duas fontes de áudio usando a Web Audio API (`AudioContext`) antes de passar o stream combinado ao `MediaRecorder`.

## Implementação

```
getDisplayMedia (vídeo + áudio do sistema opcional)
       ↓                    ↓
  VideoTracks          AudioTracks
       ↓                    ↓
                    AudioContext
                   /           \
   displayAudio ──┤             ├── MediaStreamDestination
   micAudio     ──┘             
                         ↓
              MediaStream final
              (vídeo + áudio mixado)
                         ↓
                   MediaRecorder
```

**`src/App.tsx`:**
- Novos refs: `micStreamRef` e `audioCtxRef` para gerenciar ciclo de vida.
- Após `getDisplayMedia`, se `settings.captureMicrophone` for `true`:
  1. Chama `getUserMedia({ audio: true })`.
  2. Cria `AudioContext` e `createMediaStreamDestination()`.
  3. Conecta o áudio do sistema (se disponível) e o microfone ao destino.
  4. Constrói `MediaStream` final com as faixas de vídeo da tela + faixas de áudio do destino mixado.
- Se a permissão do microfone for negada, o `catch` é silencioso e a gravação continua sem microfone.
- No `onstop`: para as faixas do `micStreamRef`, fecha o `audioCtxRef`.

**`src/types.ts`:** Campo `captureMicrophone: boolean` adicionado à interface `Settings`.

**`src/App.tsx` defaultSettings:** `captureMicrophone: true` (habilitado por padrão).

**UI de configurações:** Toggle "Capturar audio do microfone durante a gravacao" na seção de vídeo/qualidade.

## Consequências

**Positivas:**
- Gravações passam a incluir a voz do usuário, tornando a transcrição funcional para reuniões online.
- Mixagem transparente: o usuário não precisa escolher entre áudio do sistema e microfone — ambos são capturados simultaneamente.
- Fallback gracioso: se o microfone estiver indisponível ou a permissão for negada, a gravação continua com o áudio que estiver disponível.
- Configurável nas settings — pode ser desabilitado por usuários que gravam apenas conteúdo de tela.

**Atenção:**
- O Chrome solicita permissão de microfone na primeira gravação — o usuário deve aceitar.
- Em algumas fontes de captura de tela (ex.: aba específica), o Chrome pode não permitir áudio do sistema; nesse caso apenas o microfone é capturado.
- `AudioContext` mantém um contexto de áudio aberto durante toda a gravação — fechado corretamente no `onstop`.
