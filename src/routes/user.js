const express = require("express");

const { getOne } = require("../db");
const { requireUser } = require("../middleware");

const router = express.Router();

router.use(requireUser);

router.get("/profile", async (req, res) => {
  try {
    const userId = req.session.user.id;

    const user = await getOne(`
      SELECT
        id,
        name,
        user_code AS "userCode",
        status,
        created_at AS "createdAt"
      FROM users
      WHERE id = $1
    `, [userId]);

    const config = await getOne(`
      SELECT
        github_connected AS "githubConnected",
        github_login AS "githubLogin",
        github_name AS "githubName",
        github_avatar_url AS "githubAvatarUrl",
        github_connected_at AS "githubConnectedAt",
        selected_repo_full_name AS "selectedRepoFullName",
        index_path AS "indexPath",
        ai_site AS "aiSite"
      FROM user_future_config
      WHERE user_id = $1
    `, [userId]);

    res.json({
      user,
      github: {
        connected: !!(config && Number(config.githubConnected) === 1),
        login: config?.githubLogin || null,
        name: config?.githubName || null,
        avatarUrl: config?.githubAvatarUrl || null,
        connectedAt: config?.githubConnectedAt || null
      },
      repository: {
        selectedRepoFullName: config?.selectedRepoFullName || null
      },
      future: {
        indexPath: config?.indexPath || null,
        aiSite: config?.aiSite || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar perfil do usuário." });
  }
});

module.exports = router;
