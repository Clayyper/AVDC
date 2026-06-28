# CHECKPOINT V6.0.3 — Formulário semântico e teste de conexão IA

## Objetivo

Ajustar a experiência da V6 para separar corretamente:

- Configuração/Teste do Motor de IA.
- Ativação da busca semântica.
- Controles da busca simples.

## Regra validada

O Motor de IA pode ser configurado e testado a qualquer momento pelo usuário.

O botão **Testar conexão da IA** fica junto do formulário **Motor de IA**.
Ele não depende da busca semântica estar marcada.

## Busca semântica

Ao marcar **Ativar busca semântica**:

- valida se o Motor de IA do usuário está configurado;
- se não estiver configurado, desmarca o checkbox e avisa o usuário;
- se estiver configurado, mostra o formulário da busca semântica;
- habilita a pergunta semântica;
- habilita o botão Buscar por semântica;
- habilita o seletor de modo semântico;
- desabilita os controles da busca simples.

Ao desmarcar:

- oculta/desabilita o formulário semântico;
- reabilita os controles da busca simples.

## Modos adicionados

- Semântica otimizada
- Semântica completa

## Observação

A IA continua opcional e por usuário.
Busca simples continua independente de IA.

Versão: 6.0.3
