# AVDC v5.0 - Relatório técnico TXT e detalhes recolhíveis

## Ajuste aplicado

- A tela principal da indexação permanece limpa, mostrando apenas o resumo da execução.
- Os detalhes técnicos da execução atual aparecem em área recolhível, por botão.
- Os detalhes aparecem na interface tanto com o checkbox marcado quanto desmarcado, mas apenas durante a execução atual.
- O relatório persistente no GitHub é opcional.
- Quando marcado, o AVDC salva `/avdc-index/extraction-report.txt` no repositório de índice.
- O TXT informa que, para consultar novamente, o acesso deve ser feito diretamente pelo GitHub; pela ferramenta, os detalhes só aparecem novamente se a indexação for executada de novo.
- O AVDC não cria visualizador interno de relatório salvo.

## Validação

Executado:

```bash
node --check public/app.js
node --check server.js
node --check src/routes/index.js
```

Resultado: sintaxe validada.

## Observação

Servidor completo não foi iniciado neste ambiente porque depende das variáveis de ambiente e do PostgreSQL do projeto.
