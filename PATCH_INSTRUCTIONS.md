# AVDC V6.0.10 — Hotfix deploy Render + tokens da busca semântica

Este patch corrige o erro de deploy:

```txt
Error: Cannot find module './src/db'
```

## Causa

O `server.js` chama `./src/db`, mas o patch anterior aplicado no Render não levou `src/db.js`.

## Correção

Este patch inclui todos os arquivos obrigatórios para o `server.js` iniciar:

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

Também preserva a correção da V6.0.9:

- compactação da busca semântica;
- limite de candidatos enviados à IA;
- tratamento de erro de TPM/tokens.

## Recomendação

Se o Render já está com base incompleta, prefira subir o ZIP completo `AVDC-main-V6.0.10.zip`.
