# AVDC V6.0.6 — Teste da IA usando dados salvos no banco

## Objetivo

Corrigir a posição e o comportamento do botão de teste da conexão da IA.

## Decisão validada

O botão de teste de conexão da IA pertence ao bloco Motor de IA, não ao formulário da busca semântica.

## Comportamento

- O usuário configura o Motor de IA.
- O usuário salva a configuração.
- O botão “Testar conexão da IA salva” usa os dados já persistidos no banco para o usuário logado.
- O teste não usa diretamente campos soltos da tela como fonte principal.
- O teste não depende de marcar busca semântica.

## Busca semântica

Mantido o comportamento anterior:

- Checkbox “Ativar busca semântica”.
- Ao marcar, valida se existe IA configurada.
- Se existir, desabilita controles da busca simples.
- Mostra formulário com Semântica otimizada e Semântica completa.
