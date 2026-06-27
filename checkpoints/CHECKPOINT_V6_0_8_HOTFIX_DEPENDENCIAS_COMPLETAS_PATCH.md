# AVDC V6.0.8 — Hotfix dependências completas no patch

## Motivo

O Render retornou erro no start:

```txt
Error: Cannot find module './src/db'
Require stack:
- /opt/render/project/src/server.js
```

Isso indicou que o `server.js` publicado exigia módulos que não estavam presentes no deploy aplicado via patch.

## Correção

O patch V6.0.8 passa a incluir explicitamente todos os arquivos obrigatórios para o `server.js` iniciar:

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

## Regras preservadas

- Teste de conexão da IA continua validado e usa dados salvos no banco do usuário.
- Busca semântica continua antes do catálogo inicial do índice.
- Checkbox de busca semântica continua separando fluxo semântico do fluxo simples.
- IA continua opcional e configurada por usuário.

## Observação

Esta é uma correção de deploy/empacotamento, não uma mudança funcional de produto.
