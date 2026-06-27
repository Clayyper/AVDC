# AVDC v2.9 - Repositório de Dados e Repositório de Índice

Esta versão parte da v2.8 validada.

## Mudança arquitetural

A partir desta versão o AVDC separa dois repositórios:

1. **Repositório de dados**
   - Fonte original do cliente.
   - Deve ser tratado como leitura.
   - O AVDC não deve alterar esse repositório.

2. **Repositório de índice**
   - Local escolhido pelo cliente para salvar os arquivos de índice.
   - Nesta versão ele é apenas selecionado.
   - A gravação real ficará para a próxima etapa.

Essa separação mantém a regra central do AVDC:

> Dados originais intocáveis. Índice separado. Controle do usuário.

## Escopo da v2.9

Inclui:

- Login admin.
- Login de usuário com código + token.
- Conexão GitHub via OAuth.
- Listagem de repositórios GitHub.
- Seleção de repositório de dados.
- Seleção de repositório de índice.
- Migração segura do campo antigo `selected_repo_full_name` para `selected_data_repo_full_name`.
- Catálogo inicial continua usando o repositório de dados.

Não inclui ainda:

- Gravar `catalog.json` no repositório de índice.
- Ler conteúdo profundo dos arquivos.
- Busca textual.
- IA.

## Campos novos no banco

Na tabela `user_future_config`:

```sql
selected_data_repo_full_name TEXT
selected_index_repo_full_name TEXT
```

O campo antigo `selected_repo_full_name` é preservado por compatibilidade, mas passa a ser tratado como alias do repositório de dados.

## Teste da v2.9

1. Entrar como usuário comum.
2. Confirmar GitHub conectado.
3. Clicar em "Listar repositórios".
4. Escolher um repositório como **dados**.
5. Escolher um repositório como **índice**.
6. Confirmar que a tela mostra os dois campos separados.
7. Criar catálogo do índice e confirmar que ele usa o repositório de dados.

## Próxima versão sugerida

v3.0: gravar os arquivos iniciais de índice no repositório de índice escolhido:

```txt
/avdc-index/manifest.json
/avdc-index/catalog.json
```

Ainda sem IA.
