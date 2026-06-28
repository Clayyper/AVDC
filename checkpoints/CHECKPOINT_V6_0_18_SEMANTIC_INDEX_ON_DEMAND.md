# CHECKPOINT V6.0.18 — Índice semântico sob demanda

## Decisão validada

O índice semântico é separado do índice simples, mas não deve depender do usuário clicar em `Criar catálogo do índice`.

## Regra

- Diretório técnico: `/avdc-index/`
- Índice simples: `/avdc-index/search-index.json`
- Índice semântico: `/avdc-index/semantic-index.json`
- O índice semântico é criado/atualizado automaticamente na hora da busca quando ausente ou vazio.

## Fluxo

1. Usuário executa busca semântica.
2. AVDC tenta carregar `/avdc-index/semantic-index.json`.
3. Se não existir ou estiver vazio, AVDC escaneia o repositório de dados e cria o índice semântico.
4. AVDC salva o índice semântico no GitHub do usuário.
5. AVDC executa a busca no índice recém-criado.

## Observação

O botão `Criar catálogo do índice` continua existindo para o fluxo de catálogo/busca simples, mas não é pré-requisito para a busca semântica.
