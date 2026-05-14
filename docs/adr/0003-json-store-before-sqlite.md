# ADR 0003: Usar store JSON local antes de SQLite

## Status

Aceita para fase atual.

## Contexto

O produto esta em fase inicial e precisa persistir metadados, configuracoes e referencias para videos locais. O volume de dados ainda e limitado e a prioridade e validar fluxo de gravacao, biblioteca e processamento.

## Decisao

Persistir um `Store` unico em JSON no diretorio de dados do app. Videos ficam fora do JSON, em `recordings/`, referenciados por caminho.

## Consequencias positivas

- Implementacao simples.
- Facil inspecionar e recuperar dados manualmente.
- Baixo overhead para o prototipo funcional.

## Consequencias negativas

- Nao escala bem para bibliotecas grandes.
- Busca e filtros dependem de carregar tudo em memoria.
- Escritas concorrentes exigem cuidado.
- Migracoes futuras precisam ser planejadas.

## Criterios para migrar

Migrar para SQLite quando houver:

- Centenas ou milhares de reunioes.
- Busca full-text sobre transcricoes.
- Historico de processamento por reuniao.
- Relacionamentos com participantes, calendario e integracoes.
- Necessidade de consultas incrementais.
