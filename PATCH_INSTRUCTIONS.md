# PATCH AVDC V6.0.19 — IA retorna JSON estruturado

## Objetivo

Garantir que a IA classifique corretamente os candidatos da busca semântica, reduzindo drasticamente o fallback para candidatos locais.

## Mudanças principais

### 1. Prompt mais rígido (buildSemanticPayload)

- Instruções explícitas: "Responda APENAS com JSON válido neste formato exato, sem nenhuma palavra extra"
- Enumeração clara de regras obrigatórias
- Remoção de "Tarefa:" e "Candidatos disponíveis:" que podiam confundir a IA
- Mais simples e direto: "Classifique por relevância"

### 2. Parser mais tolerante (parseAiSemanticJson)

- Aceita JSON entre `{ }`
- Aceita arrays diretos `[...]`
- Busca por `"results"` em qualquer posição
- Valida que cada resultado tem `id` e `score`
- Limita a 20 resultados máximo

### 3. Suporte a mais formatos

- JSON com ou sem markdown backticks
- Arrays diretos dentro de JSON
- Chave `results` em qualquer nível

## Resultado esperado

**Antes (v6.0.18):**
```
3 resultados encontrados
A IA não retornou resultado estruturado aproveitável
AVDC exibiu os melhores candidatos do índice local
```

**Depois (v6.0.19):**
```
3 resultados encontrados
Motor compatível, quantidades enviados: 3
IA classificou com sucesso
Retorna: [{ id: 1, score: 0.95, reason: "..." }, ...]
```

## Deploy

1. Suba o código v6.0.19
2. Não há necessidade de regenerar índices
3. Teste: primeira busca semântica deve retornar classificação da IA

## Validação sugerida

1. Faça uma busca semântica simples (ex: "autenticação")
2. Confirme se retorna `usedFallback: false`
3. Se retornar com IA, a mensagem não mais menciona "candidatos do índice local"

