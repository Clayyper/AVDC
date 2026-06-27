# CHECK REPORT — AVDC v5.0.5

## Alteração principal

Implementada validação para impedir que repositórios técnicos/de índice do AVDC sejam selecionados como repositório de dados.

## Regra aplicada

- Repositório com nome técnico/reservado pode ser usado como repositório de índice.
- Repositório com nome técnico/reservado não pode ser usado como fonte de dados.
- A validação existe no front-end e também no back-end.

## Exemplos bloqueados como dados

- avdc-index
- avdc_indice
- indice-avdc
- index-avdc
- avdc-catalog
- avdc-search-index
- avdc-reports
- avdc-relatorios

## Mensagem de bloqueio

Este repositório parece ser técnico/de índice do AVDC. Ele pode ser usado como repositório de índice, mas não como fonte de dados. Escolha um repositório de dados original.

## Validações executadas

- node --check public/app.js
- node --check server.js
- node --check src/routes/index.js
- node --check src/routes/github.js

## Observação

Não foi alterado o comportamento do índice, catálogo, relatório técnico TXT ou busca.
