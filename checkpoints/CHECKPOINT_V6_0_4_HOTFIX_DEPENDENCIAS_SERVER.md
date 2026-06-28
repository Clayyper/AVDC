# AVDC V6.0.4 — Hotfix de dependências do server.js

Correção de empacotamento do patch V6.0.3.

## Problema

No Render, o `server.js` carregava módulos obrigatórios como:

- `./src/db`
- `./src/middleware`
- `./src/routes/auth`
- `./src/routes/admin`
- `./src/routes/user`
- `./src/routes/github`
- `./src/routes/index`
- `./src/routes/ai`

O patch anterior não incluía todos esses arquivos, causando erro `MODULE_NOT_FOUND` quando aplicado sobre uma base incompleta/desatualizada.

## Correção

O patch V6.0.4 passa a incluir explicitamente todos os módulos obrigatórios usados pelo `server.js`.

## Escopo

Não altera a regra funcional da busca semântica.
Não altera a regra do Motor de IA.
É uma correção de pacote/deploy.
