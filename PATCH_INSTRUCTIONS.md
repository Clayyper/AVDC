# AVDC V6.0.8 — Patch hotfix Render / dependências completas

## Objetivo

Corrigir erro de deploy no Render:

```txt
Error: Cannot find module './src/db'
Require stack:
- /opt/render/project/src/server.js
```

## Causa

O `server.js` da V6 exige módulos como `src/db.js`, `src/middleware.js` e rotas em `src/routes/`.
Quando um patch parcial é aplicado sobre uma base antiga/incompleta, esses arquivos podem não existir no repositório publicado.

## Correção

Este patch inclui todos os arquivos necessários para o start do servidor, não apenas os arquivos visualmente alterados.

## Arquivos incluídos

- `server.js`
- `package.json`
- `src/db.js`
- `src/middleware.js`
- `src/routes/auth.js`
- `src/routes/admin.js`
- `src/routes/user.js`
- `src/routes/github.js`
- `src/routes/index.js`
- `src/routes/ai.js`
- `public/index.html`
- `public/app.js`
- `public/style.css`
- `README.md`
- `PATCH_INSTRUCTIONS.md`
- `checkpoints/CHECKPOINT_V6_0_8_HOTFIX_DEPENDENCIAS_COMPLETAS_PATCH.md`

## Como aplicar

Copie o conteúdo deste patch sobre o repositório atual, preservando as mesmas pastas.

Depois faça commit/push e redeploy no Render.

## Regra preservada

Esta versão não altera a lógica validada da V6.0.7.
Ela apenas garante que o deploy tenha todos os módulos exigidos pelo `server.js`.
