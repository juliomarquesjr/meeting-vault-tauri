# AGENTS.md

Este arquivo orienta agentes de IA que forem trabalhar neste projeto. Leia antes de alterar codigo.

## Contexto do produto

Meeting Vault e um app desktop Windows para gravar reunioes, salvar videos locais, transcrever e resumir localmente. A direcao de produto e local-first, profissional, dark mode e preparada para integracoes futuras.

Antes de implementar mudancas relevantes, leia:

- `docs/PRD.md`
- `docs/architecture.md`
- `docs/product-research.md`
- `memory-vault/00-index.md`

## Stack e responsabilidades

- `src/App.tsx`: UI React, estado, gravacao, eventos Tauri e chamadas de comandos.
- `src/styles.css`: design system e layout.
- `src/types.ts`: contratos TypeScript.
- `src-tauri/src/lib.rs`: comandos Tauri, tray, persistencia, FFmpeg, Whisper, llama.cpp e API.
- `src-tauri/tauri.conf.json`: janela sem decoracao nativa e bundle.

## Principios de implementacao

- Preserve a abordagem local-first.
- Nao transforme o produto em apenas um MVP visual.
- Mantenha a UI profissional, densa e operacional.
- Prefira alteracoes pequenas e coerentes com os padroes existentes.
- Nao mova configuracoes locais do usuario para arquivos versionados.
- Nao salve API keys no repositorio.
- Nao reverta alteracoes existentes sem confirmacao explicita.

## Design

- Dark mode com linguagem visual roxa, mas sem visual infantil.
- Sidebar agrupada por areas.
- Paineis consistentes, botoes alinhados e hierarquia clara.
- Evite landing page; o primeiro uso deve ser o app em si.
- Para mudancas visuais importantes, rode o app e valide em tela.

## Pipeline local

O fluxo local e:

```text
video -> FFmpeg audio.wav -> whisper.cpp transcript -> llama.cpp summary JSON
```

Mantenha mensagens de progresso nos pontos importantes. A UI espera eventos `processing-progress`.

Saida esperada do resumo:

```json
{
  "summary": "texto",
  "action_items": ["acao"],
  "decisions": ["decisao"]
}
```

## Cuidados com modelos e ferramentas

- `tools/` e `models/` podem conter arquivos grandes.
- Caminhos de ferramentas/modelos sao configuracao local.
- Modelos LLM grandes podem falhar por falta de RAM.
- Ao lidar com `llama.cpp`, considere contexto, tokens, `--no-repack` e modo CPU/GPU.

## Validacao

Use quando aplicavel:

```powershell
npm run build
cd src-tauri
cargo check
```

Para gerar instalador:

```powershell
npm run tauri:build
```

## Documentacao

Ao tomar decisoes arquiteturais relevantes, adicione ou atualize um ADR em `docs/adr/`.

Ao alterar comportamento de produto, atualize:

- `docs/PRD.md`
- `docs/architecture.md`, se houver impacto tecnico.
- `memory-vault/`, se a informacao for util para handoff.

## Estado conhecido

- Persistencia atual e JSON local.
- SQLite e uma evolucao planejada.
- Integracoes estao representadas na UI, mas ainda nao implementadas.
- O modo API existe como opcao/fallback, mas nao deve se tornar obrigatorio.
