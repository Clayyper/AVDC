# AVDC V6.0.9 — Hotfix limite de tokens da busca semântica

## Objetivo

Corrigir o erro de IA:

```txt
Request too large for gpt-4 ... tokens per min (TPM): Limit 10000, Requested 24237
```

## Arquivos alterados

```txt
server.js
package.json
src/routes/index.js
public/index.html
public/app.js
README.md
checkpoints/CHECKPOINT_V6_0_9_HOTFIX_TOKENS_BUSCA_SEMANTICA.md
```

## Aplicação

Copie os arquivos do patch sobre a base V6 atual e faça novo deploy no Render.

Se a base no Render estiver instável ou incompleta, use o ZIP completo da V6.0.9.

## Regra corrigida

A busca semântica não pode enviar o índice inteiro ou candidatos grandes demais para a IA.
Agora ela reduz candidatos, compacta prévias, limita saída e retorna aviso quando a consulta foi compactada.
