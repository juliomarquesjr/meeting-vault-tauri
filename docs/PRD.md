# PRD: Meeting Vault

## 1. Visao geral

Meeting Vault e um aplicativo desktop local-first para Windows, focado em gravar reunioes, preservar o video compactado, transcrever o audio e gerar resumo executivo com proximas acoes e decisoes. O produto prioriza controle local dos dados, operacao por tray do sistema e uma biblioteca pesquisavel para consulta posterior.

O app atual usa Tauri 2, React, TypeScript e Rust. A captura de tela ocorre no WebView2 via `MediaRecorder`; a persistencia e local em JSON; o processamento local usa FFmpeg, whisper.cpp e llama.cpp. Tambem existe caminho opcional por API para transcricao e resumo.

## 2. Problema

Reunioes geram informacao critica que fica dispersa entre videochamadas, conversas, notas manuais e memoria individual. Ferramentas SaaS similares resolvem parte do problema, mas frequentemente exigem upload de audio/video, integracoes externas e assinaturas. O objetivo deste projeto e oferecer uma alternativa desktop, privada e configuravel, inicialmente para Windows.

## 3. Publico-alvo

- Profissionais que participam de muitas reunioes e precisam recuperar decisoes.
- Usuarios que preferem manter gravacoes, transcricoes e resumos localmente.
- Equipes pequenas que ainda nao precisam de um backend compartilhado.
- Usuarios tecnicos com hardware local suficiente para executar modelos Whisper e LLM GGUF.

## 4. Objetivos

- Gravar tela e audio em arquivo de video local.
- Organizar reunioes em biblioteca com titulo editavel, categorias e tags.
- Transcrever reunioes localmente sem chave de API.
- Resumir reunioes localmente sem chave de API.
- Exibir progresso de processamento de forma clara.
- Operar pelo tray do Windows para abrir a biblioteca, iniciar e finalizar gravacao.
- Manter uma interface profissional, moderna, dark mode e com identidade visual roxa.

## 5. Nao objetivos nesta fase

- Sincronizacao multiusuario.
- Backend remoto.
- Compartilhamento publico de videos.
- Diarizacao precisa de falantes.
- Captura nativa de dispositivos e mixers complexos como OBS.
- Integracoes reais com calendario, CRM, Slack, Teams ou Notion.
- Banco SQLite completo, embora esteja previsto como evolucao.

## 6. Funcionalidades atuais

### 6.1 Dashboard

- Resumo operacional da biblioteca.
- Metricas de duracao, armazenamento, reunioes resumidas e estado de processamento.
- Painel de nova gravacao.
- Lista de reunioes recentes.
- Indicadores de pipeline e estado local.

### 6.2 Gravacao

- Captura de tela via `navigator.mediaDevices.getDisplayMedia`.
- Gravacao em WebM via `MediaRecorder`.
- Configuracao de resolucao maxima, FPS, bitrates e captura de audio do sistema quando disponivel.
- Salvamento local por comando Tauri `save_recording`.
- Abertura e revelacao do arquivo gravado pelo sistema operacional.

### 6.3 Biblioteca

- Lista de reunioes ordenada por data.
- Busca por titulo, categoria, tags, resumo, transcricao, acoes e decisoes.
- Filtros por categoria e tag.
- Edicao de titulo, categoria e tags.
- Player local usando `convertFileSrc`.
- Exclusao de reuniao e arquivo associado.

### 6.4 Taxonomia

- Visualizacao de categorias existentes.
- Visualizacao de tags existentes.
- Atalhos para filtrar a biblioteca por categoria ou tag.

### 6.5 Processamento local

- Validacao de caminhos para FFmpeg, `whisper-cli`, modelo Whisper, `llama-cli` e modelo LLM.
- Extracao de audio para WAV mono 16 kHz com FFmpeg.
- Transcricao com whisper.cpp.
- Resumo com llama.cpp usando prompt estruturado para JSON.
- Chunking de transcricoes longas e consolidacao final.
- Eventos `processing-progress` para atualizar a UI em tempo real.

### 6.6 Processamento por API

- Modo API para transcricao via endpoint de audio e resumo via chat completions.
- Modo hibrido que tenta local primeiro e usa API como fallback quando ha chave configurada.

### 6.7 Tray e janela

- Tray nativo com abrir biblioteca, iniciar gravacao, finalizar gravacao e sair.
- Janela sem decoracao nativa do Windows.
- Controles customizados para minimizar, maximizar e ocultar.
- Fechar a janela oculta o app em vez de encerrar.

## 7. Requisitos funcionais

| ID | Requisito | Status |
| --- | --- | --- |
| RF-001 | O usuario deve iniciar gravacao pela dashboard/header. | Implementado |
| RF-002 | O usuario deve iniciar e finalizar gravacao pelo tray. | Implementado |
| RF-003 | O app deve salvar o arquivo de video localmente. | Implementado |
| RF-004 | O usuario deve navegar por reunioes gravadas. | Implementado |
| RF-005 | O usuario deve editar titulo, categoria e tags. | Implementado |
| RF-006 | O usuario deve filtrar reunioes por categoria e tag. | Implementado |
| RF-007 | O usuario deve buscar por conteudo textual. | Implementado |
| RF-008 | O usuario deve abrir o video no app e no sistema. | Implementado |
| RF-009 | O usuario deve gerar transcricao local. | Implementado |
| RF-010 | O usuario deve gerar resumo local. | Implementado |
| RF-011 | O usuario deve acompanhar progresso do processamento. | Implementado |
| RF-012 | O usuario deve configurar caminhos de ferramentas e modelos locais. | Implementado |
| RF-013 | O app deve suportar fallback por API quando configurado. | Implementado |
| RF-014 | O app deve permitir integracoes externas no futuro. | Planejado |
| RF-015 | O app deve migrar persistencia para SQLite quando a biblioteca crescer. | Planejado |

## 8. Requisitos nao funcionais

- Privacidade: videos, metadados, transcricoes e resumos devem permanecer locais por padrao.
- Performance: UI deve permanecer responsiva durante processamento externo.
- Portabilidade inicial: foco em Windows.
- Resiliencia: erros de ferramentas externas devem aparecer em linguagem acionavel.
- Observabilidade: etapas de processamento devem ser visiveis ao usuario.
- Manutenibilidade: regras de produto, arquitetura e decisoes devem estar documentadas.

## 9. Modelo de dados

### Meeting

- `id`: UUID.
- `title`: titulo editavel.
- `createdAt`: data de registro.
- `startedAt`: data de inicio da gravacao.
- `category`: categoria livre.
- `tags`: lista normalizada de tags.
- `durationSeconds`: duracao.
- `sizeBytes`: tamanho do arquivo.
- `recordingPath`: caminho local do video.
- `mimeType`: MIME original do blob gravado.
- `transcript`: texto transcrito.
- `summary`: resumo executivo.
- `actionItems`: proximas acoes.
- `decisions`: decisoes.
- `status`: `recorded`, `processing`, `completed` ou `error`.
- `progressMessage`: etapa atual.
- `progressPercent`: percentual exibido.
- `error`: ultimo erro.

### Settings

Inclui modo de processamento, modelos API, idioma, caminhos locais de FFmpeg/Whisper/llama.cpp, parametros de LLM, presets de video e automacoes.

## 10. Fluxos principais

### Gravacao

1. Usuario preenche titulo, categoria e tags.
2. UI chama `getDisplayMedia`.
3. `MediaRecorder` captura chunks de video.
4. Ao parar, o blob vira bytes.
5. Frontend chama `save_recording`.
6. Backend salva arquivo em `recordings/` e atualiza `store.json`.

### Processamento local

1. Usuario clica em gerar resumo.
2. Backend marca reuniao como `processing`.
3. Valida caminhos locais.
4. FFmpeg extrai audio WAV.
5. whisper.cpp gera transcricao.
6. llama.cpp gera resumo estruturado.
7. Backend persiste transcricao, resumo, acoes e decisoes.
8. UI recebe eventos de progresso.

### Processamento hibrido

1. Backend tenta pipeline local.
2. Se falhar e houver API key, usa pipeline API.
3. Se ambos falharem, marca reuniao como `error`.

## 11. Riscos e restricoes

- Modelos LLM grandes em CPU podem falhar por falta de memoria, especialmente com contexto alto.
- `MediaRecorder` depende das capacidades do WebView2 e da fonte escolhida.
- Captura de audio do sistema pode variar conforme permissao e dispositivo.
- JSON local e simples, mas nao ideal para biblioteca grande.
- Caminhos absolutos para ferramentas e modelos sao configuracao local do usuario.

## 12. Roadmap sugerido

### Curto prazo

- Adicionar teste de configuracao local para FFmpeg, Whisper e llama.cpp.
- Exibir estimativa de RAM/modelo recomendado na tela de configuracao.
- Reduzir defaults de contexto LLM para perfil CPU seguro.
- Melhorar mensagens de erro para falta de memoria do llama.cpp.

### Medio prazo

- Migrar `store.json` para SQLite.
- Adicionar historico de processamento e logs por reuniao.
- Implementar importacao de videos existentes.
- Adicionar exportacao Markdown/JSON da reuniao.
- Adicionar diarizacao ou identificacao manual de participantes.

### Longo prazo

- Integracoes com calendario.
- Integracoes com Notion/Obsidian.
- Sincronizacao opcional.
- Perfis de hardware e selecao automatica de modelo.
- Busca semantica local sobre transcricoes.
