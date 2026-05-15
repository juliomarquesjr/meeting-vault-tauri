# PRD: Meeting Vault

## 1. Visao geral

Meeting Vault e um aplicativo desktop local-first para Windows, focado em gravar reunioes, preservar o video compactado, transcrever o audio localmente e, quando o usuario optar, gerar resumos de transcricoes via OpenRouter. O produto prioriza controle local dos dados, operacao por tray do sistema e uma biblioteca pesquisavel para consulta posterior.

O app atual usa Tauri 2, React, TypeScript e Rust. A captura de tela ocorre no WebView2 via `MediaRecorder`; a persistencia e local em JSON; o processamento local usa FFmpeg e whisper.cpp. Tambem existe caminho opcional por API para transcricao.

## 2. Problema

Reunioes geram informacao critica que fica dispersa entre videochamadas, conversas, notas manuais e memoria individual. Ferramentas SaaS similares resolvem parte do problema, mas frequentemente exigem upload de audio/video, integracoes externas e assinaturas. O objetivo deste projeto e oferecer uma alternativa desktop, privada e configuravel, inicialmente para Windows.

## 3. Publico-alvo

- Profissionais que participam de muitas reunioes e precisam recuperar o que foi dito.
- Usuarios que preferem manter gravacoes e transcricoes localmente.
- Equipes pequenas que ainda nao precisam de um backend compartilhado.
- Usuarios tecnicos com hardware local suficiente para executar modelos Whisper.

## 4. Objetivos

- Gravar tela e audio em arquivo de video local.
- Organizar reunioes em biblioteca com titulo editavel, categorias e tags.
- Transcrever reunioes localmente sem chave de API.
- Exibir progresso de processamento de forma clara.
- Operar pelo tray do Windows para abrir a biblioteca, iniciar e finalizar gravacao.
- Manter uma interface profissional, moderna, dark mode e com identidade visual roxa.

## 5. Nao objetivos nesta fase

- Sumarizacao local com llama.cpp ou modelos GGUF nesta fase (removida — ver ADR 0005).
- Sumarizacao obrigatoria ou sem consentimento explicito do usuario.
- Sincronizacao multiusuario.
- Backend remoto.
- Compartilhamento publico de videos.
- Diarizacao precisa de falantes.
- Captura nativa de dispositivos e mixers complexos como OBS.
- Integracoes reais com calendario, CRM, Slack, Teams ou Notion.
- Banco SQLite completo, embora esteja previsto como evolucao.

## 6. Funcionalidades atuais

### 6.1 Dashboard

Layout em tres zonas verticais (ver `docs/ui-style-guide.md` para especificacao de layout):

- **Zona KPI:** quatro tiles com metrica principal e contexto secundario — reunioes gravadas, tempo total gravado, percentual transcrito e armazenamento consumido.
- **Zona principal:** formulario de nova gravacao (titulo, categoria, tags, botao de iniciar/finalizar) ao lado da lista das cinco reunioes mais recentes com scroll proprio. O indicador de status de captura (resolucao, FPS, tempo gravando) fica inline no cabecalho do painel.
- **Zona rodape:** estado do pipeline (transcritas, processando, com erro, duracao media) ao lado do resumo de taxonomia (contagem de categorias e tags, tag cloud).

Todas as zonas usam `align-items: stretch` para garantir altura uniforme entre paineis da mesma linha.

### 6.2 Gravacao

- Captura de tela via `navigator.mediaDevices.getDisplayMedia`.
- Gravacao em WebM via `MediaRecorder`.
- Campo de titulo, categoria e tags configurados antes de iniciar a gravacao.
- Tags adicionadas como badges removiveis (Enter ou virgula confirma cada tag).
- Configuracao de resolucao maxima, FPS, bitrates e captura de audio do sistema quando disponivel.
- Indicador de status inline no cabecalho do painel (resolucao, FPS e tempo gravando).
- Salvamento local por comando Tauri `save_recording`.
- Abertura e revelacao do arquivo gravado pelo sistema operacional.

### 6.3 Biblioteca

Layout em dois paineis lado a lado (lista | detalhe), ambos com altura fixa e scroll independente.

**Painel esquerdo — lista:**
- Reunioes ordenadas por data, exibidas como linhas compactas com barra de status colorida lateral.
- Busca full-text por titulo, categoria, tags e transcricao.
- Filtros por categoria e tag em selects customizados.
- Botao de refresh para recarregar a lista.

**Painel direito — detalhe:**
- Titulo editavel em campo de texto inline.
- Barra de acoes: Salvar, Assistir no player nativo, Abrir pasta, Excluir.
- Edicao de categoria (input com datalist) e tags (badges removiveis).
- Metadados da reuniao: data, duracao, tamanho, status.
- Player de video customizado: controles de play/pause, scrubber com progresso, volume, tela cheia. Overlay de play grande exibido quando o video esta pausado.
- Area de conteudo com dois cards de acao: Transcricao e Resumo.
- Quando transcricao ou resumo existem, o usuario abre o conteudo em modal proprio acionado por botao.
- Acoes de reprocessamento ficam dentro do modal aberto: `Retranscrever` para transcricao e `Regenerar` para resumo.
- O modal de resumo interpreta Markdown basico; o modal de transcricao permanece como texto puro.
- Estados vazios mantem CTA contextual: transcrever, gerar resumo ou informar que o resumo exige transcricao.

### 6.4 Taxonomia

- Visualizacao de categorias existentes.
- Visualizacao de tags existentes.
- Atalhos para filtrar a biblioteca por categoria ou tag.

### 6.5 Processamento local

- Validacao de caminhos para FFmpeg, `whisper-cli` e modelo Whisper.
- Extracao de audio para WAV mono 16 kHz com FFmpeg.
- Transcricao com whisper.cpp.
- Eventos `processing-progress` para atualizar a UI em tempo real.

### 6.6 Processamento por API

- Modo API para transcricao via endpoint de audio da OpenAI (`/v1/audio/transcriptions`).
- Modo hibrido que tenta local primeiro e usa API como fallback quando ha chave configurada.

### 6.7 Resumo por OpenRouter

- Resumo de transcricoes sob demanda, separado do comando de transcricao.
- Modos de resumo limitados a `Desativado` e `OpenRouter`.
- Configuracao em tela propria de Resumo, separada da tela de Transcricao/Whisper.
- O usuario configura a chave OpenRouter e o ID do modelo, permitindo testar modelos free trocando apenas o `model`.
- A transcricao e enviada ao OpenRouter somente quando o usuario aciona o resumo e o modo OpenRouter esta configurado.

### 6.8 Tray e janela

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
| RF-010 | O usuario deve acompanhar progresso do processamento. | Implementado |
| RF-011 | O usuario deve configurar caminhos de ferramentas e modelos locais. | Implementado |
| RF-012 | O app deve suportar fallback por API quando configurado. | Implementado |
| RF-013 | O app deve gerar resumo estruturado de transcricoes via OpenRouter quando configurado. | Implementado |
| RF-014 | O app deve permitir integracoes externas no futuro. | Planejado |
| RF-015 | O app deve migrar persistencia para SQLite quando a biblioteca crescer. | Planejado |

## 8. Requisitos nao funcionais

- Privacidade: videos, metadados e transcricoes devem permanecer locais por padrao.
- Performance: UI deve permanecer responsiva durante processamento externo.
- Portabilidade inicial: foco em Windows.
- Resiliencia: erros de ferramentas externas devem aparecer em linguagem acionavel.
- Observabilidade: etapas de processamento devem ser visiveis ao usuario.
- Manutenibilidade: regras de produto, arquitetura e decisoes devem estar documentadas e atualizadas a cada mudanca relevante.

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
- `summary`: resumo da transcricao gerado via OpenRouter.
- `status`: `recorded`, `processing`, `completed` ou `error`.
- `progressMessage`: etapa atual.
- `progressPercent`: percentual exibido.
- `error`: ultimo erro.

### Settings

Inclui modo de processamento (`local`, `api`, `hybrid`), modelo de transcricao API, idioma, caminhos locais de FFmpeg e Whisper, threads do Whisper, presets de video, automacao de transcricao e configuracao de resumo (`disabled` ou `openrouter`, chave OpenRouter e modelo OpenRouter).

## 10. Fluxos principais

### Gravacao

1. Usuario preenche titulo, categoria e tags.
2. UI chama `getDisplayMedia`.
3. `MediaRecorder` captura chunks de video.
4. Ao parar, o blob vira bytes.
5. Frontend chama `save_recording`.
6. Backend salva arquivo em `recordings/` e atualiza `store.json`.

### Processamento local

1. Usuario clica em transcrever.
2. Backend marca reuniao como `processing` e emite progresso.
3. Valida caminhos locais (FFmpeg, whisper-cli, modelo Whisper).
4. FFmpeg extrai audio WAV mono 16 kHz.
5. whisper.cpp gera transcricao.
6. Backend persiste transcricao e marca status `completed`.
7. UI recebe eventos de progresso e exibe transcricao.

### Processamento hibrido

1. Backend tenta pipeline local.
2. Se falhar e houver API key, usa transcricao via API da OpenAI.
3. Se ambos falharem, marca reuniao como `error`.

### Resumo OpenRouter

1. Usuario aciona resumo em uma reuniao ja transcrita.
2. Backend valida `summaryMode = openrouter`, chave OpenRouter e modelo configurado.
3. Backend envia a transcricao ao endpoint `/api/v1/chat/completions` do OpenRouter.
4. Para transcricoes longas, backend divide em partes, resume cada parte e consolida o resultado.
5. Backend persiste `summary` no `store.json` e emite `processing-progress`.

## 11. Riscos e restricoes

- `MediaRecorder` depende das capacidades do WebView2 e da fonte escolhida.
- Captura de audio do sistema pode variar conforme permissao e dispositivo.
- JSON local e simples, mas nao ideal para biblioteca grande.
- Caminhos absolutos para ferramentas e modelos sao configuracao local do usuario.
- Transcricoes longas podem demorar varios minutos em hardware modesto.
- Resumos OpenRouter enviam texto da transcricao para servico externo e dependem de limites, disponibilidade e politicas dos modelos free.

## 12. Roadmap sugerido

### Curto prazo

- Adicionar teste de configuracao local para FFmpeg e Whisper.
- Exibir estimativa de tempo de transcricao com base na duracao do video.
- Melhorar mensagens de erro da transcricao com passos de correcao.
- Exportacao da transcricao em Markdown ou TXT.

### Medio prazo

- Migrar `store.json` para SQLite.
- Adicionar historico de processamento e logs por reuniao.
- Implementar importacao de videos existentes.
- Refinar prompts e avaliacao de qualidade para sumarizacao OpenRouter.
- Adicionar diarizacao ou identificacao manual de participantes.

### Longo prazo

- Integracoes com calendario.
- Integracoes com Notion/Obsidian.
- Sincronizacao opcional.
- Busca semantica local sobre transcricoes.
- Sumarizacao local com modelo leve e configuravel, se houver estrategia de produto e hardware clara.
