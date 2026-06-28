# AVDC V6.0.14

Versão de hotfix da V6 com foco na busca semântica completa.

## Correção principal

A busca semântica completa não deve retornar zero quando existem candidatos textuais no índice e a busca otimizada consegue encontrar resultados.

## Ajustes

- Ranqueamento de resgate mais amplo para o modo completo.
- Tolerância maior para busca parcial, como `brada` encontrando `bradesco`.
- Fallback mais seguro quando a IA não retorna JSON estruturado.
- Bloqueio preservado para arquivos técnicos (`.gitkeep`, `.git/`, `/avdc-index/`, `.avdc-index/`).
- Penalização preservada para notas `.vcd`, sem bloqueio total.

## Base

Derivada da V6.0.13.
