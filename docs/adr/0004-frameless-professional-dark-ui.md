# ADR 0004: UI profissional dark mode com janela sem decoracao nativa

## Status

Aceita. Design system consolidado.

## Contexto

O layout inicial foi considerado infantil e insuficiente para um produto profissional. O usuario pediu uma reformulacao completa, sem barra de titulo nativa do Windows, com separacao clara entre configuracoes, biblioteca, categorias/tags, video/qualidade e integracoes.

Em uma segunda fase, o sistema de cores foi refinado: o roxo estava sendo aplicado em fundos de cards e botoes secundarios, diluindo o impacto visual. A paleta foi redefinida para usar roxo exclusivamente como acento de acao (CTAs, foco, selecao).

## Decisao

Adotar uma UI dark mode profissional com as seguintes definicoes permanentes:

**Estrutura:**
- Sidebar agrupada por operacao, organizacao e sistema.
- Janela Tauri sem decoracao nativa (`decorations: false`).
- Chrome bar customizado com controles de janela (minimizar, maximizar, ocultar).
- Fechamento da janela oculta o app — ele continua no tray.

**Sistema de cores:**
- Paleta escura em quatro camadas: `--bg`, `--surface`, `--surface-2`, `--surface-3`.
- `--accent` (#7c3aed) reservado exclusivamente para CTAs, item ativo na sidebar (borda esquerda), foco de input e status-line padrao. Nunca como fundo decorativo.
- Cores semanticas separadas: `--success` (verde), `--warning` (amarelo), `--danger` (vermelho).

**Componentes:**
- Hierarquia de quatro botoes: `primary-button`, `secondary-button`, `icon-button`, `text-button`.
- Player de video totalmente customizado, sem controles nativos do browser.
- Tags como badges removiveis com campo de input inline.
- Icone da bandeja gerado programaticamente em Rust (sem arquivo PNG externo).

**Layout do Dashboard:**
- Tres zonas verticais: KPI tiles / painel principal (gravacao + recentes) / rodape (pipeline + taxonomia).
- `align-items: stretch` em todas as linhas para garantir altura uniforme entre paineis.

A especificacao completa de tokens, componentes e layouts esta em `docs/ui-style-guide.md`.

## Consequencias positivas

- Aparencia alinhada a ferramentas SaaS/desktop profissionais.
- Roxo como acento exclusivo: alto impacto onde importa, sem "poluicao visual".
- Design system documentado e replicavel para novos componentes.
- Controle visual completo sobre o chrome da janela.
- Player e tray sem dependencias de arquivos externos.

## Consequencias negativas

- Controles de janela precisam ser mantidos manualmente (sem suporte a drag nativo em toda a area).
- Acessibilidade da janela customizada deve ser validada (foco de teclado nos controles de janela).
- Layout responsivo requer QA visual ao adicionar novas views ou componentes.
