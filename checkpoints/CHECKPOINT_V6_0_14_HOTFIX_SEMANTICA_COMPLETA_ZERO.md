# CHECKPOINT V6.0.14 — Hotfix busca semântica completa zerando

## Contexto

Após a V6.0.13, o usuário validou que a busca semântica completa ainda retornava:

> 0 resultado(s) encontrado(s) em semântica completa. Motor: openai-compatible / gpt-4.

## Decisão

A busca completa deve ser mais ampla que a otimizada. Ela não pode zerar apenas por falha de JSON da IA ou por seleção inicial restritiva demais.

## Correções

- Criado ranqueamento semântico amplo de resgate.
- Adicionado `textHasLoosePrefixTerm` para buscas parciais.
- Adicionado `scoreIndexFileLoose` para segunda seleção de candidatos.
- `semanticCandidateFiles` agora tenta seleção ampla quando a seleção normal fica vazia ou fraca no modo completo.
- Fallback do modo completo aceita `rawScore > 0`, mantendo filtro contra arquivos técnicos.

## Regras preservadas

- IA continua opcional e configurada por usuário.
- Busca simples continua sem IA.
- Busca semântica só funciona com Motor de IA configurado.
- `.gitkeep`, `.git/`, `/avdc-index/` e `.avdc-index/` continuam bloqueados.
- `avdc-notes/*.vcd` continua penalizado, mas não bloqueado.
