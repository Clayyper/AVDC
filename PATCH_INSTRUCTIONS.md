# AVDC V6.0.1 — Instruções do patch

Este patch deve ser aplicado sobre o último ZIP validado pelo usuário no Render.

## Objetivo

Subir a V6 inicial com IA genérica configurada pelo usuário e corrigir o erro de deploy em que o `server.js` referenciava `./src/routes/auth`, mas o patch anterior podia não levar essa rota junto.

## Como aplicar

1. Faça backup do projeto atual.
2. Extraia este ZIP patch na raiz do projeto, sobrescrevendo arquivos existentes.
3. Confirme que existem estes arquivos:

```txt
server.js
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
package.json
```

4. Faça novo deploy no Render.

## Validação local recomendada

```bash
node --check server.js
node --check src/db.js
node --check src/middleware.js
node --check src/routes/auth.js
node --check src/routes/admin.js
node --check src/routes/user.js
node --check src/routes/github.js
node --check src/routes/index.js
node --check src/routes/ai.js
node --check public/app.js
```

## Observação

A IA continua opcional e configurada por usuário. A busca simples não depende de IA. A busca semântica só deve ser habilitada quando o usuário tiver uma configuração de IA válida.
