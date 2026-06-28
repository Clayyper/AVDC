# CHECKPOINT V6.0.16 — Hotfix search-index vazio

Diagnóstico validado pelo Rini:

- A lógica da busca semântica estava operacional.
- O resultado zerava porque `/avdc-index/search-index.json` existia, mas vinha com `files: []`.
- O fallback não tinha arquivos para processar.

Correção:

- O índice de busca agora inclui metadados mínimos de arquivos quando o conteúdo não puder ser extraído.
- A busca valida explicitamente `EMPTY_SEARCH_INDEX`.
- Após aplicar, é necessário recriar o catálogo/índice para sobrescrever o JSON antigo no GitHub.
