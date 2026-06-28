# CHECKPOINT V6.0.15 — Fallback garantido da busca semântica

Correção focada no caso em que a busca semântica completa retornava 0 resultado mesmo havendo candidatos possíveis.

## Ajustes

- Se a IA retornar JSON com IDs que não batem com os candidatos, o AVDC não zera a resposta.
- O AVDC tenta resolver resultado por `id`, `fileId`, `candidateId`, `path`, `file` ou `name`.
- Se ainda assim nada mapear, aplica fallback seguro sobre os candidatos já selecionados.
- O fallback usa pontuação normal e loose, mantendo bloqueios técnicos (`.gitkeep`, `.git/`, `avdc-index/`).
- A resposta agora expõe diagnóstico: `candidatesSelected`, `candidatesSent`, `usedFallback` e `mappingFallback`.

## Regra

Se houve candidato selecionado no índice, a busca semântica completa não pode retornar zero apenas porque a IA respondeu em formato aproveitável parcialmente ou com IDs incompatíveis.
