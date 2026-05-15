# AGENTS.md

Este arquivo orienta agentes de IA que forem trabalhar neste projeto. Leia antes de alterar codigo.

## Contexto do produto

Meeting Vault e um app desktop Windows para gravar reunioes, salvar videos locais e transcrever localmente. A direcao de produto e local-first, profissional, dark mode e preparada para integracoes futuras.

Antes de implementar mudancas relevantes, leia:

- `docs/PRD.md`
- `docs/architecture.md`
- `docs/ui-style-guide.md` — obrigatorio antes de qualquer mudanca visual
- `docs/product-research.md`
- `memory-vault/00-index.md`

## Stack e responsabilidades

- `src/App.tsx`: UI React, estado, gravacao, eventos Tauri e chamadas de comandos.
- `src/components/`: componentes React reutilizaveis e globais. Prefira extrair novos fluxos visuais para componentes nomeados em vez de aumentar `App.tsx`.
- `src/styles.css`: design system e layout.
- `src/types.ts`: contratos TypeScript.
- `src-tauri/src/lib.rs`: comandos Tauri, tray, persistencia, FFmpeg, Whisper e API.
- `src-tauri/tauri.conf.json`: janela sem decoracao nativa e bundle.

## Principios de implementacao

- Preserve a abordagem local-first.
- Nao transforme o produto em apenas um MVP visual.
- Mantenha a UI profissional, densa e operacional.
- Prefira alteracoes pequenas e coerentes com os padroes existentes.
- Priorize separacao de responsabilidades em componentes React pequenos, previsiveis e nomeados, seguindo pratica comum da comunidade React.
- Mantenha `App.tsx` como orquestrador de estado, views e chamadas Tauri; evite adicionar novos blocos grandes de JSX diretamente nele quando puder criar componente dedicado.
- Componentes globais/reutilizaveis devem ficar em `src/components/`; componentes especificos de uma view devem ser extraidos para subpastas claras quando essa view comecar a crescer.
- Ao extrair componentes, preserve props explicitas, tipos TypeScript e estilos existentes; nao introduza gerenciador de estado global sem decisao arquitetural.
- Nao mova configuracoes locais do usuario para arquivos versionados.
- Nao salve API keys no repositorio.
- Nao reverta alteracoes existentes sem confirmacao explicita.

## Design

Leia `docs/ui-style-guide.md` antes de qualquer mudanca visual. Regras criticas:

- `--accent` (roxo) e usado **apenas** em CTAs, item ativo da sidebar (borda esquerda), foco de input e status-line. Nunca como fundo de cards ou elementos decorativos.
- Hierarquia de botoes: `primary-button` para CTA unica por tela, `secondary-button` para acoes neutras, `icon-button` para acoes de icone, `text-button` para acoes terciarias.
- Paineis no mesmo `.dash-main-row` ou `.dash-footer-row` usam `align-items: stretch` para altura uniforme.
- Player de video e totalmente customizado — nao use `<video controls>`.
- Tags sao badges removiveis com campo de input inline (`.tags-input-container`).
- Formularios usam `label > span + input/select`, com `span` em `11px / 500 weight`.
- Sidebar: item ativo usa `border-left: 2px solid var(--accent)` + `background: var(--surface-2)`. Nunca fundo roxo solido.
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
| Mudanca de comportamento de UI | `docs/PRD.md` (secao 6), `docs/ui-style-guide.md` se mudar tokens/componentes/layout |
| Novo componente ou view | `docs/ui-style-guide.md` com tokens, classes CSS e diagrama de layout |
| Decisao tecnica permanente | Novo ADR em `docs/adr/` com status, contexto, decisao e consequencias |

Ao tomar decisoes arquiteturais relevantes, crie sempre um ADR em `docs/adr/` com numeracao sequencial.

## Estado conhecido

- Persistencia atual e JSON local.
- SQLite e uma evolucao planejada.
- Integracoes estao representadas na UI, mas ainda nao implementadas.
- O modo API existe como opcao/fallback para transcricao, mas nao deve se tornar obrigatorio.
- Sumarizacao com LLM foi removida — ver ADR 0005 para contexto e caminho de retorno.
