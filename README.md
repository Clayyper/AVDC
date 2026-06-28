# AVDC V6.0.17

Hotfix arquitetural: índice semântico separado.

## Premissa consolidada

O diretório técnico continua sendo:

- `/avdc-index/`

Mas os índices ficam separados:

- `/avdc-index/catalog.json` — catálogo/listagem.
- `/avdc-index/search-index.json` — busca simples.
- `/avdc-index/semantic-index.json` — busca semântica.
- `/avdc-index/manifest.json` — manifesto técnico.

## Correção

A rota de geração do catálogo agora grava também `/avdc-index/semantic-index.json`.

A rota `/search-semantic` deixa de usar `search-index.json` e passa a usar o índice semântico separado.

## Ação obrigatória após deploy

Depois de subir a V6.0.17, clique em **Criar catálogo do índice** para regenerar os arquivos no GitHub.

Sem essa regeneração, a busca semântica pode retornar `SEMANTIC_INDEX_NOT_FOUND` ou `EMPTY_SEMANTIC_INDEX`.
