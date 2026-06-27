const express = require("express");
const crypto = require("crypto");

const { pool, query, getOne, getAll } = require("../db");
const { requireAdmin } = require("../middleware");

const router = express.Router();

router.use(requireAdmin);

function generateToken() {
  return crypto.randomInt(100000, 999999).toString();
}

function normalizeUserCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validateUser(name, userCode) {
  const cleanName = String(name || "").trim();
  const cleanCode = normalizeUserCode(userCode);

  if (cleanName.length < 2) {
    return { error: "Informe um nome com pelo menos 2 caracteres." };
  }

  if (cleanCode.length < 3) {
    return { error: "O código único precisa ter pelo menos 3 caracteres." };
  }

  if (cleanCode.length > 40) {
    return { error: "O código único deve ter no máximo 40 caracteres." };
  }

  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(cleanCode)) {
    return {
      error: "Use apenas letras, números, ponto, hífen ou underline. O código deve começar e terminar com letra ou número."
    };
  }

  return {
    name: cleanName,
    userCode: cleanCode
  };
}

router.get("/dashboard", async (req, res) => {
  try {
    const totalUsers = await getOne(`
      SELECT COUNT(*)::int AS total
      FROM users
    `);

    const activeUsers = await getOne(`
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE status = 'active'
    `);

    res.json({
      totalUsers: totalUsers.total,
      activeUsers: activeUsers.total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar resumo." });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await getAll(`
      SELECT
        id,
        name,
        user_code AS "userCode",
        user_token AS "userToken",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM users
      ORDER BY id DESC
    `);

    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar usuários." });
  }
});

router.post("/users", async (req, res) => {
  const checked = validateUser(req.body.name, req.body.userCode);

  if (checked.error) {
    return res.status(400).json({ error: checked.error });
  }

  const client = await pool.connect();

  try {
    const exists = await client.query(`
      SELECT id
      FROM users
      WHERE user_code = $1
    `, [checked.userCode]);

    if (exists.rows.length > 0) {
      return res.status(409).json({
        error: "Código do usuário já existe. Escolha outro código."
      });
    }

    const now = new Date().toISOString();
    const token = generateToken();

    await client.query("BEGIN");

    const inserted = await client.query(`
      INSERT INTO users (
        name,
        user_code,
        user_token,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'active', $4, $5)
      RETURNING id
    `, [
      checked.name,
      checked.userCode,
      token,
      now,
      now
    ]);

    const userId = inserted.rows[0].id;

    await client.query(`
      INSERT INTO user_future_config (
        user_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3)
    `, [userId, now, now]);

    await client.query("COMMIT");

    res.json({
      ok: true,
      user: {
        id: userId,
        name: checked.name,
        userCode: checked.userCode,
        userToken: token,
        status: "active"
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro ao criar usuário." });
  } finally {
    client.release();
  }
});

router.post("/users/:id/regenerate-token", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const user = await getOne(`
      SELECT id
      FROM users
      WHERE id = $1
    `, [id]);

    if (!user) {
      return res.status(404).json({
        error: "Usuário não encontrado."
      });
    }

    const token = generateToken();

    await query(`
      UPDATE users
      SET user_token = $1, updated_at = $2
      WHERE id = $3
    `, [token, new Date().toISOString(), id]);

    res.json({
      ok: true,
      userToken: token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar novo token." });
  }
});

router.post("/users/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body.status === "inactive" ? "inactive" : "active";

    const result = await query(`
      UPDATE users
      SET status = $1, updated_at = $2
      WHERE id = $3
    `, [status, new Date().toISOString(), id]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Usuário não encontrado."
      });
    }

    res.json({
      ok: true,
      status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao alterar status." });
  }
});

router.delete("/users/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const id = Number(req.params.id);

    await client.query("BEGIN");
    await client.query("DELETE FROM user_future_config WHERE user_id = $1", [id]);
    await client.query("DELETE FROM users WHERE id = $1", [id]);
    await client.query("COMMIT");

    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro ao excluir usuário." });
  } finally {
    client.release();
  }
});

router.post("/change-password", async (req, res) => {
  try {
    const newPassword = String(req.body.newPassword || "").trim();

    if (newPassword.length < 4) {
      return res.status(400).json({
        error: "A senha deve ter pelo menos 4 caracteres."
      });
    }

    await query(`
      UPDATE admin_config
      SET admin_password = $1, updated_at = $2
      WHERE id = 1
    `, [newPassword, new Date().toISOString()]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao trocar senha." });
  }
});

module.exports = router;
