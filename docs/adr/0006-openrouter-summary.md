# ADR 0006: Resumo de transcricoes via OpenRouter

## Status

Aceita — 2026-05-15

## Contexto

O resumo com llama.cpp foi removido no ADR 0005 por aumentar muito a superficie de configuracao, exigir modelo local grande e criar falhas em maquinas com pouco hardware. Ainda assim, o produto precisa oferecer uma forma pratica de resumir transcricoes ja geradas.

OpenRouter permite usar uma unica chave e trocar o modelo apenas pelo ID, inclusive modelos free. Isso atende a necessidade atual de experimentar LLMs sem fixar um provedor unico nem reintroduzir dependencia local pesada.

## Decisao

Reintroduzir resumo apenas como recurso opcional, sob demanda, usando OpenRouter.

- As opcoes de resumo sao somente `Desativado` e `OpenRouter`.
- O usuario configura `OpenRouter API key` e `Modelo OpenRouter`.
- O comando de backend e separado: `summarize_meeting(id)`.
- A transcricao e enviada ao OpenRouter somente quando o usuario aciona o resumo.
- O resultado e salvo no campo `summary` da reuniao.
- Transcricoes longas podem ser divididas em partes e consolidadas.

## Consequencias

- O produto continua local-first por padrao, pois resumo fica desativado ate configuracao explicita.
- A qualidade e disponibilidade dependem do modelo OpenRouter escolhido e dos limites do plano/free tier.
- API keys continuam sendo configuracao local do usuario e nao devem ser versionadas.
- O resumo local com llama.cpp permanece fora do escopo.
