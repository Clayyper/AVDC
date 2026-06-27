/**
 * AVDC v2.6
 * PostgreSQL + login admin/usuário + conexão GitHub do usuário.
 *
 * Escopo desta etapa:
 * - Usuário loga com código + token.
 * - Usuário clica em Conectar GitHub.
 * - GitHub autoriza.
 * - AVDC salva login/token GitHub no banco do usuário.
 * - Usuário pode desconectar/trocar a conta GitHub.
 *
 * Ainda NÃO lista repositórios.
 * Ainda NÃO cria índice.
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

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    app: "AVDC",
    version: "2.6.0",
    module: "github-connect",
    database: process.env.DATABASE_URL ? "postgres" : "not-configured",
    githubConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CALLBACK_URL)
  });
});

async function start() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`AVDC v2.6 rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error("Erro ao iniciar AVDC:", error);
    process.exit(1);
  }
}

start();
