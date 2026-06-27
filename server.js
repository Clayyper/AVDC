/**
 * AVDC v3.8.0
 * PostgreSQL + login admin/usuário + conexão GitHub do usuário.
 *
 * Escopo desta etapa:
 * - Usuário loga com código + token.
 * - Usuário clica em Conectar GitHub.
 * - GitHub autoriza.
 * - AVDC salva login/token GitHub no banco do usuário.
 * - Usuário pode desconectar/trocar a conta GitHub.
 *
 * Agora grava o índice no GitHub e permite busca simples no conteúdo extraído.
 * Grava manifest, catálogo e índice simples de busca dentro de /avdc-index/.
 */

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const { initDatabase } = require("./src/db");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const userRoutes = require("./src/routes/user");
const githubRoutes = require("./src/routes/github");
const indexRoutes = require("./src/routes/index");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "avdc-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax"
  }
}));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/auth/github", githubRoutes);
app.use("/api/index", indexRoutes);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "AVDC",
    version: "3.8.0",
    module: "base-consolidada-indexacao-avancada",
    database: process.env.DATABASE_URL ? "postgres" : "not-configured",
    githubConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CALLBACK_URL)
  });
});

async function start() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`AVDC v3.8.0 rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("Erro ao iniciar AVDC:", error);
    process.exit(1);
  }
}

start();
