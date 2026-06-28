# PATCH AVDC V6.0.18 — Índice semântico sob demanda

## Objetivo

Corrigir a premissa da busca semântica:

> O índice semântico é separado e deve ser criado na hora da busca quando não existir ou estiver vazio.

## Aplicação

Copie os arquivos do patch sobre a base V6.0.17 ou suba o projeto completo V6.0.18.

## Arquivos alterados

- `package.json`
- `server.js`
- `src/routes/index.js`
- `public/index.html`
- `public/app.js`
- `README.md`
- `PATCH_INSTRUCTIONS.md`
- `checkpoints/CHECKPOINT_V6_0_18_SEMANTIC_INDEX_ON_DEMAND.md`

## Mudança principal

Antes:

- Busca semântica exigia `/avdc-index/semantic-index.json` já criado.
- Se não existisse, mostrava aviso para criar catálogo.

Depois:

- Busca semântica verifica `/avdc-index/semantic-index.json`.
- Se não existir ou estiver vazio, cria automaticamente o índice semântico.
- Depois pesquisa no índice recém-criado.

## Arquivos técnicos mantidos separados

- Busca simples: `/avdc-index/search-index.json`
- Busca semântica: `/avdc-index/semantic-index.json`
- Catálogo: `/avdc-index/catalog.json`

## Validação sugerida

1. Subir V6.0.18.
2. Apagar ou não gerar `/avdc-index/semantic-index.json`.
3. Marcar busca semântica.
4. Pesquisar um termo.
5. Confirmar que o AVDC cria `/avdc-index/semantic-index.json` e depois executa a busca.
