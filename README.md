# AVDC V6.0.13

Hotfix da busca semântica.

## Correções

- Corrige metadados que ainda apareciam como V6.0.9.
- Ajusta seleção de candidatos da busca semântica para não zerar indevidamente.
- Mantém filtros contra arquivos técnicos como `.gitkeep`, `.git/`, `avdc-index/` e `.avdc-index/`.
- Mantém penalidade para `avdc-notes/*.vcd`, mas sem bloquear totalmente se for o único conteúdo relevante.
- Adiciona tolerância de prefixo para buscas parciais, exemplo: `brada` encontrando termos como `bradesco`.
- Preserva compactação de tokens da V6.0.9 e fallback estruturado da V6.0.11.

## Regra

A busca completa não deve retornar zero quando existem candidatos textuais relevantes no índice.
