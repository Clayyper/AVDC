# AVDC v3.2 - Destaque Visual do Termo Buscado

Esta versão parte da v3.1 validada.

## Escopo da v3.2

Alteração visual pequena e controlada na busca simples.

Inclui:

- Mantém o cartão de resultado exatamente no mesmo modelo da v3.1.
- Mantém a busca por nome, caminho e conteúdo extraído.
- Mostra uma mensagem abaixo da quantidade de resultados:
  - "A busca exibe a primeira ocorrência encontrada em cada arquivo."
- Destaca no trecho exibido o termo pesquisado com marca-texto índigo.
- Se o termo aparece mais de uma vez no trecho exibido, todas as ocorrências visíveis são destacadas.

## Regra da busca

A busca retorna um resultado por arquivo encontrado.

Para cada arquivo, o trecho exibido parte da primeira ocorrência encontrada naquele arquivo.

O AVDC pode destacar mais de uma ocorrência se elas estiverem visíveis dentro do mesmo trecho retornado.

## O que não mudou

- Não mudou a estrutura do cartão.
- Não mudou a estrutura do índice.
- Não mudou a forma de gravação em `/avdc-index/`.
- Não adicionou IA.
- Não alterou os repositórios originais fora da pasta reservada.

## Teste da v3.2

1. Subir a versão no GitHub.
2. Confirmar `package.json` com versão `3.2.0`.
3. Fazer deploy no Render.
4. Entrar como usuário comum.
5. Fazer uma busca, por exemplo:
   - `inner join`
   - `cliente`
   - `progress`
6. Conferir se:
   - aparece a quantidade de resultados;
   - abaixo aparece o aviso da primeira ocorrência por arquivo;
   - o termo buscado aparece destacado em índigo dentro do trecho.
