# CHECKPOINT V6.0.2 — Modo Busca Semântica

Correção focada no comportamento combinado para a busca semântica.

## Regra aplicada

- A configuração do Motor de IA continua independente e pode ser feita a qualquer momento.
- A IA não força a troca automática para busca semântica.
- A busca simples continua funcionando sem IA.
- O checkbox **Ativar busca semântica** é quem muda o modo da tela.

## Ao marcar busca semântica

- O AVDC valida se o Motor de IA do usuário está configurado.
- Se não estiver configurado, a busca semântica não é habilitada e aparece aviso claro.
- Se estiver configurado, o campo e botão da busca semântica são habilitados.
- Os controles da busca simples são desabilitados temporariamente:
  - Criar catálogo do índice
  - Atualizar visualização
  - Índice Avançado Consolidado
  - Ordenação do catálogo
  - Salvar relatório técnico
  - Guardar nota
  - Buscar simples
  - Termo da busca simples
  - Botão de abrir/ocultar arquivos do catálogo

## Ao desmarcar busca semântica

- O modo semântico é desligado.
- A busca simples volta a ficar habilitada.

Versão: 6.0.2
