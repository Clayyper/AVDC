# AVDC v3.1 - Busca Simples no Conteúdo

Esta versão parte da v3.0.2 validada.

## Escopo da v3.1

Inclui:

- Repositório de dados separado do repositório de índice.
- Gravação em `/avdc-index/`.
- Ignora `/avdc-index/` na catalogação.
- Cria:
  - `/avdc-index/manifest.json`
  - `/avdc-index/catalog.json`
  - `/avdc-index/search-index.json`
- Tenta extrair texto simples de arquivos pequenos e compatíveis.
- Busca por:
  - nome do arquivo;
  - caminho do arquivo;
  - texto extraído quando disponível.
- Resultado abre o arquivo original no GitHub.

## O que não faz ainda

- Não usa IA.
- Não faz embeddings.
- Não interpreta arquivos binários.
- Não lê arquivos grandes por padrão.
- Não mostra links internos do índice na interface.

## Limites configuráveis

```env
AVDC_CONTENT_FILE_LIMIT=80
AVDC_MAX_FILE_BYTES=1048576
AVDC_MAX_TEXT_CHARS=200000
AVDC_DATE_LOOKUP_LIMIT=100
```

## Regra importante

Mesmo se o usuário usar o mesmo repositório como dados e índice, o AVDC ignora:

```txt
/avdc-index/
.avdc-index/
```

Assim ele não indexa o próprio índice.

## Próxima etapa

Depois desta versão, a próxima fase é estruturar melhor o conteúdo extraído e preparar a busca avançada/semântica com plugin de IA opcional.
