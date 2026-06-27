/**
 * Banco PostgreSQL do AVDC
 *
 * Regras:
 * - Cria tabelas se não existirem.
 * - Nunca apaga dados automaticamente.
 * - Usa DATABASE_URL do Render.
 */

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn("AVISO: DATABASE_URL não configurada. Configure PostgreSQL no Render.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false
});

async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

async function getOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

async function getAll(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS admin_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      admin_user TEXT NOT NULL,
      admin_password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      user_code TEXT NOT NULL UNIQUE,
      user_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_future_config (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      github_connected INTEGER DEFAULT 0,
      github_login TEXT,
      github_name TEXT,
      github_avatar_url TEXT,
      github_token_encrypted TEXT,
      github_connected_at TIMESTAMPTZ,
      selected_repo_full_name TEXT,
      index_location TEXT,
      index_path TEXT,
      ai_site TEXT,
      ai_provider TEXT,
      ai_base_url TEXT,
      ai_model TEXT,
      ai_token_encrypted TEXT,
      ai_connected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);


  /*
    Migrações seguras para versões anteriores:
    adicionam campos se não existirem.
    Nunca removem dados.
  */
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS github_name TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS github_avatar_url TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS github_connected_at TIMESTAMPTZ;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS selected_repo_full_name TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS selected_data_repo_full_name TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS selected_index_repo_full_name TEXT;`);

  /*
    Compatibilidade com v2.7/v2.8:
    o antigo selected_repo_full_name passa a ser entendido como repositório de dados.
  */
  await query(`
    UPDATE user_future_config
    SET selected_data_repo_full_name = selected_repo_full_name
    WHERE selected_data_repo_full_name IS NULL
      AND selected_repo_full_name IS NOT NULL
  `);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS index_location TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS index_path TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_site TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_provider TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_base_url TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_model TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_token_encrypted TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_connected_at TIMESTAMPTZ;`);

  /*
    v4.4 - Refactor de privacidade (Fase 3).
    As tabelas repo_index_runs e repo_index_files foram REMOVIDAS.
    Nenhum dado do cliente (path, nome, diretório, conteúdo, preview, erro) é
    armazenado no nosso banco. O índice, catálogo e busca vivem exclusivamente
    no GitHub do cliente, em /avdc-index/.
    No nosso banco ficam apenas: admin_config, users, user_future_config
    (login, token, conexão — dados nossos, de credencial).

    O DROP das tabelas antigas é feito manualmente (ver scripts/drop-client-tables.sql),
    pois o sistema não apaga dados automaticamente.
  */

  const admin = await getOne("SELECT id FROM admin_config WHERE id = 1");

  if (!admin) {
    const now = new Date().toISOString();

    await query(`
      INSERT INTO admin_config (
        id,
        admin_user,
        admin_password,
        created_at,
        updated_at
      )
      VALUES (1, $1, $2, $3, $4)
    `, [
      process.env.ADMIN_USER || "admin",
      process.env.ADMIN_PASSWORD || "admin123",
      now,
      now
    ]);
  }
}

module.exports = {
  pool,
  query,
  getOne,
  getAll,
  initDatabase
};
