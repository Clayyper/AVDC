# AVDC v4.1 - Base Consolidada

**Seu repositório. Seu banco de dados. Seu arsenal. Sua própria inteligência.**

O AVDC transforma repositórios de código, fontes e documentos técnicos em uma base de conhecimento pesquisável, mantendo os dados originais preservados e o índice separado, controlado pelo próprio usuário.

## Escopo consolidado da v4.1

Esta versão consolida a base funcional do AVDC:

- Login administrativo.
- Cadastro e login de usuários.
- Conexão GitHub por usuário.
- Seleção de repositório de dados.
- Seleção de repositório de índice.
- Suporte ao mesmo repositório para dados e índice.
- Proteção automática de `/avdc-index/` e `.avdc-index/`.
- Consulta da árvore/listagem do repositório.
- Filtros opcionais antes da indexação.
- Catálogo final criado a partir do escopo escolhido.
- Extração de conteúdo quando possível.
- Busca simples e avançada.
- Destaque visual do termo buscado.
- Abertura do arquivo original no GitHub/web.
- Gravação do índice no repositório de índice dentro de `/avdc-index/`.
- Botão discreto para guardar anotações rápidas no repositório configurado.

## Regra central

O AVDC nunca deve alterar o repositório de dados fora da pasta reservada do índice.

Quando o repositório de dados e o repositório de índice forem o mesmo, o AVDC trata automaticamente esse cenário:

```txt
/avdc-index/
.avdc-index/
```

Essas pastas são sempre ignoradas na listagem, no catálogo, na indexação e na busca.

## Fluxo correto de indexação

1. O usuário seleciona o repositório de dados.
2. O AVDC consulta a árvore/listagem do repositório para montar os filtros.
3. O usuário pode aplicar filtros antes de criar o índice.
4. Se não aplicar filtro, o catálogo considera todos os arquivos elegíveis, respeitando sempre as pastas reservadas e regras de segurança.
5. Se aplicar filtro, o catálogo final já nasce com os arquivos filtrados.
6. O AVDC tenta extrair conteúdo dos arquivos desse catálogo.
7. O índice é salvo no repositório de índice, dentro de `/avdc-index/`.
8. A busca sempre abre o arquivo original no GitHub/web.

## Métricas esperadas

O manifest e a interface devem deixar transparente:

- Total de arquivos encontrados pela consulta.
- Filtros aplicados.
- Total de arquivos no catálogo final.
- Total de arquivos com conteúdo extraído.
- Total de arquivos catalogados sem conteúdo extraído.
- Motivo de não extração, quando aplicável.
- Repositório de dados.
- Repositório de índice.
- Data da execução.

## Limites técnicos

Não deve existir limite fixo escondido, como:

- 1 MB por arquivo.
- 80 arquivos por execução.

Se houver limite técnico, ele deve ser:

- configurável por variável de ambiente;
- transparente na interface;
- registrado no manifest;
- informado no resultado final.

## Resultado da busca

A busca retorna o arquivo original como referência principal.

O AVDC não precisa interpretar a extensão para abrir internamente. O usuário deve poder abrir o arquivo original no GitHub/web.

Quando houver trecho exibido, o termo buscado deve aparecer destacado visualmente.

## Notas rápidas

A interface pode oferecer um botão simples chamado **Guardar nota**, com o texto de apoio:

```txt
Guarde anotações rápidas no seu repositório.
```

Ao salvar, o AVDC cria um arquivo simples no repositório configurado, dentro de:

```txt
/avdc-notes/
```

A extensão padrão das notas é:

```txt
.vcd
```

Exemplo:

```txt
/avdc-notes/2026-06-27-minha-nota.vcd
```

A V4.1 não precisa editar, excluir, listar, categorizar ou anexar arquivos às notas. O AVDC apenas cria o arquivo; a gestão fica por conta do usuário no GitHub.

## Próxima linha de evolução

A partir desta base consolidada, a próxima fase pode ser tratada como:

**AVDC v4.1 - Inteligência do Índice**

Sugestões para as próximas versões:

- Seleção visual de pastas pela árvore do repositório.
- Indexação incremental.
- Ranking de relevância.
- Operadores de busca: aspas, AND, OR, NOT.
- Histórico de execuções.
- Comparação entre índices.
- Plugins de extração por tipo de arquivo.
- Busca semântica/IA como camada opcional.
