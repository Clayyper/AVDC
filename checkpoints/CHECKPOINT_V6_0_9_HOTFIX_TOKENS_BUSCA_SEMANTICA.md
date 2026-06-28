# CHECKPOINT V6.0.9 — Hotfix tokens busca semântica

## Problema encontrado

A busca semântica estava funcional, mas em alguns repositórios enviava conteúdo demais para o provedor de IA.

Erro observado:

```txt
Request too large for gpt-4 ... tokens per min (TPM): Limit 10000, Requested 24237
```

## Correção

- Reduzido número de candidatos enviados para a IA.
- Reduzido tamanho das prévias enviadas por arquivo.
- Criado payload semântico compacto.
- Definido `max_tokens` na chamada Chat Completions.
- Criada mensagem amigável para erro de limite de tokens.
- Retorno da busca informa quando houve compactação automática.

## Limites iniciais

Modo otimizado:

```txt
10 candidatos
500 caracteres de prévia por candidato
maxPromptChars: 7200
max_tokens: 650
```

Modo completo:

```txt
18 candidatos
700 caracteres de prévia por candidato
maxPromptChars: 11800
max_tokens: 900
```

## Preservado

- IA configurada por usuário.
- Teste de conexão da IA salva no banco.
- Busca semântica antes do catálogo.
- Busca simples sem IA.
- Busca semântica somente com Motor de IA configurado.
