# AVDC v3.0 - Gravar Índice no GitHub

Esta versão parte da v2.9 validada.

## Escopo da v3.0

Inclui:

- Repositório de dados separado do repositório de índice.
- Catálogo do repositório de dados.
- Gravação do catálogo no repositório de índice escolhido.
- Pasta reservada do AVDC: `/avdc-index/`.
- Exclusão automática de `/avdc-index/` da catalogação.
- Suporte ao caso em que o usuário escolhe o mesmo repositório para dados e índice.

## Regra central

O AVDC pode usar o mesmo repositório como dados e índice, mas nunca deve indexar o próprio índice.

Por isso, qualquer arquivo dentro de:

```txt
/avdc-index/
.avdc-index/
```

é ignorado na catalogação.

## Arquivos gravados

No repositório de índice, o AVDC grava:

```txt
/avdc-index/manifest.json
/avdc-index/catalog.json
```

## O que cada arquivo representa

`manifest.json`

- versão do AVDC;
- repositório de dados;
- repositório de índice;
- pasta reservada;
- data da execução;
- quantidade de arquivos.

`catalog.json`

- lista dos arquivos encontrados no repositório de dados;
- nome;
- caminho;
- diretório;
- extensão;
- tamanho;
- SHA do GitHub;
- link para abrir o arquivo original.

## O que esta versão ainda não faz

- Não lê conteúdo profundo dos arquivos.
- Não cria busca textual completa.
- Não usa IA.
- Não grava nada fora de `/avdc-index/`.

## Permissão de gravação

A permissão técnica vem da autorização GitHub concedida pelo usuário ao conectar a conta.

Mas a regra de produto é:

> O AVDC só grava no repositório marcado pelo usuário como Repositório de Índice, e apenas dentro de `/avdc-index/`.

## Teste da v3.0

1. Entrar como usuário comum.
2. Conectar GitHub.
3. Selecionar repositório de dados.
4. Selecionar repositório de índice.
5. Clicar em "Criar catálogo do índice".
6. Abrir o repositório de índice no GitHub.
7. Confirmar que existe a pasta `/avdc-index/`.
8. Confirmar os arquivos:
   - `manifest.json`
   - `catalog.json`

## Próxima versão sugerida

v3.1: busca simples no catálogo gerado, abrindo o arquivo original no GitHub.
