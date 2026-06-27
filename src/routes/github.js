const express = require("express");
const crypto = require("crypto");

const { query, getOne } = require("../db");
const { requireUser } = require("../middleware");

const router = express.Router();

function githubConfigured() {
  return !!(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.GITHUB_CALLBACK_URL
  );
}

router.get("/connect", requireUser, (req, res) => {
  if (!githubConfigured()) {
    return res.status(500).send(`
      <h1>GitHub OAuth não configurado</h1>
      <p>Configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET e GITHUB_CALLBACK_URL no Render.</p>
      <p><a href="/">Voltar</a></p>
    `);
  }

  const state = crypto.randomBytes(16).toString("hex");
  req.session.githubOAuthState = state;

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: "read:user repo",
    state
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

router.get("/callback", requireUser, async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || state !== req.session.githubOAuthState) {
    return res.status(400).send(`
      <h1>Retorno OAuth inválido</h1>
      <p>O estado de segurança não confere.</p>
      <p><a href="/">Voltar</a></p>
    `);
  }

  delete req.session.githubOAuthState;

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CALLBACK_URL
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return res.status(400).send(`
        <h1>GitHub não retornou token</h1>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>
        <p><a href="/">Voltar</a></p>
      `);
    }

    const profileResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
        "User-Agent": "AVDC",
        "Accept": "application/vnd.github+json"
      }
    });

    const profile = await profileResponse.json();

    const userId = req.session.user.id;
    const now = new Date().toISOString();

    await query(`
      UPDATE user_future_config
      SET
        github_connected = 1,
        github_login = $1,
        github_name = $2,
        github_avatar_url = $3,
        github_token_encrypted = $4,
        github_connected_at = $5,
        updated_at = $6
      WHERE user_id = $7
    `, [
      profile.login || "",
      profile.name || "",
      profile.avatar_url || "",
      tokenData.access_token,
      now,
      now,
      userId
    ]);

    res.redirect("/?github=connected");
  } catch (error) {
    console.error(error);
    res.status(500).send(`
      <h1>Erro ao conectar GitHub</h1>
      <p>${String(error.message || error)}</p>
      <p><a href="/">Voltar</a></p>
    `);
  }
});

router.get("/repos", requireUser, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const config = await getOne(`
      SELECT
        github_connected AS "githubConnected",
        github_token_encrypted AS "githubToken",
        selected_repo_full_name AS "selectedRepoFullName"
      FROM user_future_config
      WHERE user_id = $1
    `, [userId]);

    if (!config || Number(config.githubConnected) !== 1 || !config.githubToken) {
      return res.status(400).json({
        error: "GitHub não conectado para este usuário."
      });
    }

    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated&type=all", {
      headers: {
        "Authorization": `Bearer ${config.githubToken}`,
        "User-Agent": "AVDC",
        "Accept": "application/vnd.github+json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erro ao listar repositórios do GitHub.",
        details: data
      });
    }

    const repos = data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      owner: repo.owner?.login || "",
      active: repo.full_name === config.selectedRepoFullName
    }));

    res.json({
      ok: true,
      selectedRepoFullName: config.selectedRepoFullName || null,
      repos
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro interno ao listar repositórios."
    });
  }
});

router.post("/repos/select", requireUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const repoFullName = String(req.body.repoFullName || "").trim();

    if (!repoFullName || !repoFullName.includes("/")) {
      return res.status(400).json({
        error: "Repositório inválido."
      });
    }

    const config = await getOne(`
      SELECT
        github_connected AS "githubConnected",
        github_token_encrypted AS "githubToken"
      FROM user_future_config
      WHERE user_id = $1
    `, [userId]);

    if (!config || Number(config.githubConnected) !== 1 || !config.githubToken) {
      return res.status(400).json({
        error: "GitHub não conectado para este usuário."
      });
    }

    const checkResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        "Authorization": `Bearer ${config.githubToken}`,
        "User-Agent": "AVDC",
        "Accept": "application/vnd.github+json"
      }
    });

    if (!checkResponse.ok) {
      return res.status(400).json({
        error: "Este repositório não está acessível para a conta GitHub conectada."
      });
    }

    const now = new Date().toISOString();

    await query(`
      UPDATE user_future_config
      SET
        selected_repo_full_name = $1,
        updated_at = $2
      WHERE user_id = $3
    `, [repoFullName, now, userId]);

    res.json({
      ok: true,
      selectedRepoFullName: repoFullName
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro interno ao selecionar repositório."
    });
  }
});

router.post("/disconnect", requireUser, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const now = new Date().toISOString();

    await query(`
      UPDATE user_future_config
      SET
        github_connected = 0,
        github_login = NULL,
        github_name = NULL,
        github_avatar_url = NULL,
        github_token_encrypted = NULL,
        github_connected_at = NULL,
        selected_repo_full_name = NULL,
        updated_at = $1
      WHERE user_id = $2
    `, [now, userId]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao desconectar GitHub." });
  }
});

module.exports = router;
