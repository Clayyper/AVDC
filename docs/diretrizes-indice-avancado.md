# Diretrizes de Índice Avançado do AVDC

## Fluxo Correto

1. O usuário seleciona o repositório de dados.
2. O AVDC consulta a árvore/listagem do repositório para permitir filtros.
3. O usuário pode aplicar filtros antes de criar o índice.
4. Se o usuário não aplicar filtro, o catálogo/indexação considera todos os arquivos possíveis.
5. Se o usuário aplicar filtro, o catálogo final já deve ser criado somente com os arquivos filtrados.
6. Depois disso, o AVDC tenta extrair conteúdo dos arquivos desse catálogo.
7. O índice é salvo no repositório de índice, dentro de `/avdc-index/`.

## Pastas Reservadas

`/avdc-index/` e `.avdc-index/` devem ser sempre ignorados, tanto na listagem quanto no catálogo, na indexação e na busca.

Caso o usuário utilize o mesmo repositório como repositório de dados e de índice, o AVDC trata automaticamente esse cenário protegendo `/avdc-index/`.

## Métricas Transparentes

Após a indexação, o manifest e a interface devem informar:

- Total de arquivos encontrados pela consulta.
- Filtros aplicados.
- Total de arquivos no catálogo final.
- Total de arquivos com conteúdo extraído.
- Total de arquivos sem conteúdo extraído.
- Motivo de não extração.

## Conteúdo

O AVDC deve tentar extrair texto do máximo de arquivos possível, independentemente da extensão.

Se conseguir extrair texto, entra na busca.
Se não conseguir, o arquivo continua no catálogo como catalogado sem conteúdo extraído.

Um arquivo problemático nunca deve derrubar o índice inteiro.

## Produto

- Repositório de dados: fonte original, não alterar.
- Repositório de índice: onde o AVDC grava `/avdc-index/`.
- Resultado da busca: abrir arquivo original no GitHub/web.
- O AVDC não precisa interpretar extensão para abrir internamente.
