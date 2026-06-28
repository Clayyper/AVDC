# AVDC V6.0.18

V6 com IA opcional por usuário, busca simples separada da busca semântica e índice semântico criado sob demanda.

## Regra consolidada

- Busca simples usa `/avdc-index/search-index.json`.
- Busca semântica usa `/avdc-index/semantic-index.json`.
- O diretório técnico continua sendo o mesmo: `/avdc-index/`.
- Os índices são separados por finalidade.
- O índice semântico é criado automaticamente na hora da busca quando não existir ou estiver vazio.

## Fluxo da busca semântica

1. Usuário configura o Motor de IA.
2. Usuário marca `Ativar busca semântica`.
3. Usuário digita a busca.
4. AVDC verifica `/avdc-index/semantic-index.json`.
5. Se o arquivo não existir ou estiver vazio, o AVDC cria o índice semântico sob demanda.
6. Depois da criação, a busca semântica roda no índice recém-criado.

## Arquivos técnicos

- `/avdc-index/catalog.json`
- `/avdc-index/search-index.json`
- `/avdc-index/semantic-index.json`
- `/avdc-index/manifest.json`
- `/avdc-index/extraction-report.txt` quando solicitado
- `/avdc-notes/*.vcd`

## Observação

A busca semântica não depende do botão `Criar catálogo do índice`. Esse botão continua existindo para o fluxo simples/catálogo completo, mas o índice semântico pode ser criado no momento da própria busca.
