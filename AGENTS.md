# AGENTS.md

Este arquivo orienta agentes de IA que forem trabalhar neste projeto. Leia antes de alterar codigo.

## Contexto do produto

Meeting Vault e um app desktop Windows para gravar reunioes, salvar videos locais e transcrever localmente. A direcao de produto e local-first, profissional, dark mode e preparada para integracoes futuras.

Antes de implementar mudancas relevantes, leia:

- `docs/PRD.md`
- `docs/architecture.md`
- `docs/product-research.md`
- `memory-vault/00-index.md`

## Stack e responsabilidades

- `src/App.tsx`: UI React, estado, gravacao, eventos Tauri e chamadas de comandos.
- `src/styles.css`: design system e layout.
- `src/types.ts`: contratos TypeScript.
- `src-tauri/src/lib.rs`: comandos Tauri, tray, persistencia, FFmpeg, Whisper e API.
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

## Pipeline local atual

O fluxo local e:

```text
video → FFmpeg (audio.wav 16kHz mono) → whisper.cpp (transcript)
```

O resumo com llama.cpp foi removido nesta fase (ver ADR 0005). Nao reintroduza sem discussao de produto.

Mantenha mensagens de progresso nos pontos importantes. A UI espera eventos `processing-progress`.

## Cuidados com modelos e ferramentas

- `tools/` e `models/` podem conter arquivos grandes.
- Caminhos de ferramentas/modelos sao configuracao local.
- O diretorio `tools/llama.cpp/` e o modelo `models/llm/*.gguf` foram removidos — nao referencie esses caminhos.
- Ao lidar com whisper.cpp, considere threads, modelo e idioma configurados pelo usuario.

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

## Documentacao — regra obrigatoria

**Toda mudanca relevante de produto ou arquitetura deve atualizar a documentacao no mesmo PR/sessao.**

O que atualizar dependendo do tipo de mudanca:

| Tipo de mudanca | O que atualizar |
| --- | --- |
| Nova funcionalidade | `docs/PRD.md` (secoes 4, 6, 7, 9, 10), `docs/architecture.md`, `README.md`, `memory-vault/` afetado |
| Remocao de funcionalidade | `docs/PRD.md` (secao 5 "Nao objetivos"), `docs/architecture.md`, `README.md`, ADR novo em `docs/adr/`, `memory-vault/` afetado |
| Mudanca arquitetural | `docs/architecture.md`, ADR novo ou revisado em `docs/adr/`, `memory-vault/02-architecture-map.md` |
| Mudanca de pipeline de IA | `docs/architecture.md`, `memory-vault/03-local-ai-runbook.md`, ADR se for decisao permanente |
| Mudanca de modelo de dados | `docs/PRD.md` (secao 9), `src/types.ts`, `memory-vault/02-architecture-map.md` |
| Mudanca de comportamento de UI | `docs/PRD.md` (secao 6), `README.md` se afeta configuracao do usuario |
| Decisao tecnica permanente | Novo ADR em `docs/adr/` com status, contexto, decisao e consequencias |

Ao tomar decisoes arquiteturais relevantes, crie sempre um ADR em `docs/adr/` com numeracao sequencial.

## Estado conhecido

- Persistencia atual e JSON local.
- SQLite e uma evolucao planejada.
- Integracoes estao representadas na UI, mas ainda nao implementadas.
- O modo API existe como opcao/fallback para transcricao, mas nao deve se tornar obrigatorio.
- Sumarizacao com LLM foi removida — ver ADR 0005 para contexto e caminho de retorno.
