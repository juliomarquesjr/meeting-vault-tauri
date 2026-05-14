# ADR 0004: UI profissional dark mode com janela sem decoracao nativa

## Status

Aceita.

## Contexto

O layout inicial foi considerado infantil e insuficiente para um produto profissional. O usuario pediu uma reformulacao completa, sem barra de titulo nativa do Windows, com separacao clara entre configuracoes, biblioteca, categorias/tags, video/qualidade e integracoes.

## Decisao

Adotar uma UI dark mode profissional com:

- Sidebar agrupada por operacao, organizacao e sistema.
- Janela Tauri sem decoracao nativa.
- Header customizado com controles de janela.
- Dashboard com resumo operacional, captura e reunioes recentes.
- Paineis consistentes, botoes padronizados e linguagem visual roxa.

## Consequencias positivas

- Aparencia mais alinhada a ferramentas SaaS/desktop profissionais.
- Melhor organizacao de funcionalidades.
- Espaco claro para evolucao do produto.
- Controle visual completo sobre chrome da janela.

## Consequencias negativas

- Controles de janela precisam ser mantidos manualmente.
- Acessibilidade de janela customizada deve ser validada.
- Layout responsivo precisa de QA visual recorrente.
