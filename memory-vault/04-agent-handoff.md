# Agent Handoff

## Antes de editar

1. Leia `README.md`.
2. Leia `AGENTS.md`.
3. Leia [PRD](../docs/PRD.md).
4. Leia [Arquitetura](../docs/architecture.md).
5. Verifique `git status --short`.

## Foco atual do produto

O produto deve ser mais completo que um MVP visual. Mudancas devem manter a experiencia profissional e preservar a direcao local-first.

## Areas sensiveis

- `src-tauri/src/lib.rs`: persistencia e execucao de processos externos.
- `src/App.tsx`: estado amplo em um unico componente.
- `src/styles.css`: sistema visual compartilhado.
- Configuracoes locais do usuario em `%APPDATA%`.

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

Ferramentas e modelos em `tools/` e `models/` podem ser grandes. Eles existem para a maquina local do usuario, mas nao devem ser tratados como dependencias leves de codigo.
