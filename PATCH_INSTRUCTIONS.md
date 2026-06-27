# AVDC V6.0.3 — Patch de correção

## Conteúdo do patch

Este patch atualiza a V6.0.2 para V6.0.3.

Arquivos alterados:

- package.json
- server.js
- public/index.html
- public/app.js
- src/routes/ai.js
- src/routes/index.js
- README.md
- checkpoints/CHECKPOINT_V6_0_3_FORMULARIO_SEMANTICO_TESTE_IA.md

## Correções principais

1. O botão **Testar conexão da IA** fica dentro do formulário **Motor de IA**.
2. O teste de conexão da IA não depende da busca semântica estar ativada.
3. O checkbox **Ativar busca semântica** valida se existe Motor de IA configurado.
4. Ao ativar busca semântica, os controles da busca simples são desabilitados.
5. O formulário semântico aparece somente quando a busca semântica está ativa.
6. O formulário semântico possui os modos:
   - Semântica otimizada
   - Semântica completa

## Como aplicar

Copie os arquivos deste patch sobre a instalação atual da V6.0.2, mantendo a mesma estrutura de pastas.

Depois suba novamente no Render.

## Validação recomendada

```bash
node --check server.js
node --check public/app.js
node --check src/routes/ai.js
node --check src/routes/index.js
```
