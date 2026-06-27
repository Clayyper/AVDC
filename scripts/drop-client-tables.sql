-- AVDC v4.4 — Refactor de privacidade (Fase 3)
-- Remove definitivamente as tabelas que armazenavam dado do cliente.
--
-- PREMISSA: nenhum dado do cliente no nosso banco.
-- Após este refactor, índice/catálogo/busca vivem só no GitHub do cliente.
--
-- ATENÇÃO: este script é IRREVERSÍVEL. Rode somente quando tiver certeza.
-- O sistema NÃO roda isto automaticamente — é uma ação manual sua.
--
-- Como rodar (URL externa do Render):
--   psql "sua-url-externa" -f scripts/drop-client-tables.sql
--
-- A ordem respeita a foreign key: files referencia runs, então files cai primeiro.
-- O índice GIN e os demais índices caem junto com a tabela (CASCADE implícito no DROP TABLE).

DROP TABLE IF EXISTS repo_index_files CASCADE;
DROP TABLE IF EXISTS repo_index_runs CASCADE;

-- Conferência: estas duas devem retornar 0 linhas após o drop.
-- SELECT to_regclass('public.repo_index_files');  -- esperado: NULL
-- SELECT to_regclass('public.repo_index_runs');   -- esperado: NULL
