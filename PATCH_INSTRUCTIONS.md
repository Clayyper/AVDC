# PATCH AVDC V6.0.17 — Índice semântico separado

## Objetivo

Restaurar a premissa arquitetural da V6:

- busca simples usa índice simples;
- busca semântica usa índice semântico separado;
- ambos ficam no mesmo diretório técnico `/avdc-index/`.

## Arquivos técnicos gerados no GitHub do usuário

- `/avdc-index/catalog.json`
- `/avdc-index/search-index.json`
- `/avdc-index/semantic-index.json`
- `/avdc-index/manifest.json`
- `/avdc-index/extraction-report.txt`, quando relatório técnico for marcado

## Arquivos alterados no patch

- `package.json`
- `server.js`
- `public/index.html`
- `public/app.js`
- `src/routes/index.js`
- `README.md`
- `PATCH_INSTRUCTIONS.md`
- `checkpoints/CHECKPOINT_V6_0_17_INDICE_SEMANTICO_SEPARADO.md`

## Depois de aplicar

1. Subir o deploy.
2. Entrar no AVDC.
3. Clicar em **Criar catálogo do índice**.
4. Confirmar no GitHub se foi criado:
   - `/avdc-index/semantic-index.json`
5. Testar a busca semântica novamente.

## Observação

Apenas subir o código não cria o novo arquivo semântico no GitHub. É obrigatório regenerar o índice.
