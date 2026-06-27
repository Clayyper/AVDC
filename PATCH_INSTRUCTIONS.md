# AVDC V6.0.7 — Patch de layout da busca semântica

## Objetivo

Corrigir a ordem visual dos quadros na tela principal.

## O que muda

- O quadro **Motor de IA** fica antes da área operacional de busca.
- O quadro **Busca semântica** fica antes do quadro **Catálogo inicial do índice**.
- O botão **Testar conexão da IA salva** permanece no Motor de IA e continua usando os dados salvos no banco.
- A lógica de desabilitar controles da busca simples/catálogo ao marcar busca semântica foi preservada.

## Ordem visual esperada

1. Repositórios do AVDC
2. Motor de IA
3. Busca semântica
4. Catálogo inicial do índice
5. Busca simples

## Arquivos alterados

- package.json
- server.js
- src/routes/index.js
- public/index.html
- README.md
- PATCH_INSTRUCTIONS.md
- checkpoints/CHECKPOINT_V6_0_7_LAYOUT_BUSCA_SEMANTICA_ANTES_CATALOGO.md

## Aplicação

Copie os arquivos deste patch sobre a base V6.0.6 ou use o ZIP completo V6.0.7.
