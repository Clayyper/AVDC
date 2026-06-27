# AVDC v5.0.6 — Gravação GitHub resiliente

## Motivo

A indexação concluía, mas a gravação dos arquivos técnicos no GitHub podia falhar com erro 502 em `putGithubFile`.

## Ajustes aplicados

- Adicionado retry automático na gravação GitHub para status 502, 503 e 504.
- Reduzido o limite padrão de texto mantido por arquivo na memória de 200.000 para 40.000 caracteres.
- Adicionado limite específico para o texto gravado no `search-index.json`:
  - `AVDC_MAX_SEARCH_TEXT_CHARS`, padrão 12.000 caracteres por arquivo.
  - `AVDC_MAX_SEARCH_INDEX_TOTAL_CHARS`, padrão 4 MB de texto total antes do JSON/base64.
- O catálogo continua listando os arquivos normalmente.
- A busca continua funcionando com trechos de texto, mas o índice salvo fica menor e mais confiável para gravação no GitHub.
- O manifest registra os limites usados na execução.

## Validações

Executado:

```bash
node --check src/routes/index.js
node --check public/app.js
node --check server.js
```

Sem erro de sintaxe.

## Observação

A falha acontecia depois da indexação, durante a etapa de gravação no GitHub. Esta correção não muda a arquitetura: o índice continua sendo salvo no GitHub do usuário, sem persistência de dados do cliente no PostgreSQL.
