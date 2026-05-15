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

- Gravar tela e audio.
- Salvar video compactado localmente.
- Editar titulo da reuniao, categoria e tags.
- Busca por titulo, tags e transcricao.
- Transcricao local com Whisper ou via API.
- Tray do Windows.
- Progresso visivel durante transcricao.

## Funcionalidades diferidas

- Resumo executivo com acoes e decisoes — disponivel apenas via OpenRouter opt-in, em tela separada de resumo; llama.cpp continua removido, ver [[../docs/adr/0005-remove-summarization|ADR 0005]] e [[../docs/adr/0006-openrouter-summary|ADR 0006]].
- Identificacao de participantes e diarizacao.
- Integracoes reais com calendario, Notion e CRM.

## Referencias competitivas

Veja [Pesquisa de produto](../docs/product-research.md). As referencias principais foram Otter.ai, Fireflies.ai, Fathom, Loom e OBS.
