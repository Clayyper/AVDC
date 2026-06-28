# CHECKPOINT V6.0.5 — Consolidação

## Base

V6.0.4.

## Objetivo

Consolidar a entrega V6.0.5 mantendo o fluxo definido para IA e busca semântica.

## Decisões mantidas

- IA configurável por usuário.
- OpenAI não é obrigatória.
- Busca simples continua funcionando sem IA.
- Motor de IA pode ser configurado mesmo sem ativar busca semântica.
- Botão “Testar conexão da IA” pertence ao formulário Motor de IA.
- Checkbox “Ativar busca semântica” pertence ao formulário de busca.
- Ao ativar busca semântica, os controles da busca simples são desabilitados.
- A busca semântica exibe os modos:
  - Semântica otimizada
  - Semântica completa

## Correção preservada

O patch inclui explicitamente os módulos usados pelo `server.js`, evitando erros de deploy como:

- `Cannot find module './src/db'`
- `Cannot find module './src/routes/auth'`

## Versão

6.0.5
