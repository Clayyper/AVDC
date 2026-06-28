# AVDC V6.0.12 — Patch de correção do fallback semântico

## Objetivo
Corrigir resultados ruins da busca semântica quando a IA não retorna JSON estruturado e o AVDC usa fallback local.

## Arquivos alterados
- package.json
- src/routes/index.js
- README.md
- checkpoints/CHECKPOINT_V6_0_12_FILTRO_FALLBACK_SEMANTICO.md

## Como aplicar
Copie os arquivos deste patch sobre a base V6.0.11 ou suba o ZIP completo V6.0.12.

## Correção
- Remove candidatos técnicos/ocultos do fallback semântico.
- Bloqueia `.gitkeep`, `.keep`, `.DS_Store`, `Thumbs.db` e caminhos `.git/`.
- Mantém bloqueio de `/avdc-index/` e `.avdc-index/`.
- Penaliza `/avdc-notes/*.vcd` para não dominar resultados de arquivos originais.
- Impede fallback com score zero.
- Se não houver candidato textual positivo, retorna vazio em vez de mostrar lixo.
