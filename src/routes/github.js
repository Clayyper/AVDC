const express = require("express");
const crypto = require("crypto");

const { query } = require("../db");
const { requireUser } = require("../middleware");

const router = express.Router();

function githubConfigured() {
  return !!(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.GITHUB_CALLBACK_URL
  );
}

/*
  Etapa 1:
  Usuário clica em Conectar GitHub.
  O AVDC manda o usuário para a tela de autorização do GitHub.
*/
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
    scope: "read:user",
    state
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

/*
  Etapa 2:
  GitHub retorna para o AVDC.
  O AVDC troca o "code" por access_token e busca o perfil do GitHub.
*/
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
        "User-Agent": "AVDC"
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

/*
  Desconectar GitHub:
  Remove a conexão do cadastro do usuário.
  Não apaga o usuário.
*/
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
