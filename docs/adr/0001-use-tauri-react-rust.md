# ADR 0001: Usar Tauri 2 com React, TypeScript e Rust

## Status

Aceita.

## Contexto

O produto precisa ser um aplicativo desktop para Windows, com UI moderna, tray do sistema, acesso a arquivos locais e execucao de ferramentas externas como FFmpeg, whisper.cpp e llama.cpp. A aplicacao deve ser leve e manter boa performance local.

## Decisao

Usar Tauri 2 como shell desktop, React/TypeScript/Vite para a interface e Rust para comandos nativos, persistencia local, tray e chamadas a ferramentas externas.

## Consequencias positivas

- Binario desktop mais leve que alternativas baseadas em Chromium completo.
- Acesso nativo a tray, sistema de arquivos e processos externos via Rust.
- UI web produtiva e flexivel.
- Boa separacao entre interface e operacoes locais sensiveis.

## Consequencias negativas

- Dependencia do WebView2 no Windows.
- APIs de captura sao limitadas pelo browser engine.
- Desenvolvedores precisam conhecer React e Rust.
- Alguns recursos desktop avancados podem exigir plugins Tauri ou codigo Rust adicional.

## Alternativas consideradas

- Electron: mais maduro para desktop web, mas maior consumo de recursos.
- App nativo Windows: melhor integracao, mas maior custo de desenvolvimento.
- Python desktop: rapido para prototipar, mas menos adequado para UI moderna e distribuicao polida.
