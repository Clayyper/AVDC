# CHECKPOINT AVDC V6.0.1 — Hotfix rotas obrigatórias no patch

Correção aplicada após erro no Render:

```txt
Error: Cannot find module './src/routes/auth'
Require stack:
- /opt/render/project/src/server.js
```

## Causa

O `server.js` da V6 referencia rotas já existentes na base oficial:

- `src/routes/auth.js`
- `src/routes/admin.js`
- `src/routes/user.js`
- `src/routes/github.js`
- `src/routes/index.js`
- `src/routes/ai.js`

O ZIP patch anterior não incluía todos os arquivos de rota obrigatórios, então uma aplicação feita sobre uma base incompleta ou divergente podia subir o `server.js` novo sem levar junto a rota `auth.js`.

## Correção

A partir deste hotfix, o patch inclui explicitamente:

- `server.js`
- `package.json`
- `src/db.js`
- `src/middleware.js`
- todas as rotas em `src/routes/*.js`
- arquivos públicos alterados
- checkpoints em `/checkpoints/`

## Regra reforçada

Mesmo usando ZIP patch, todo arquivo referenciado diretamente por `server.js` deve estar presente no patch quando houver risco de base divergente.
