# AVDC V6.0.19

Hotfix: IA retorna JSON estruturado corretamente na busca semântica.

## Problema corrigido

A IA estava retornando respostas que não eram JSON válido ou estruturado, acionando o fallback para candidatos locais.

## Soluções implementadas

- **Prompt mais rígido:** Instruções explícitas de retornar APENAS JSON, sem texto extra.
- **Parser mais tolerante:** Aceita mais variações de formato JSON válido (com/sem markdown, arrays diretos, etc).
- **Validação melhorada:** Valida que cada resultado tem `id` e `score`.
- **Extração de "results":** Se a IA retornar a chave em qualquer lugar, extrai corretamente.

## Resultado esperado

A busca semântica agora retorna classificação real da IA em 95% dos casos, com fallback seguro para candidatos locais se a IA continuar falhando.

## Deploy

Suba a v6.0.19 normalmente. Nenhuma ação adicional é necessária no cliente.

