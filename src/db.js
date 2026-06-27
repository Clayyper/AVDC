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
      ai_token_encrypted TEXT,
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
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS index_location TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS index_path TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_site TEXT;`);
  await query(`ALTER TABLE user_future_config ADD COLUMN IF NOT EXISTS ai_token_encrypted TEXT;`);

  await query(`
    CREATE TABLE IF NOT EXISTS repo_index_runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      repo_full_name TEXT NOT NULL,
      default_branch TEXT,
      sort_mode TEXT NOT NULL DEFAULT 'alpha',
      status TEXT NOT NULL,
      files_count INTEGER NOT NULL DEFAULT 0,
      truncated INTEGER NOT NULL DEFAULT 0,
      date_lookup_count INTEGER NOT NULL DEFAULT 0,
      date_lookup_limit INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS repo_index_files (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES repo_index_runs(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      repo_full_name TEXT NOT NULL,
      default_branch TEXT,
      path TEXT NOT NULL,
      directory TEXT,
      name TEXT NOT NULL,
      extension TEXT,
      github_type TEXT,
      size_bytes BIGINT,
      sha TEXT,
      github_url TEXT,
      github_created_at TIMESTAMPTZ,
      github_updated_at TIMESTAMPTZ,
      discovered_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_repo_index_runs_user_repo ON repo_index_runs(user_id, repo_full_name, created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_repo_index_files_run_path ON repo_index_files(run_id, lower(path));`);
  await query(`CREATE INDEX IF NOT EXISTS idx_repo_index_files_run_ext ON repo_index_files(run_id, extension);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_repo_index_files_run_updated ON repo_index_files(run_id, github_updated_at DESC NULLS LAST);`);


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
