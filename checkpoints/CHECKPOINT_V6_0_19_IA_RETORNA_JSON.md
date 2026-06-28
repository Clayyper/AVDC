# CHECKPOINT V6.0.19 — IA retorna JSON estruturado

## Decisão

A IA deve classificar os candidatos com JSON válido na maioria dos casos. Se falhar, usa fallback seguro para candidatos locais.

## Problema validado

v6.0.18 retornava sempre:
```
"A IA não retornou resultado estruturado aproveitável.
O AVDC exibiu os melhores candidatos do índice local."
```

Motivo: prompt vago, parser inflexível.

## Correção implementada

### 1. Prompt melhorado (buildSemanticPayload)

**Antes:**
```
Tarefa: classificar candidatos...
Retorne JSON estruturado exatamente neste formato, nada mais:
{...}
Regras:
- Use apenas IDs...
```

**Depois:**
```
Você classifica candidatos por relevância semântica...
Responda APENAS com JSON válido neste formato exato, sem nenhuma palavra extra:
{...}
Regras obrigatórias:
1. Apenas JSON válido, sem texto antes ou depois.
2. Use apenas IDs fornecidos...
```

### 2. Parser robusto (parseAiSemanticJson)

Aceita:
- `{"results":[...]}`
- `[...]` (array direto)
- `"results": [...]` em qualquer posição
- JSON com ou sem markdown backticks
- Valida `id` e `score` em cada resultado

### 3. Validação de resultados

Cada resultado deve ter:
- `id`: número ou string (1..N)
- `score`: número entre 0-1
- `reason`: string (opcional)

## Fluxo esperado v6.0.19

```
1. Usuário: busca semântica "termo"
2. AVDC: encontra 3 candidatos
3. AVDC: chama IA com prompt rígido
4. IA: retorna JSON com classificação
5. AVDC: parseia JSON com tolerância
6. AVDC: retorna resultados da IA
   └─ usedFallback: false (sucesso)
```

## Fallback ainda disponível

Se a IA falhar, o fallback continua funcionando:
```javascript
if (parseAiSemanticJson(content).length === 0) {
  return fallbackSemanticResults(candidates, query, mode, "empty_ai");
}
```

## Métrica de sucesso

- Busca semântica retorna `usedFallback: false` em >90% dos casos
- Mensagem de warning não menciona "candidatos do índice local"
- Classificação da IA é visível na resposta

## Observação

v6.0.19 é mínima e focada. Próximas melhorias (v6.0.20+):
- [ ] Cache de respostas da IA
- [ ] Retry com prompt alternativo se falhar
- [ ] Análise de tokens antes de chamar IA
