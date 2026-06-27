# PATCH INSTRUCTIONS — AVDC V6.0

Base esperada: último ZIP validado pelo usuário no Render (`AVDC-main.zip`), derivado da v5.0.6, mesmo que alguns metadados apareçam como v5.0.5.

## Como aplicar

1. Faça backup do projeto atual.
2. Extraia este ZIP patch por cima da raiz do projeto AVDC.
3. Confirme que os arquivos abaixo foram substituídos/adicionados.
4. Remova a pasta antiga `/report/` se ela ainda existir na raiz.
5. Use `/checkpoints/` para checkpoints a partir da V6.
6. Faça deploy no Render.

## Arquivos alterados/adicionados

- `package.json`
- `server.js`
- `public/index.html`
- `public/app.js`
- `src/db.js`
- `src/routes/user.js`
- `src/routes/index.js`
- `src/routes/ai.js`
- `checkpoints/`
- `PATCH_INSTRUCTIONS.md`

## O que mudou

- Metadados visíveis atualizados para V6.
- Healthcheck passa a reportar versão `6.0.0`.
- Checkpoints migrados para `/checkpoints/`.
- Nova seção visual `Motor de IA` no painel do usuário.
- IA configurada por usuário, sem prender a OpenAI nem ao `.env` geral.
- Busca simples continua sem IA.
- Nova busca semântica só funciona se o usuário configurar o Motor de IA.
- Se a IA não estiver configurada, a ferramenta mostra aviso claro e não simula busca semântica.

## Migração de banco

A inicialização segura do AVDC adiciona automaticamente, se ainda não existirem, as colunas abaixo em `user_future_config`:

- `ai_provider`
- `ai_base_url`
- `ai_model`
- `ai_token_encrypted`
- `ai_connected_at`

Nenhuma tabela de dados do cliente é criada. Catálogo, índice, manifest, notas e relatório técnico continuam no GitHub do usuário.

## Princípio V6

Busca simples = sem IA.
Busca semântica = IA opcional, explícita, configurada pelo usuário e separada.
