# PATCH AVDC V6.0.14

## Objetivo

Hotfix da busca semântica completa retornando `0 resultado(s)` mesmo quando a busca otimizada encontra candidatos.

## Problema corrigido

Na V6.0.13, o modo completo ainda podia retornar zero quando:

- a IA não devolvia JSON estruturado útil;
- a seleção inicial de candidatos ficava restritiva demais;
- a busca era parcial, por exemplo `brada` tentando alcançar `bradesco`.

## Correção

- Adicionado ranqueamento semântico mais amplo somente como resgate/fallback.
- O modo completo agora tenta uma segunda seleção com prefixo mais tolerante.
- O fallback da busca completa aceita candidatos com score bruto positivo, mesmo que tenham penalidade, sem liberar arquivos técnicos ocultos.
- Mantidos bloqueios para `.gitkeep`, `.git/`, `/avdc-index/` e `.avdc-index/`.
- Mantida penalização para `avdc-notes/*.vcd`, sem bloqueio total.
- Atualizados metadados para V6.0.14.

## Arquivos alterados

- `package.json`
- `server.js`
- `public/index.html`
- `public/app.js`
- `src/routes/index.js`
- `README.md`
- `PATCH_INSTRUCTIONS.md`
- `checkpoints/CHECKPOINT_V6_0_14_HOTFIX_SEMANTICA_COMPLETA_ZERO.md`

## Aplicação

Copie os arquivos deste patch sobre a base V6.0.13 ou suba o pacote completo V6.0.14.

## Validação sugerida

Testar no Render:

- Busca semântica otimizada: `brada`
- Busca semântica completa: `brada`
- Busca semântica otimizada: `bradesco`
- Busca semântica completa: `bradesco`

Resultado esperado:

- A completa não deve voltar zero quando a otimizada encontra candidatos.
- Arquivos técnicos como `.gitkeep` não devem aparecer.
