# AVDC V6.0.11 — Fallback da busca semântica completa

Correção aplicada após validação do usuário:

- Busca semântica otimizada retornava resultados.
- Busca semântica completa/avançada podia retornar zero resultados para a mesma pergunta.

Ajustes:

- Parser da resposta da IA ficou mais tolerante a JSON envolvido em texto ou bloco markdown.
- Se a IA não devolver JSON estruturado ou devolver lista vazia, o AVDC não zera a busca.
- O AVDC retorna fallback com os melhores candidatos ranqueados pelo índice local.
- Modo completo retorna até 18 candidatos no fallback.
- Adicionada tolerância simples a erro de digitação, por exemplo: indentidade vs identidade.
- Aviso técnico informa quando o fallback foi usado.

Regra consolidada:

Busca completa deve ampliar a análise, não retornar menos que a otimizada por falha de formatação da IA.
