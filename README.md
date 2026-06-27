# AVDC v2.6 - Conectar GitHub do Usuário

Esta versão mantém PostgreSQL e adiciona apenas a conexão GitHub do usuário.

## Escopo

Inclui:

- Login admin.
- Cadastro de usuários.
- Login do usuário com código + token.
- Conectar GitHub do usuário via OAuth.
- Salvar login/token GitHub no banco do usuário.
- Desconectar GitHub.
- Trocar GitHub.

Não inclui ainda:

- Listar repositórios.
- Escolher repositório.
- Índice.
- Busca real.

## Variáveis no Render

Além das variáveis da v2.5, configure:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://SEU-APP.onrender.com/auth/github/callback
```

## GitHub OAuth App

No GitHub Developer Settings, o OAuth App do AVDC deve ter:

```txt
Homepage URL:
https://SEU-APP.onrender.com

Authorization callback URL:
https://SEU-APP.onrender.com/auth/github/callback
```

Localmente:

```txt
Homepage URL:
http://localhost:3000

Authorization callback URL:
http://localhost:3000/auth/github/callback
```

## Teste

1. Admin cria usuário.
2. Usuário loga com código + token.
3. Usuário clica em Conectar GitHub.
4. GitHub pede autorização.
5. Usuário autoriza.
6. AVDC volta para o painel e mostra a conta conectada.
7. Testar Desconectar GitHub.
8. Testar Trocar GitHub.
