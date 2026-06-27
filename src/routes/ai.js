const express = require("express");

const { query, getOne } = require("../db");
const { requireUser } = require("../middleware");

const router = express.Router();
router.use(requireUser);

const PROVIDERS = {
  "openai-compatible": {
    label: "Compatível com OpenAI",
    defaultBaseUrl: ""
  },
  "openrouter": {
    label: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1"
  },
  "groq": {
    label: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1"
  },
  "together": {
    label: "Together AI",
    defaultBaseUrl: "https://api.together.xyz/v1"
  },
  "ollama": {
    label: "Ollama / local",
    defaultBaseUrl: ""
  }
};

function normalizeProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return PROVIDERS[provider] ? provider : "openai-compatible";
}

function normalizeBaseUrl(provider, value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  return raw || PROVIDERS[provider]?.defaultBaseUrl || "";
}

function publicAiConfig(config) {
  const provider = config?.aiProvider || config?.aiSite || null;

  return {
    configured: !!(config?.aiProvider && config?.aiBaseUrl && config?.aiModel && (config?.aiToken || config?.aiProvider === "ollama")),
    provider,
    providerLabel: provider ? (PROVIDERS[provider]?.label || provider) : null,
    baseUrl: config?.aiBaseUrl || null,
    model: config?.aiModel || null,
    connectedAt: config?.aiConnectedAt || null
  };
}

async function getUserAiConfig(userId) {
  return getOne(`
    SELECT
      ai_site AS "aiSite",
      ai_provider AS "aiProvider",
      ai_base_url AS "aiBaseUrl",
      ai_model AS "aiModel",
      ai_token_encrypted AS "aiToken",
      ai_connected_at AS "aiConnectedAt"
    FROM user_future_config
    WHERE user_id = $1
  `, [userId]);
}

router.get("/providers", async (req, res) => {
  res.json({
    ok: true,
    providers: Object.entries(PROVIDERS).map(([id, provider]) => ({
      id,
      label: provider.label,
      defaultBaseUrl: provider.defaultBaseUrl
    }))
  });
});

router.get("/config", async (req, res) => {
  try {
    const config = await getUserAiConfig(req.session.user.id);
    res.json({ ok: true, ai: publicAiConfig(config) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar configuração de IA." });
  }
});

router.post("/config", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const provider = normalizeProvider(req.body.provider);
    const baseUrl = normalizeBaseUrl(provider, req.body.baseUrl);
    const model = String(req.body.model || "").trim();
    const token = String(req.body.token || "").trim();

    if (!baseUrl) {
      return res.status(400).json({ error: "Informe a URL base do motor de IA." });
    }

    if (!model) {
      return res.status(400).json({ error: "Informe o modelo de IA." });
    }

    if (provider !== "ollama" && !token) {
      return res.status(400).json({ error: "Informe a chave/token da IA para este provedor." });
    }

    const now = new Date().toISOString();

    await query(`
      UPDATE user_future_config
      SET
        ai_site = $1,
        ai_provider = $1,
        ai_base_url = $2,
        ai_model = $3,
        ai_token_encrypted = $4,
        ai_connected_at = $5,
        updated_at = $6
      WHERE user_id = $7
    `, [provider, baseUrl, model, token, now, now, userId]);

    const config = await getUserAiConfig(userId);
    res.json({ ok: true, ai: publicAiConfig(config) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao salvar configuração de IA." });
  }
});

router.post("/disconnect", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const now = new Date().toISOString();

    await query(`
      UPDATE user_future_config
      SET
        ai_site = NULL,
        ai_provider = NULL,
        ai_base_url = NULL,
        ai_model = NULL,
        ai_token_encrypted = NULL,
        ai_connected_at = NULL,
        updated_at = $1
      WHERE user_id = $2
    `, [now, userId]);

    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao desconectar IA." });
  }
});

module.exports = router;
