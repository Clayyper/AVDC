# AVDC V6.0.1 — IA genérica opcional por usuário

Base oficial: ZIP validado pelo usuário derivado da v5.0.6.

## Decisões aplicadas

- V6 inicia a configuração de IA por usuário.
- A IA não fica presa à OpenAI.
- A IA não fica fixa apenas no .env geral da ferramenta.
- Busca simples continua funcionando sem IA.
- Busca semântica só habilita quando o usuário configura o Motor de IA.
- A configuração de IA fica vinculada ao usuário em user_future_config.
- Não mistura configuração de IA entre usuários.
- Checkpoints passam a ficar em /checkpoints/.
- /report/ não deve ser usado em novas versões.

## Arquivos técnicos mantidos

- /avdc-index/catalog.json
- /avdc-index/search-index.json
- /avdc-index/manifest.json
- /avdc-index/extraction-report.txt quando o usuário marcar relatório
- /avdc-notes/*.vcd

## Princípio

Busca simples = sem IA.
Busca semântica = IA opcional, explícita, configurada pelo usuário e separada.
