# Meeting Vault

Meeting Vault e um aplicativo desktop Windows para gravar reunioes, salvar o video localmente e transcrever o audio com privacidade.

O produto e local-first: o modo principal usa ferramentas locais como FFmpeg e whisper.cpp. Tambem existe modo API e modo hibrido para fallback quando uma chave da OpenAI estiver configurada. Diarizacao de falantes e opcional via Python/pyannote.audio. Resumos sao opcionais e usam OpenRouter quando o usuario configura uma chave propria.

## Stack

- Tauri 2
- React 19
- TypeScript
- Vite
- Rust
- FFmpeg para extracao de audio
- whisper.cpp para transcricao local
- Python + pyannote.audio para diarizacao opt-in

## Funcionalidades

- Gravacao de tela pelo WebView2 usando `MediaRecorder`.
- Tray nativo no Windows para abrir biblioteca, iniciar, finalizar e sair.
- Janela sem barra de titulo nativa, com controles customizados.
- Dashboard operacional com metricas, captura e reunioes recentes.
- Biblioteca local com busca, categorias, tags e player de video.
- Edicao de titulo, categoria e tags da reuniao.
- Configuracoes de video: extensao, qualidade, resolucao, FPS, bitrates e audio.
- Configuracoes de transcricao: modo local/API/hibrido, idioma, caminhos de ferramentas e modelo Whisper.
- Progresso de transcricao em tempo real.
- Transcricao exibida diretamente na biblioteca.
- Diarizacao local opt-in com falantes A/B/C quando Python, pyannote.audio e modelo HuggingFace estiverem configurados.
- Resumo sob demanda de transcricoes via OpenRouter, com modelo configuravel.

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
|   +-- whisper/
+-- scripts/
+-- src/
+-- src-tauri/
+-- tools/
    +-- ffmpeg/
    +-- whisper.cpp/
```

Arquivos principais:

- `src/App.tsx`: UI, gravacao, eventos e chamadas Tauri.
- `src/components/`: componentes globais reutilizaveis, iniciando por `ConfirmDialog`.
- `src/types.ts`: tipos compartilhados no frontend.
- `src/styles.css`: sistema visual.
- `src-tauri/src/lib.rs`: comandos Tauri, tray, persistencia e pipelines.
- `src-tauri/tauri.conf.json`: configuracao da janela e bundle.
- `docs/PRD.md`: requisitos de produto.
- `docs/architecture.md`: arquitetura e fluxos.
- `docs/adr/`: decisoes arquiteturais registradas.
- `memory-vault/00-index.md`: memoria em formato Obsidian.
- `AGENTS.md`: instrucoes para agentes de IA.

## Convencoes React

- Preserve `src/App.tsx` como orquestrador de estado, views, eventos Tauri e chamadas de comandos.
- Prefira extrair novos blocos de UI para componentes nomeados em `src/components/`.
- Componentes globais ou reutilizaveis ficam direto em `src/components/`; componentes de uma view podem ganhar subpastas por dominio quando crescerem.
- Componentes devem receber props e callbacks tipados, evitando acoplamento direto com Tauri quando o container puder coordenar a acao.
- Antes de adicionar JSX grande em `App.tsx`, avalie se isso deve virar componente.

## Executar em desenvolvimento

```powershell
npm install
npm run tauri:dev
```

## Baixar ferramentas locais

Os diretorios `tools/` e `models/` sao ignorados pelo Git porque contem binarios e modelos grandes. Em uma maquina nova, rode:

```powershell
npm run bootstrap:local-ai
```

O script baixa:

- FFmpeg para `tools/ffmpeg/`.
- `whisper-cli.exe` para `tools/whisper.cpp/`.
- Modelo Whisper para `models/whisper/`.
- Opcionalmente instala dependencias de diarizacao Python e baixa o modelo pyannote se `-HuggingFaceToken` for informado.

Por padrao, o modelo baixado e `large-v3-turbo`. Para escolher outro:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/bootstrap-local-ai.ps1 -WhisperModel small
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

O app usa o diretorio de dados do Tauri. No Windows, normalmente fica em:

```text
%APPDATA%\com.julio.meetingvault\
```

Conteudo esperado:

- `store.json`: metadados, configuracoes e estado da biblioteca.
- `recordings/`: videos gravados.
- `processing/`: arquivos temporarios de audio e transcricao.

## Configuracao local de IA

No app, em Sistema > Transcricao, defina:

- Caminho do FFmpeg.
- Caminho do `whisper-cli`.
- Caminho do modelo Whisper `.bin`.
- Numero de threads do Whisper.
- Idioma de transcricao.

Exemplos de caminhos locais neste projeto:

```text
tools\ffmpeg\ffmpeg-8.1.1-essentials_build\bin\ffmpeg.exe
tools\whisper.cpp\Release\whisper-cli.exe
models\whisper\ggml-large-v3-turbo.bin
```

Modelos Whisper maiores podem exigir mais memoria e tempo de CPU. Para maquinas modestas, prefira `small` ou `medium` no script de bootstrap.

## Diarizacao local

No menu Sistema > Video e qualidade, habilite "Identificar falantes apos transcricao" e configure:

- Caminho do Python.
- Caminho de `scripts\diarize.py`.
- Numero de falantes, ou `0` para detectar automaticamente.
- Token HuggingFace apenas para o download inicial do modelo.

Instalacao manual recomendada no mesmo Python configurado no app:

```powershell
python -m pip install -U pyannote.audio
python -m pip install -U --force-reinstall torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu
```

O modelo `pyannote/speaker-diarization-3.1` exige aceite dos termos no HuggingFace. Depois do download, o app usa o cache local e o token nao e necessario em runtime.

## Resumo com OpenRouter

No menu Sistema > Resumo, escolha:

- `Desativado`: nao envia transcricoes para servicos externos.
- `OpenRouter`: usa a chave OpenRouter do usuario e o ID de modelo configurado.

O app envia apenas o texto da transcricao para `https://openrouter.ai/api/v1/chat/completions` quando o usuario aciona o resumo. Modelos free podem mudar limites, disponibilidade e politicas.

## Documentacao

- [PRD](docs/PRD.md)
- [Arquitetura](docs/architecture.md)
- [UI Style Guide](docs/ui-style-guide.md) — tokens de design, componentes e especificacao de layout de cada tela
- [Pesquisa de produto](docs/product-research.md)
- [ADRs](docs/adr)
- [Memory Vault](memory-vault/00-index.md)
- [AGENTS.md](AGENTS.md)

## Roadmap resumido

- Teste de configuracao local para FFmpeg e Whisper.
- Exportacao de transcricao em Markdown/TXT.
- Migracao de `store.json` para SQLite.
- Refinamento de prompts e avaliacao de qualidade dos resumos OpenRouter.
- Renomeacao manual de falantes apos diarizacao.
- Integracoes com calendario, Notion/Obsidian, Slack/Teams e CRM.
