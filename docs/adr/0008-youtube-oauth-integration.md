# ADR 0008: Integracao YouTube via OAuth 2.0 Installed App + Resumable Upload API

**Data:** 2026-05-15
**Status:** Aceito

## Contexto

O usuario precisava publicar gravacoes de reunioes diretamente no YouTube a partir do app, sem sair da interface. O YouTube nao permite upload via API com chave simples — exige OAuth 2.0 com escopo `youtube.upload`. O app e desktop e nao tem backend web para receber o callback OAuth.

## Decisao

### Autenticacao — OAuth 2.0 Installed App flow

- O usuario cria um projeto no Google Cloud Console, ativa YouTube Data API v3 e gera credencial OAuth do tipo "App de desktop". Client ID e Client Secret sao configurados em Integracoes → YouTube.
- O backend abre `TcpListener::bind("127.0.0.1:8765")` em uma thread separada antes de abrir o browser.
- O browser e aberto via `cmd /c start <auth_url>` com `access_type=offline` e `prompt=consent` para obter refresh token.
- O listener captura o `?code=` do redirect HTTP GET, responde com HTML "Pode fechar esta aba" e envia o code via `mpsc::channel`.
- O channel usa `recv_timeout(120s)` — se o usuario abandonar o fluxo, o comando falha graciosamente.
- O backend troca o code por `access_token` + `refresh_token` via `POST https://oauth2.googleapis.com/token`.
- Tokens sao persistidos em `store.youtube_tokens` (nunca logados, nunca versionados). O evento `youtube-connected` e emitido para o frontend.

### Upload — YouTube Resumable Upload API

- `upload_to_youtube` valida que o arquivo existe e que ha refresh token.
- Token e renovado se `expires_at` estiver proximo (verificacao por `i64` Unix timestamp).
- Sessao de upload iniciada com `POST .../videos?uploadType=resumable&part=snippet,status` com metadados JSON e headers `X-Upload-Content-Type` / `X-Upload-Content-Length`.
- Upload em chunks de 8 MB com `tokio::fs::File` — sem carregar o arquivo inteiro em memoria.
- Resposta 308 = proximo chunk; 200/201 = concluido. Video ID extraido da resposta final.
- `processing-progress` emitido a cada chunk (5%–95%) para feedback visual na UI.

### Componente

`IntegrationsView` e autonomo: chama `invoke` diretamente para `save_settings`, `connect_youtube` e `disconnect_youtube`. Isso e uma excecao ao padrao de passar callbacks pelo `App.tsx`, justificada porque o estado de credenciais e local ao componente e o fluxo OAuth exige sequencia atomica de salvar + conectar.

## Consequencias

- **Publicacao integrada:** o usuario publica sem sair do app, com titulo, descricao, privacidade e opcao de apagar o arquivo local.
- **Prereq do usuario:** requer conta Google Cloud e configuracao manual de Client ID/Secret — nao ha credenciais embutidas no app.
- **Porta 8765:** assume que esta porta esta livre. Conflito de porta faria o OAuth falhar com mensagem de erro.
- **Token refresh:** feito antes de cada upload. Se o refresh token for revogado pelo usuario no Google, o status mostra desconectado e o usuario precisa reconectar.
- **Seguranca dos tokens:** armazenados apenas em `store.json` local; nunca logados, nunca enviados a servidores proprios.
- **Notion e outras integracoes:** o mesmo padrao de `IntegrationsView` pode ser extendido para futuras integracoes.
