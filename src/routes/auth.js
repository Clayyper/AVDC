const express = require("express");
const router = express.Router();

const { getOne } = require("../db");

router.post("/admin/login", async (req, res) => {
  try {
    const { adminUser, adminPassword } = req.body;

    const admin = await getOne(`
      SELECT admin_user, admin_password
      FROM admin_config
      WHERE id = 1
    `);

    if (!admin || admin.admin_user !== adminUser || admin.admin_password !== adminPassword) {
      return res.status(401).json({
        error: "Administrador ou senha inválidos."
      });
    }

    req.session.admin = {
      user: admin.admin_user,
      role: "admin"
    };

    req.session.user = null;

    res.json({
      ok: true,
      type: "admin",
      admin: {
        user: admin.admin_user,
        role: "admin"
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro no login do administrador." });
  }
});

router.post("/user/login", async (req, res) => {
  try {
    const userCode = String(req.body.userCode || "").trim().toLowerCase();
    const userToken = String(req.body.userToken || "").trim();

    if (!userCode || !userToken) {
      return res.status(400).json({
        error: "Informe código do usuário e token."
      });
    }

    const user = await getOne(`
      SELECT
        id,
        name,
        user_code AS "userCode",
        user_token AS "userToken",
        status,
        created_at AS "createdAt"
      FROM users
      WHERE user_code = $1
        AND user_token = $2
    `, [userCode, userToken]);

    if (!user) {
      return res.status(401).json({
        error: "Código ou token inválido."
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: "Usuário inativo. Procure o administrador."
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      userCode: user.userCode,
      role: "user"
    };

    req.session.admin = null;

    res.json({
      ok: true,
      type: "user",
      user: {
        id: user.id,
        name: user.name,
        userCode: user.userCode,
        role: "user"
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro no login do usuário." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (req.session.admin) {
    return res.json({
      authenticated: true,
      type: "admin",
      admin: req.session.admin
    });
  }

  if (req.session.user) {
    return res.json({
      authenticated: true,
      type: "user",
      user: req.session.user
    });
  }

  res.json({
    authenticated: false,
    type: null
  });
});

module.exports = router;
