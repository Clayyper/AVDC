# AVDC v2.8 - Catálogo Inicial do Índice

Esta versão parte da v2.7 validada.

## Escopo da v2.8

Inclui:

- Login admin.
- Cadastro de usuários.
- Login do usuário com código + token.
- Conectar GitHub do usuário via OAuth.
- Listar repositórios da conta GitHub conectada.
- Escolher um repositório ativo.
- Criar um catálogo inicial do índice para o repositório ativo.
- Salvar no PostgreSQL a lista de arquivos encontrados.

O catálogo salva, por arquivo:

- caminho completo;
- diretório;
- nome;
- extensão;
- tamanho;
- SHA do GitHub;
- link do arquivo no GitHub;
- data de descoberta pelo AVDC;
- última alteração no GitHub, quando solicitada e disponível.

## Ordenação

A interface oferece duas opções simples:

1. Ordem alfabética A-Z.
2. Mais recentes primeiro pela última alteração no GitHub.

Observação: a listagem simples do GitHub não entrega data de criação do arquivo. Por isso, nesta versão, a opção de data usa a última alteração disponível no GitHub. O campo de data de criação fica reservado para evolução futura.

## Não inclui ainda

- Leitura do conteúdo dos arquivos.
- Índice textual.
- Busca real.
- IA.

## Variáveis no Render

```env
DATABASE_URL=postgres://...
SESSION_SECRET=...
ADMIN_USER=admin
ADMIN_PASSWORD=...

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://SEU-APP.onrender.com/auth/github/callback
```

Opcional:

```env
AVDC_DATE_LOOKUP_LIMIT=100
```

Esse limite controla quantos arquivos terão busca individual de data de última alteração quando o usuário escolher ordenação por data.

## Teste da v2.8

1. Entrar como usuário comum.
2. Confirmar GitHub conectado.
3. Confirmar repositório ativo escolhido.
4. Em "Catálogo inicial do índice", escolher a ordenação.
5. Clicar em "Criar catálogo do índice".
6. Conferir se a lista de arquivos aparece ordenada.

## Próxima versão sugerida

v2.9: selecionar quais tipos de arquivo ou pastas serão lidos para gerar um índice de conteúdo.
