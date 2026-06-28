# CHECKPOINT V6.0.17 — Índice semântico separado

## Decisão arquitetural

A busca semântica não deve usar diretamente `/avdc-index/search-index.json`, que é o índice da busca simples.

## Regra consolidada

Mesmo diretório técnico:

- `/avdc-index/`

Arquivos separados:

- `/avdc-index/catalog.json` — catálogo/listagem.
- `/avdc-index/search-index.json` — busca simples.
- `/avdc-index/semantic-index.json` — busca semântica.
- `/avdc-index/manifest.json` — manifesto.

## Correção

A geração do catálogo agora grava também `/avdc-index/semantic-index.json`.
A rota `/search-semantic` passa a ler o índice semântico separado.

## Validação esperada

Após subir a versão, clicar em “Criar catálogo do índice” para regenerar os arquivos técnicos.
Sem essa regeneração, a busca semântica deve retornar `SEMANTIC_INDEX_NOT_FOUND` ou `EMPTY_SEMANTIC_INDEX` com orientação clara.
