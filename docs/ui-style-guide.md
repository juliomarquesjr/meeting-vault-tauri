# UI Style Guide — Meeting Vault

Este documento e o **Guia de Estilo de UI** do Meeting Vault, tambem chamado de *Design System Documentation* ou *UI Specification*. Ele cobre tokens de design, hierarquia de componentes e estrutura de layout de cada tela.

> **O que e um UI Style Guide?**
> E o equivalente de uma "planta baixa" da interface: documenta as cores, tipografia, espacamentos, componentes visuais e como as telas sao organizadas em grade. Em ferramentas de design como Figma isso aparece como "Design System" ou "Specifications". Para projetos em codigo, vive aqui como referencia viva junto do CSS.

---

## 1. Tokens de Design (CSS Variables)

Definidos em `:root` dentro de `src/styles.css`.

### 1.1 Backgrounds

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#08080e` | Fundo do corpo do app |
| `--surface` | `#0e0e18` | Sidebar, cards de primeiro nivel |
| `--surface-2` | `#131320` | Cards internos, inputs, tiles KPI |
| `--surface-3` | `#191928` | Hover de itens, foco de input |

A hierarquia e de escuro para levemente menos escuro. Nunca use `--bg` como fundo de componentes — ele e apenas o canvas.

### 1.2 Bordas

| Token | Valor | Uso |
|---|---|---|
| `--border` | `#1e1e32` | Bordas de paineis e cards principais |
| `--border-soft` | `rgba(255,255,255,0.05)` | Bordas de elementos internos (tiles, rows) |

### 1.3 Texto

| Token | Valor | Uso |
|---|---|---|
| `--text` | `#e8eaf0` | Texto principal |
| `--muted` | `#888ba8` | Labels, metadados, textos secundarios |
| `--muted-2` | `#50526a` | Placeholders, contexto terciario |

### 1.4 Acento — roxo exclusivo para acao

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#7c3aed` | Botao primario, item ativo, foco, status-line padrao |
| `--accent-hover` | `#6d28d9` | Hover do botao primario |
| `--accent-muted` | `rgba(124,58,237,0.12)` | Fundo do icone KPI padrao |
| `--accent-ring` | `rgba(124,58,237,0.3)` | Focus ring em inputs e selects |

**Regra:** `--accent` nunca e usado como cor de fundo de cards, sidebar ou elementos decorativos. Apenas onde o usuario precisa tomar uma acao ou recebe feedback de selecao.

### 1.5 Cores semanticas

| Token | Valor | Uso |
|---|---|---|
| `--success` | `#10b981` | Transcritas, status completed |
| `--warning` | `#f59e0b` | Em processamento |
| `--danger` | `#ef4444` | Erros, botao de encerrar gravacao, fechar janela |

### 1.6 Outros tokens

| Token | Valor |
|---|---|
| `--control-height` | `38px` |
| `--radius` | `7px` |
| `--frame-gap` | `16px` |
| `--frame-padding` | `16px` |

---

## 2. Tipografia

- **Familia:** Inter (fallback: `ui-sans-serif`, `system-ui`, Segoe UI)
- **Renderizacao:** `-webkit-font-smoothing: antialiased`
- **Base:** `#e8eaf0` sobre `#08080e`

Escalas usadas no app:

| Elemento | Tamanho | Peso | Notas |
|---|---|---|---|
| Titulo de pagina (`h1`) | 26px | 700 | `letter-spacing: -0.01em` |
| Titulo de painel (`h2`) | 16px | 600 | |
| KPI valor principal | 22px | 700 | `letter-spacing: -0.01em` |
| Metrica de pipeline | 15px | 600 | |
| Corpo / texto de item | 13px | 400 | |
| Label de campo | 11px | 500 | `letter-spacing: 0.04em`, maiuscula nao usada |
| Metadado / contexto | 11–12px | 400 | `--muted` ou `--muted-2` |
| Label de navegacao (`nav-group > span`) | 11px | — | uppercase, `letter-spacing: 0.06em` |
| Tempo do player | 11px | — | monospace (Consolas / Cascadia Code) |

---

## 3. Hierarquia de Botoes

Cada nivel de botao tem um proposito especifico. Nao trocar entre eles.

| Classe CSS | Visual | Quando usar |
|---|---|---|
| `.primary-button` | Fundo roxo (`--accent`), texto branco | Unica CTA de cada tela: Iniciar gravacao, Transcrever, Salvar configuracoes |
| `.secondary-button` | Fundo `--surface-2`, borda `--border`, texto `--muted` | Acoes neutras: Qualidade, Ver todas, Gerenciar, Biblioteca |
| `.icon-button` | 36x36px, borda, sem texto | Acoes de icone: Assistir, Pasta, Refresh, Excluir |
| `.text-button` | Transparente, texto `--muted` | Acoes terciarias: Retranscrever |

Modificadores:
- `.primary-button.danger` — fundo `#b91c1c` (Finalizar gravacao, exclusao confirmada)
- `.primary-button.compact` — `min-width: 0`, padding reduzido
- `.icon-button.danger` — hover com borda e texto vermelho (Excluir reuniao)

---

## 4. Inputs e Selects

Todos herdam os estilos globais de `src/styles.css`.

- Altura: `36px`
- Fundo: `--surface-2`
- Borda: `1px solid --border`
- Hover: borda `rgba(255,255,255,0.12)`
- Foco: borda `rgba(124,58,237,0.55)` + box-shadow ring `--accent-ring` + fundo `--surface-3`
- Placeholder: `--muted-2`, `12.5px`

Select usa `appearance: none` com seta SVG customizada (chevron na cor `--muted`).

Number inputs nao exibem spinners.

---

## 5. Tags (Badge Input)

Tags sao renderizadas como badges removiveis dentro de um container de input.

```
.tags-input-container
  .tag-badge           ← pill com "#tag" e botao X
  input                ← campo invisivel ao lado dos badges
```

Estado desabilitado: `.tags-input-disabled` remove o cursor e opacidade do container.

---

## 6. Shell do App

```
┌─────────────────────────────────────────────────────────────────────┐
│ .chrome-bar (38px)                      [_ □ X] .window-controls   │
├──────────────────┬──────────────────────────────────────────────────┤
│ .sidebar (272px) │ .main-region                                     │
│                  │  .content-header (auto)                          │
│  .brand-block    │  .notice (auto, opcional)                        │
│  .nav-groups     │  .content-body (minmax(0,1fr), overflow auto)    │
│    .nav-group    │    <view atual>                                   │
│                  │                                                   │
└──────────────────┴───────────────────────────────────────────────────┘
```

- Grid: `272px | 1fr`
- `.main-region` usa `grid-template-rows: 38px auto auto minmax(0,1fr)`
- `.content-body` recebe a classe `.content-body--library` na view Biblioteca, que muda para `overflow: hidden` e delega o scroll aos paineis internos

---

## 7. Dashboard

O tipo de documentacao que descreve o posicionamento dos elementos em uma tela e chamado de **Layout Specification** ou **Screen Specification**. O diagrama abaixo e a especificacao de layout do Dashboard.

```
┌──────────────────────────────────────────────────────────────────┐
│ ZONA 1 — KPI ROW (.kpi-row, grid 4 colunas)                      │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ [icone roxo] │ │ [icone cinza]│ │ [icone verde]│ │[ic. cinz]│ │
│ │ Reunioes     │ │ Tempo total  │ │ Transcritas  │ │ Storage  │ │
│ │ 12           │ │ 4h 32m       │ │ 9            │ │ 1.2 GB   │ │
│ │ 9 transcritas│ │ media 23m/r  │ │ 75% do total │ │ fila vazia│ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ ZONA 2 — MAIN ROW (.dash-main-row, grid 1.1fr | 0.9fr)          │
│ ┌────────────────────────────────┐ ┌────────────────────────────┐│
│ │ Nova gravacao  [● 1080p] [Qual]│ │ Reunioes recentes [Ver todas││
│ │ Titulo      | Categoria        │ │ ● Reuniao Semanal     7:28 ││
│ │ [          ] | [        ▼]     │ │ ● Reuniao 13/05       0:11 ││
│ │ Tags                           │ │                            ││
│ │ [#tag1] [#tag2] [add...]       │ │ (lista com scroll proprio) ││
│ │ [ Iniciar gravacao ]           │ │                            ││
│ └────────────────────────────────┘ └────────────────────────────┘│
├──────────────────────────────────────────────────────────────────┤
│ ZONA 3 — FOOTER ROW (.dash-footer-row, grid 1fr | 1fr)          │
│ ┌────────────────────────────────┐ ┌────────────────────────────┐│
│ │ Estado da biblioteca      [|||]│ │ Organizacao    [Gerenciar] ││
│ │ ✓ Transcritas     9  ⟳ Process.0│ │ ≡ 6  Categorias            ││
│ │ ⚠ Com erro        1  ⌚ Duracao  │ │ # 2  Tags                  ││
│ │                   23:50        │ │ #sprint #q2 #produto       ││
│ └────────────────────────────────┘ └────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Classes relevantes

| Classe | Responsabilidade |
|---|---|
| `.kpi-row` | Grid 4 colunas para tiles de metrica |
| `.kpi-tile` | Tile individual: `flex row` com icone + body |
| `.kpi-icon` | Box 40x40px com cor semantica de fundo |
| `.kpi-body` | Grid de 3 linhas: label / valor / contexto |
| `.dash-main-row` | Grid 1.1fr / 0.9fr, `align-items: stretch` |
| `.dash-footer-row` | Grid 1fr / 1fr, `align-items: stretch` |
| `.dashboard-frame` | Flex coluna, painel principal de cada zona |
| `.recent-frame` | Extende `dashboard-frame` com lista com scroll |
| `.dash-rec-form` | Formulario inline de gravacao (sem wrapper duplo) |
| `.dash-rec-row` | Grid 1.6fr / 1fr para Titulo e Categoria |

---

## 8. Biblioteca

```
┌──────────────────────────────────────────────────────────────────┐
│ LIBRARY VIEW (.library-view, grid 0.9fr | 1.1fr)                │
│ ┌───────────────────────┐ ┌────────────────────────────────────┐ │
│ │ PAINEL ESQUERDO       │ │ DETALHE DA REUNIAO                 │ │
│ │ .library-panel        │ │ .detail-workspace                  │ │
│ │                       │ │                                    │ │
│ │ [🔍 Buscar...       ] │ │ .detail-header                     │ │
│ │ [Categoria ▼][Tag ▼][↺]│ │   .detail-title-input             │ │
│ │ ─────────────────── │ │   .detail-action-bar               │ │
│ │ ● Reuniao A   07:28  │ │     [Salvar] [▶] [📁] [🗑]         │ │
│ │ ● Reuniao B   00:11  │ │                                    │ │
│ │ ● Reuniao C   01:40  │ │ .detail-fields                     │ │
│ │                       │ │   Categoria | Tags (badges)        │ │
│ │ (scroll proprio)      │ │                                    │ │
│ │                       │ │ .detail-meta                       │ │
│ │                       │ │   📅 data · ⏱ duracao · 💾 tam    │ │
│ │                       │ │                                    │ │
│ │                       │ │ .player-section                    │ │
│ │                       │ │   .video-wrapper                   │ │
│ │                       │ │     <video>                        │ │
│ │                       │ │     .play-overlay (quando pausado) │ │
│ │                       │ │   .player-controls                 │ │
│ │                       │ │     [▶] 0:00 ────●──── 7:28 [🔊] [⛶]│ │
│ │                       │ │                                    │ │
│ │                       │ │ .content-actions                   │ │
│ │                       │ │   [Transcricao] [Resumo]           │ │
│ └───────────────────────┘ └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Player de video

O player e totalmente customizado. Nao usa `<video controls>`.

```
.player-section
  .video-wrapper (position: relative)
    <video> (cursor: pointer, toggle play/pause no click)
    .play-overlay (position: absolute, visivel apenas quando pausado)
  .player-controls (flex row)
    .player-btn  ← play/pause
    .player-time ← tempo atual (monospace)
    .player-scrubber ← input[type=range] com gradiente dinamico
    .player-time ← duracao total
    .player-btn  ← mute/unmute
    .player-btn  ← fullscreen
```

### Secao de transcricao — 3 estados

| Estado | Componente | Conteudo |
|---|---|---|
| Cards de acao | `.content-actions` | Grid com cards para Transcricao e Resumo |
| Card individual | `.content-action-card` | Estado do conteudo + botao Abrir/Gerar/Transcrever |
| Processando | `.content-processing` | Mensagem + barra de progresso (`.progress-track`) |
| Modal | `.content-modal` | Leitura de transcricao ou resumo em overlay dedicado |
| Texto do modal | `.content-modal-text` | Texto scrollavel com `white-space: pre-wrap` |

### Resumo

O detalhe da biblioteca inclui card de resumo ao lado do card de transcricao:

```
.content-actions
  .content-processing?
  .content-action-card (Transcricao)
  .content-action-card (Resumo)
.content-modal-backdrop
  .content-modal
    .content-modal-header
    .content-modal-text
```

- `.content-action-card` usa `secondary-button compact` para "Abrir" e "Gerar".
- `.content-modal` e usado para ler transcricao e resumo sem ocupar altura permanente no detalhe.
- O roxo permanece restrito ao foco/status/CTA principal; o resumo usa acao secundaria porque depende de servico externo opcional.

## 9. Telas de Configuracao

- `Transcricao`: concentra Whisper, FFmpeg, modo local/API/hibrido, idioma, OpenAI API key e transcricao automatica.
- `Resumo`: tela separada para `Desativado` ou `OpenRouter`, chave OpenRouter e ID do modelo. Nao deve conter controles de Whisper ou transcricao.

---

## 9. Navegacao lateral (Sidebar)

```
.sidebar
  .brand-block          ← logo + nome do app
  .nav-groups
    .nav-group
      span              ← label da secao (ex: "PRINCIPAL")
      button            ← item de navegacao
      button.active     ← item ativo: border-left 2px solid --accent + bg surface-2
```

Item ativo nunca usa fundo roxo solido — apenas `border-left` + `--surface-2`.

---

## 10. Status Line

Barra vertical colorida de 3px usada em itens de lista para indicar estado da reuniao.

| Valor `data-status` | Cor |
|---|---|
| `recorded` (padrao) | `--accent` (roxo) |
| `completed` | `--success` (verde) |
| `processing` | `--warning` (amarelo) |
| `error` | `--danger` (vermelho) |

---

## 11. Regras de Consistencia

- **Nunca** usar `--accent` como fundo de cards, paineis ou sidebar ativa.
- **Nunca** usar `.primary-button` para mais de uma acao por tela.
- Todos os paineis do mesmo `.dash-main-row` ou `.dash-footer-row` devem ter a mesma altura (`align-items: stretch`).
- Formularios usam `label > span + input/select` com o `span` recebendo `font-size: 11px; font-weight: 500`.
- O player nao usa controles nativos do browser (`<video controls>`).
- O icone da bandeja e gerado programaticamente em Rust (circulo RGBA 32x32) — nao ha arquivo PNG externo.
