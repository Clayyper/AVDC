# AVDC v5.0.7 — Busca semântica separada

## Escopo aplicado

- Adicionado checkbox `Busca semântica` na tela do catálogo.
- Adicionado aviso de processamento pesado/experimental.
- Mantido o botão `Índice Avançado Consolidado` ativo.
- Adicionada rota `/api/index/prepare-semantic`.
- A rota também aceita `mode: "semantic"` no corpo da requisição.
- Quando a busca semântica é marcada, o AVDC gera `/avdc-index/search-index-semantic.json`.
- O índice simples `/avdc-index/search-index.json` não é substituído durante a geração semântica.
- O resultado da execução continua sendo exibido no mesmo formato da indexação atual.

## Observação técnica

A busca semântica nesta versão fica preparada como índice separado em blocos de texto (`chunked-text-v1`).
Ela ainda não introduz embeddings, IA obrigatória ou nova tela de resultado.

## Validação executada

```bash
node --check public/app.js
node --check server.js
node --check src/routes/index.js
node --check src/routes/github.js
```
