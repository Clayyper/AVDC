# AVDC V6.0.4 — Patch de correção

## Objetivo

Corrigir erro de deploy no Render:

```txt
Error: Cannot find module './src/db'
Require stack:
- /opt/render/project/src/server.js
```

## Causa

O `server.js` da V6 depende de módulos em `src/`, mas o patch anterior não levou todos os arquivos obrigatórios quando aplicado sobre uma base que não tinha esses módulos.

## Como aplicar

Copie o conteúdo deste patch sobre a raiz do projeto AVDC, sobrescrevendo arquivos existentes.

O patch deve ficar assim na raiz:

```txt
server.js
package.json
src/db.js
src/middleware.js
src/routes/auth.js
src/routes/admin.js
src/routes/user.js
src/routes/github.js
src/routes/index.js
src/routes/ai.js
public/index.html
public/app.js
public/style.css
checkpoints/...
```

Depois suba novamente no Render.

## Observação

Esta versão não muda o conceito funcional da V6.0.3. É um hotfix de empacotamento/dependências para o deploy.
