# AVDC V6.0.11 — Patch de correção da busca semântica completa

## Correção

A busca semântica otimizada retornava resultados, mas a completa/avançada podia retornar zero quando a IA não devolvia JSON estruturado ou devolvia lista vazia.

Esta versão corrige:

- parser mais tolerante para resposta JSON da IA;
- fallback automático para candidatos ranqueados pelo índice local quando a IA falha na estrutura;
- busca completa não zera mais por falha de formatação da IA;
- tolerância simples a erro de digitação, exemplo: `indentidade` vs `identidade`;
- aviso técnico quando o fallback for usado.

## Aplicação

Copie o conteúdo deste patch sobre a raiz do projeto AVDC no repositório/deploy.

## Arquivos incluídos

- server.js
- package.json
- src/db.js
- src/middleware.js
- src/routes/*.js
- public/index.html
- public/app.js
- public/style.css
- README.md
- checkpoints/CHECKPOINT_V6_0_11_FALLBACK_BUSCA_SEMANTICA_COMPLETA.md
