# Product Context

## Problema

O usuario precisa registrar reunioes, manter videos acessiveis e transformar conteudo gravado em transcricao pesquisavel localmente.

## Direcao de produto

Meeting Vault deve parecer uma ferramenta profissional de operacao, nao um MVP simples. O app deve ter uma dashboard informativa, biblioteca organizada, configuracoes claras e base tecnica para integracoes futuras.

## Principios

- Local-first por padrao.
- Privacidade e controle do usuario.
- UI escura, profissional e consistente.
- Configuracao explicita de ferramentas locais.
- Biblioteca como centro do produto.
- Integracoes sao extensoes futuras, nao dependencia inicial.

## Funcionalidades atuais

- Gravar tela e audio (chunks streamados diretamente ao disco via IPC — sem acumulo em memoria, suporta gravacoes longas).
- Capturar audio do microfone em paralelo ao audio do sistema, com mixagem via AudioContext. Configuravel nas settings; fallback silencioso se permissao negada.
- Detectar automaticamente reunioes Google Meet abertas no Chrome via polling de titulo de janela Win32 (a cada 3s). Exibe popup flutuante always-on-top no canto inferior direito com countdown de 15s, pre-preenchendo o titulo da gravacao. Desativavel nas settings.
- Salvar video compactado localmente.
- Editar titulo da reuniao, categoria e tags.
- Busca por titulo, tags e transcricao.
- Transcricao local com Whisper (saida JSON com timestamps por segmento) ou via API.
- Diarizacao local opt-in via pyannote.audio — identifica falantes (Falante A, B...) e segmenta o transcript com timestamps. Requer Python + modelo HuggingFace (~2GB) e tem diagnostico separado para Python, pyannote.audio e cache do modelo.
- Tray do Windows.
- Progresso visivel durante transcricao.
- Publicar gravacao no YouTube com titulo, descricao e visibilidade — via OAuth 2.0 e YouTube Data API v3. Link do video salvo na reuniao.
- Apagar arquivo local apos publicacao no YouTube (opcional, confirmacao em modal).

## Integracoes

- **YouTube** — implementada: OAuth 2.0, upload via Resumable Upload API, link salvo no Meeting. Usuario configura Client ID e Client Secret em Integracoes → YouTube → Configurar.
- **Notion** — planejada: card visivel na tela de Integracoes, sem implementacao.

## Funcionalidades diferidas

- Resumo executivo com acoes e decisoes — disponivel apenas via OpenRouter opt-in, em tela separada de resumo; llama.cpp continua removido, ver [[../docs/adr/0005-remove-summarization|ADR 0005]] e [[../docs/adr/0006-openrouter-summary|ADR 0006]].
- Renomeacao manual de falantes (Falante A → nome real) apos diarizacao.
- Integracoes reais com calendario e CRM.

## Referencias competitivas

Veja [Pesquisa de produto](../docs/product-research.md). As referencias principais foram Otter.ai, Fireflies.ai, Fathom, Loom e OBS.
