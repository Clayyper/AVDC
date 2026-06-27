# AVDC v2.7 - Listar e Selecionar Repositório GitHub

Esta versão parte da v2.6 validada.

## Escopo da v2.7

Inclui:

- Login admin.
- Cadastro de usuários.
- Login do usuário com código + token.
- Conectar GitHub do usuário via OAuth.
- Desconectar/trocar GitHub.
- Listar repositórios da conta GitHub conectada.
- Escolher um repositório ativo.
- Salvar o repositório ativo no PostgreSQL.

Não inclui ainda:

- Leitura de arquivos do repositório.
- Índice.
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

## Teste da v2.7

1. Admin entra.
2. Admin cria usuário.
3. Usuário entra com código + token.
4. Usuário conecta GitHub.
5. Usuário clica em "Listar repositórios".
6. Sistema mostra os repositórios.
7. Usuário escolhe um repositório.
8. O painel mostra o repositório selecionado como ativo.

## Próxima versão

v2.8: configurar índice para o repositório ativo.
