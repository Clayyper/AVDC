# AVDC V6.0.6 — Patch de correção

## Base recomendada

Aplicar sobre V6.0.5 ou V6.0.4.

## Objetivo

Corrigir o botão de teste da IA para:

- ficar na parte superior do bloco Motor de IA, junto ao status da conexão;
- testar a conexão usando os dados já salvos no banco para o usuário logado;
- não depender da busca semântica estar marcada;
- não usar os campos soltos da tela como fonte principal do teste.

## Como usar depois de aplicar

1. Preencha Provedor, URL base, Modelo e Chave/token.
2. Clique em “Salvar Motor de IA”.
3. Clique em “Testar conexão da IA salva”.
4. O AVDC testa a configuração persistida para aquele usuário.

## Arquivos incluídos

- server.js
- package.json
- src/db.js
- src/middleware.js
- src/routes/auth.js
- src/routes/admin.js
- src/routes/user.js
- src/routes/github.js
- src/routes/index.js
- src/routes/ai.js
- public/index.html
- public/app.js
- public/style.css
- README.md
- checkpoints/CHECKPOINT_V6_0_6_TESTE_IA_BANCO.md

## Validação recomendada

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
