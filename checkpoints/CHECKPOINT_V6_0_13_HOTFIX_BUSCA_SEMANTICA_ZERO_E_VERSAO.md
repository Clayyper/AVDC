# CHECKPOINT V6.0.13 — Hotfix busca semântica zerada e versão consolidada

## Problema validado

Na V6.0.12, a busca semântica ficou restritiva demais e retornou zero tanto no modo otimizado quanto no completo para buscas como `brada`.

Também havia metadados internos ainda exibindo V6.0.9.

## Correção

- Atualizados package.json, server.js, index.html, app.js e manifest interno para V6.0.13.
- `semanticCandidateFiles` deixou de descartar candidatos com pontuação baixa demais quando existem sinais textuais.
- `scoreIndexFile` ganhou tolerância de prefixo para buscas parciais.
- Filtros técnicos continuam ativos para `.gitkeep`, `.git/`, `avdc-index/` e `.avdc-index/`.
- `avdc-notes/*.vcd` permanece penalizado, não bloqueado totalmente.

## Resultado esperado

A busca semântica otimizada e completa não devem voltar vazias quando o índice contém candidatos minimamente relacionados.
