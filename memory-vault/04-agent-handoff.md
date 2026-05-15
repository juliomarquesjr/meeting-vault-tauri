# Agent Handoff

## Antes de editar

1. Leia `README.md`.
2. Leia `AGENTS.md` — contem regras obrigatorias sobre documentacao.
3. Leia [PRD](../docs/PRD.md).
4. Leia [Arquitetura](../docs/architecture.md).
5. Verifique `git status --short`.

## Foco atual do produto

O produto deve ser mais completo que um MVP visual. Mudancas devem manter a experiencia profissional e preservar a direcao local-first.

O pipeline de IA atual e apenas transcricao (FFmpeg + Whisper). O resumo com LLM foi removido — nao reintroduza sem discussao de produto (ver ADR 0005).

## Areas sensiveis

- `src-tauri/src/lib.rs`: persistencia e execucao de processos externos.
- `src/App.tsx`: estado amplo em um unico componente. Priorize reduzir crescimento extraindo componentes React quando houver novo fluxo visual ou JSX extenso.
- `src/components/`: componentes globais/reutilizaveis. Novos componentes devem ter props explicitas, tipos TypeScript e nao devem chamar Tauri diretamente quando o container puder receber callbacks.
- `src/styles.css`: sistema visual compartilhado.
- Configuracoes locais do usuario em `%APPDATA%`.

## Diretriz React para proximos agentes

- Prefira separacao de responsabilidades no estilo comum da comunidade React: componentes pequenos, nomeados e focados em uma responsabilidade.
- `App.tsx` deve orquestrar estado, views e comandos; componentes devem renderizar UI e emitir callbacks.
- Extraia componentes quando houver modal, painel, card complexo, formulario, toolbar ou fluxo com estado proprio.
- Mantenha CSS no design system atual e documente novas classes em `docs/ui-style-guide.md`.

## Regra de documentacao

Toda mudanca relevante de produto ou arquitetura exige atualizacao de documentacao no mesmo ciclo. Consulte a tabela em `AGENTS.md` para saber o que atualizar em cada tipo de mudanca.

## Validacao minima

Use, quando aplicavel:

```powershell
npm run build
cd src-tauri
cargo check
```

Para build desktop:

```powershell
npm run tauri:build
```

## Cuidado com ambiente local

Ferramentas e modelos em `tools/` e `models/` podem ser grandes. Eles existem para a maquina local do usuario, mas nao devem ser tratados como dependencias leves de codigo. O diretorio `tools/llama.cpp/` e o modelo `models/llm/` foram removidos e nao existem mais no projeto.
