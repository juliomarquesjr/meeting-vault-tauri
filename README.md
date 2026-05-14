# Meeting Vault

Meeting Vault e um aplicativo desktop Windows para gravar reunioes, salvar o video localmente, transcrever audio e gerar resumos executivos com proximas acoes e decisoes.

O produto e local-first: o modo principal usa ferramentas locais como FFmpeg, whisper.cpp e llama.cpp. Tambem existe modo API e modo hibrido para fallback quando uma chave estiver configurada.

## Stack

- Tauri 2
- React 19
- TypeScript
- Vite
- Rust
- FFmpeg para extracao de audio
- whisper.cpp para transcricao local
- llama.cpp para resumo local com modelos GGUF

## Funcionalidades

- Gravacao de tela pelo WebView2 usando `MediaRecorder`.
- Tray nativo no Windows para abrir biblioteca, iniciar, finalizar e sair.
- Janela sem barra de titulo nativa, com controles customizados.
- Dashboard operacional com metricas, captura e reunioes recentes.
- Biblioteca local com busca, categorias, tags e player de video.
- Edicao de titulo, categoria e tags da reuniao.
- Configuracoes de video: extensao, qualidade, resolucao, FPS, bitrates e audio.
- Configuracoes de IA: modo local/API/hibrido, idioma, caminhos de ferramentas e modelos.
- Progresso de processamento em tempo real.
- Resumo estruturado com `summary`, `action_items` e `decisions`.

## Estrutura

```text
.
+-- docs/
|   +-- PRD.md
|   +-- architecture.md
|   +-- product-research.md
|   +-- adr/
+-- memory-vault/
+-- models/
+-- scripts/
+-- src/
+-- src-tauri/
+-- tools/
```

Arquivos principais:

- `src/App.tsx`: UI, gravacao, eventos e chamadas Tauri.
- `src/types.ts`: tipos compartilhados no frontend.
- `src/styles.css`: sistema visual.
- `src-tauri/src/lib.rs`: comandos Tauri, tray, persistencia e pipelines.
- `src-tauri/tauri.conf.json`: configuracao da janela e bundle.
- `docs/PRD.md`: requisitos de produto.
- `docs/architecture.md`: arquitetura e fluxos.
- `memory-vault/00-index.md`: memoria em formato Obsidian.
- `AGENTS.md`: instrucoes para agentes de IA.

## Executar em desenvolvimento

```powershell
npm install
npm run tauri:dev
```

## Build

```powershell
npm run build
npm run tauri:build
```

## Validacao rapida

```powershell
npm run build
cd src-tauri
cargo check
```

## Dados locais

O app usa o diretorio de dados do Tauri. No Windows, normalmente fica em algo como:

```text
%APPDATA%\com.julio.meetingvault\
```

Conteudo esperado:

- `store.json`: metadados, configuracoes e estado da biblioteca.
- `recordings/`: videos gravados.
- `processing/`: arquivos temporarios de audio/transcricao.

## Configuracao local de IA

No app, em Configuracoes, defina:

- Caminho do FFmpeg.
- Caminho do `whisper-cli`.
- Caminho do modelo Whisper `.bin`.
- Caminho do `llama-cli`.
- Caminho do modelo LLM `.gguf`.
- Contexto LLM e tokens maximos.
- Modo de hardware local: auto, CPU, CUDA ou Vulkan.

Exemplos de caminhos locais neste projeto:

```text
tools\ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe
tools\whisper.cpp\Release\whisper-cli.exe
tools\llama.cpp\llama-cli.exe
models\whisper\ggml-large-v3-turbo.bin
models\llm\Qwen3-8B-Q4_K_M.gguf
```

Modelos grandes em CPU podem exigir muita memoria livre. Se o Whisper funcionar e o resumo falhar com erro de alocacao, reduza o contexto LLM, reduza tokens maximos ou use um modelo GGUF menor.

## Documentacao

- [PRD](docs/PRD.md)
- [Arquitetura](docs/architecture.md)
- [Pesquisa de produto](docs/product-research.md)
- [ADRs](docs/adr)
- [Memory Vault](memory-vault/00-index.md)

## Roadmap resumido

- Teste de configuracao local para FFmpeg, Whisper e llama.cpp.
- Mensagens melhores para erros de memoria em modelos locais.
- Migracao de `store.json` para SQLite.
- Exportacao Markdown/JSON de reunioes.
- Integracoes com calendario, Notion/Obsidian, Slack/Teams e CRM.
