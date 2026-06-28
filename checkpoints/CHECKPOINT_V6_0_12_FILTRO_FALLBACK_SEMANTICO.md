# AVDC V6.0.12 — Filtro do fallback semântico

Correção aplicada após validação real da busca semântica:

- O fallback da busca semântica não deve exibir arquivos técnicos, ocultos ou marcadores como `.gitkeep`.
- Caminhos `.git/`, `/avdc-index/` e `.avdc-index/` continuam bloqueados.
- Arquivos vazios/placeholder não entram como candidatos semânticos.
- Notas em `/avdc-notes/*.vcd` são penalizadas para não dominar resultados de arquivos originais.
- O modo completo/avançado continua com fallback, mas agora o fallback é filtrado e ranqueado.
- Se não houver candidato com pontuação textual positiva, a busca retorna vazio em vez de inventar resultado.

Regra consolidada:

> O fallback existe para evitar zero indevido por resposta malformada da IA, não para mostrar qualquer arquivo do índice.
