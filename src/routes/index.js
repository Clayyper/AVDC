const express = require("express");
const crypto = require("crypto");

const { getOne } = require("../db");
const { requireUser } = require("../middleware");

const router = express.Router();

router.use(requireUser);

const VALID_SORT_MODES = new Set(["alpha", "updated_desc"]);
const AVDC_INDEX_DIR = "avdc-index";
const MANIFEST_PATH = `${AVDC_INDEX_DIR}/manifest.json`;
const CATALOG_PATH = `${AVDC_INDEX_DIR}/catalog.json`;
const SEARCH_INDEX_PATH = `${AVDC_INDEX_DIR}/search-index.json`;

const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "csv", "tsv", "xml", "html", "htm", "css",
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "java", "c", "h", "cpp", "hpp",
  "cs", "php", "rb", "go", "rs", "swift", "kt", "kts", "sql", "sh", "bat", "ps1",
  "yml", "yaml", "toml", "ini", "env", "properties", "dockerfile", "gitignore",
  "r", "jl", "scala", "lua", "pl", "vb", "pas", "progress", "p", "cls", "w"
]);

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "pdf", "doc", "docx", "xls",
  "xlsx", "ppt", "pptx", "zip", "rar", "7z", "gz", "tar", "mp3", "mp4", "mov",
  "avi", "mkv", "exe", "dll", "so", "dylib", "bin", "jar", "war", "class"
]);

function normalizeSortMode(value) {
  return VALID_SORT_MODES.has(value) ? value : "alpha";
}

function splitPath(filePath) {
  const parts = String(filePath || "").split("/");
  const name = parts.pop() || "";
  const directory = parts.join("/");
  return { name, directory };
}

function extensionFromName(name) {
  const value = String(name || "");
  const index = value.lastIndexOf(".");
  if (index <= 0 || index === value.length - 1) return "";
  return value.slice(index + 1).toLowerCase();
}

function isReservedAvdcIndexPath(filePath) {
  const normalized = String(filePath || "").replace(/^\/+/, "").toLowerCase();

  return (
    normalized === AVDC_INDEX_DIR ||
    normalized.startsWith(`${AVDC_INDEX_DIR}/`) ||
    normalized === ".avdc-index" ||
    normalized.startsWith(".avdc-index/")
  );
}

function githubFileUrl(repoFullName, branch, filePath) {
  const encodedPath = String(filePath || "")
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  return `https://github.com/${repoFullName}/blob/${encodeURIComponent(branch || "main")}/${encodedPath}`;
}

async function getUserGithubConfig(userId) {
  return getOne(`
    SELECT
      github_connected AS "githubConnected",
      github_token_encrypted AS "githubToken",
      selected_repo_full_name AS "selectedRepoFullName",
      selected_data_repo_full_name AS "selectedDataRepoFullName",
      selected_index_repo_full_name AS "selectedIndexRepoFullName"
    FROM user_future_config
    WHERE user_id = $1
  `, [userId]);
}

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "User-Agent": "AVDC",
    "Accept": "application/vnd.github+json"
  };
}

async function fetchGithubJson(url, token) {
  const response = await fetch(url, {
    headers: githubHeaders(token)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || `GitHub respondeu com status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function fetchLatestCommitDate(repoFullName, branch, filePath, token) {
  const url = new URL(`https://api.github.com/repos/${repoFullName}/commits`);
  url.searchParams.set("sha", branch);
  url.searchParams.set("path", filePath);
  url.searchParams.set("per_page", "1");

  try {
    const commits = await fetchGithubJson(url.toString(), token);

    if (Array.isArray(commits) && commits[0]?.commit) {
      return (
        commits[0].commit.committer?.date ||
        commits[0].commit.author?.date ||
        null
      );
    }

    return null;
  } catch (error) {
    console.warn("Não foi possível buscar data do arquivo:", filePath, error.message);
    return null;
  }
}

function stableJson(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function toBase64(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function fromBase64(value) {
  return Buffer.from(value || "", "base64").toString("utf8");
}

// ===== Notas rápidas (.vcd) =====
const AVDC_NOTES_DIR = "avdc-notes";

/*
  Slug conservador para o nome da nota:
  - minúsculas
  - acento vira letra base (ç->c, á->a, ã->a)
  - espaços viram hífen
  - barras / e \ removidas (evita criar subpasta acidental dentro de avdc-notes)
  - demais caracteres não [a-z0-9-] removidos
  - hífens colapsados e aparados nas pontas
  - fallback "nota" se o resultado ficar vazio
*/
function slugifyNoteName(value) {
  const base = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\\/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "nota";
}

// Sufixo aleatório curto (4 chars) para garantir nome único sem listar a pasta.
function randomNoteSuffix() {
  return crypto.randomBytes(2).toString("hex");
}

// Data do servidor no formato YYYY-MM-DD.
function serverDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9_]+/i)
    .map(token => token.trim())
    .filter(token => token.length >= 2);
}

function shouldTryExtractContent(file) {
  const ext = String(file.extension || "").toLowerCase();
  const size = Number(file.sizeBytes || 0);
  const maxBytes = Number(process.env.AVDC_MAX_FILE_BYTES || DEFAULT_MAX_FILE_BYTES);

  if (size > maxBytes) {
    console.log(`[AVDC] IGNORADO (tamanho): ${file.name} | ext: "${ext}" | size: ${size} bytes`);
    return false;
  }
  if (BINARY_EXTENSIONS.has(ext)) {
    console.log(`[AVDC] IGNORADO (binário): ${file.name} | ext: "${ext}"`);
    return false;
  }
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Sem extensão ou extensão desconhecida: tenta ler como texto.
  // fetchFileContent descarta se for binário (null byte).
  if (size === 0) {
    console.log(`[AVDC] IGNORADO (vazio): ${file.name} | ext: "${ext}"`);
    return false;
  }

  console.log(`[AVDC] TENTANDO sem extensão conhecida: ${file.name} | ext: "${ext}" | size: ${size} bytes`);
  return true;
}

function safePreview(text, max = 420) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function makeSnippet(text, terms) {
  const source = String(text || "");
  const normalizedSource = normalizeText(source);
  const firstTerm = terms.find(term => normalizedSource.includes(term));
  let index = firstTerm ? normalizedSource.indexOf(firstTerm) : 0;

  if (index < 0) index = 0;

  const start = Math.max(0, index - 120);
  const end = Math.min(source.length, index + 260);

  return source.slice(start, end).replace(/\s+/g, " ").trim();
}

async function getExistingContentSha(repoFullName, path, token) {
  const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;

  const response = await fetch(url, {
    headers: githubHeaders(token)
  });

  if (response.status === 404) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || `Erro ao verificar arquivo existente: ${path}`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data.sha || null;
}

async function putGithubFile(repoFullName, branch, path, content, message, token) {
  const existingSha = await getExistingContentSha(repoFullName, path, token);

  const body = {
    message,
    content: toBase64(content),
    branch
  };

  if (existingSha) body.sha = existingSha;

  const response = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${path}`, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const messageText = data.message || `Erro ao gravar ${path} no GitHub`;
    const error = new Error(messageText);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return {
    contentSha: data.content?.sha || null,
    commitSha: data.commit?.sha || null,
    htmlUrl: data.content?.html_url || null
  };
}

async function fetchFileContent(repoFullName, filePath, token) {
  const encodedPath = String(filePath || "")
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const data = await fetchGithubJson(
    `https://api.github.com/repos/${repoFullName}/contents/${encodedPath}`,
    token
  );

  if (data.encoding !== "base64" || !data.content) {
    return {
      text: "",
      error: "Conteúdo não retornado como base64."
    };
  }

  const text = fromBase64(data.content);

  /*
    Checagem simples para evitar indexar binário interpretado como texto.
  */
  if (text.includes("\u0000")) {
    return {
      text: "",
      error: "Arquivo parece binário."
    };
  }

  return {
    text,
    error: null
  };
}

async function writeIndexFilesToGithub({
  token,
  indexRepoFullName,
  indexDefaultBranch,
  dataRepoFullName,
  dataDefaultBranch,
  sortMode,
  runId,
  files,
  createdAt
}) {
  const searchableFiles = files
    .filter(file => file.contentIndexed && file.contentText)
    .map(file => ({
      path: file.path,
      name: file.name,
      extension: file.extension,
      githubUrl: file.githubUrl,
      preview: file.contentPreview,
      text: file.contentText
    }));

  const manifest = {
    avdc: {
      version: "3.1.0",
      reservedDirectory: AVDC_INDEX_DIR,
      note: "Arquivos gerados pelo AVDC. Não editar manualmente."
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch,
      ignoredPaths: [`${AVDC_INDEX_DIR}/`, ".avdc-index/"]
    },
    index: {
      indexRepository: indexRepoFullName,
      indexDefaultBranch,
      manifestPath: MANIFEST_PATH,
      catalogPath: CATALOG_PATH,
      searchIndexPath: SEARCH_INDEX_PATH
    },
    run: {
      id: runId,
      sortMode,
      filesCount: files.length,
      searchableFilesCount: searchableFiles.length,
      createdAt
    }
  };

  const catalog = {
    avdc: {
      version: "3.1.0",
      type: "catalog"
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch
    },
    index: {
      indexRepository: indexRepoFullName,
      indexDefaultBranch
    },
    generatedAt: createdAt,
    files: files.map(file => ({
      path: file.path,
      directory: file.directory,
      name: file.name,
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      sha: file.sha,
      githubUrl: file.githubUrl,
      githubUpdatedAt: file.githubUpdatedAt,
      discoveredAt: file.discoveredAt,
      displayDate: file.githubUpdatedAt || file.discoveredAt,
      contentIndexed: !!file.contentIndexed,
      contentPreview: file.contentPreview || ""
    }))
  };

  const searchIndex = {
    avdc: {
      version: "3.1.0",
      type: "simple-search-index",
      note: "Busca simples por nome, caminho e texto extraído. Ainda não usa IA."
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch
    },
    generatedAt: createdAt,
    files: searchableFiles
  };

  const manifestResult = await putGithubFile(
    indexRepoFullName,
    indexDefaultBranch,
    MANIFEST_PATH,
    stableJson(manifest),
    "AVDC: atualizar manifesto do índice",
    token
  );

  const catalogResult = await putGithubFile(
    indexRepoFullName,
    indexDefaultBranch,
    CATALOG_PATH,
    stableJson(catalog),
    "AVDC: atualizar catálogo do índice",
    token
  );

  const searchResult = await putGithubFile(
    indexRepoFullName,
    indexDefaultBranch,
    SEARCH_INDEX_PATH,
    stableJson(searchIndex),
    "AVDC: atualizar índice simples de busca",
    token
  );

  return {
    manifestResult,
    catalogResult,
    searchResult
  };
}

// ===== Fase 1: leitura do índice direto do GitHub do cliente =====
// Premissa: nenhum dado do cliente no nosso banco. Catálogo e busca são lidos
// dos JSON gravados em /avdc-index/ no repositório de índice do próprio cliente.

async function fetchIndexJson(indexRepoFullName, branch, filePath, token) {
  const encodedPath = String(filePath || "")
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const url = `https://api.github.com/repos/${indexRepoFullName}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

  const response = await fetch(url, { headers: githubHeaders(token) });

  if (response.status === 404) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || `Erro ao ler ${filePath} no GitHub`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  if (!data.content) return null;

  try {
    return JSON.parse(fromBase64(String(data.content).replace(/\n/g, "")));
  } catch (parseError) {
    const error = new Error(`Conteúdo de ${filePath} não é JSON válido.`);
    error.status = 502;
    throw error;
  }
}

// Resolve o repositório de índice e o branch padrão dele para um usuário.
async function resolveIndexRepo(config, token) {
  const indexRepoFullName = config.selectedIndexRepoFullName || null;

  if (!indexRepoFullName) return null;

  const indexRepo = await fetchGithubJson(`https://api.github.com/repos/${indexRepoFullName}`, token);
  const branch = indexRepo.default_branch || "main";

  return { indexRepoFullName, branch };
}

// Carrega catalog.json e search-index.json do GitHub do cliente.
async function loadIndexFromGithub(config, token) {
  const resolved = await resolveIndexRepo(config, token);

  if (!resolved) return { catalog: null, searchIndex: null };

  const { indexRepoFullName, branch } = resolved;

  const [catalog, searchIndex] = await Promise.all([
    fetchIndexJson(indexRepoFullName, branch, CATALOG_PATH, token),
    fetchIndexJson(indexRepoFullName, branch, SEARCH_INDEX_PATH, token)
  ]);

  return { catalog, searchIndex, indexRepoFullName, branch };
}

// Ordena os arquivos do catálogo conforme o modo escolhido.
function sortCatalogFiles(files, sortMode) {
  const list = Array.isArray(files) ? files.slice() : [];

  if (sortMode === "updated_desc") {
    return list.sort((a, b) => {
      const da = a.displayDate || a.githubUpdatedAt || a.discoveredAt || "";
      const db = b.displayDate || b.githubUpdatedAt || b.discoveredAt || "";
      if (da && db && da !== db) return db.localeCompare(da);
      return String(a.path || "").toLowerCase().localeCompare(String(b.path || "").toLowerCase());
    });
  }

  return list.sort((a, b) =>
    String(a.path || "").toLowerCase().localeCompare(String(b.path || "").toLowerCase())
  );
}

// Pontua um arquivo do search-index (formato { name, path, extension, text, preview }).
function scoreIndexFile(file, terms) {
  const haystackName = normalizeText(`${file.name || ""} ${file.path || ""} ${file.extension || ""}`);
  const haystackContent = normalizeText(file.text || "");

  let score = 0;

  for (const term of terms) {
    if (haystackName.includes(term)) score += 8;
    if (haystackContent.includes(term)) score += 3;
  }

  if (terms.length > 1) {
    const phrase = terms.join(" ");
    if (haystackContent.includes(phrase)) score += 12;
    if (haystackName.includes(phrase)) score += 15;
  }

  return score;
}

router.get("/latest", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const config = await getUserGithubConfig(userId);
    const selectedDataRepoFullName = config?.selectedDataRepoFullName || config?.selectedRepoFullName || null;
    const selectedIndexRepoFullName = config?.selectedIndexRepoFullName || null;

    const emptyResponse = {
      ok: true,
      selectedRepoFullName: selectedDataRepoFullName,
      selectedDataRepoFullName,
      selectedIndexRepoFullName,
      run: null,
      files: []
    };

    if (!selectedDataRepoFullName || !selectedIndexRepoFullName || !config?.githubToken) {
      return res.json(emptyResponse);
    }

    const sortMode = normalizeSortMode(req.query.sortMode);
    const { catalog } = await loadIndexFromGithub(config, config.githubToken);

    if (!catalog || !Array.isArray(catalog.files)) {
      return res.json(emptyResponse);
    }

    const files = sortCatalogFiles(catalog.files, sortMode).slice(0, 500);

    res.json({
      ok: true,
      selectedRepoFullName: selectedDataRepoFullName,
      selectedDataRepoFullName,
      selectedIndexRepoFullName,
      run: {
        repoFullName: selectedDataRepoFullName,
        indexRepoFullName: selectedIndexRepoFullName,
        sortMode,
        filesCount: catalog.files.length,
        generatedAt: catalog.generatedAt || null,
        createdAt: catalog.generatedAt || null
      },
      files
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Erro ao carregar catálogo do índice." });
  }
});

router.get("/files", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sortMode = normalizeSortMode(req.query.sortMode);
    const config = await getUserGithubConfig(userId);
    const selectedDataRepoFullName = config?.selectedDataRepoFullName || config?.selectedRepoFullName || null;
    const selectedIndexRepoFullName = config?.selectedIndexRepoFullName || null;

    if (!selectedDataRepoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de dados selecionado." });
    }

    if (!selectedIndexRepoFullName || !config?.githubToken) {
      return res.json({ ok: true, run: null, files: [] });
    }

    const { catalog } = await loadIndexFromGithub(config, config.githubToken);

    if (!catalog || !Array.isArray(catalog.files)) {
      return res.json({ ok: true, run: null, files: [] });
    }

    const files = sortCatalogFiles(catalog.files, sortMode).slice(0, 500);

    res.json({
      ok: true,
      run: {
        repoFullName: selectedDataRepoFullName,
        indexRepoFullName: selectedIndexRepoFullName,
        sortMode,
        filesCount: catalog.files.length,
        generatedAt: catalog.generatedAt || null
      },
      files
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Erro ao listar arquivos do catálogo." });
  }
});

router.get("/search", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const q = String(req.query.q || "").trim();
    const terms = tokenize(q);

    if (terms.length === 0) {
      return res.json({ ok: true, query: q, results: [] });
    }

    const config = await getUserGithubConfig(userId);
    const selectedDataRepoFullName = config?.selectedDataRepoFullName || config?.selectedRepoFullName || null;
    const selectedIndexRepoFullName = config?.selectedIndexRepoFullName || null;

    if (!selectedDataRepoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de dados selecionado." });
    }

    if (!selectedIndexRepoFullName || !config?.githubToken) {
      return res.status(400).json({ error: "Nenhum repositório de índice selecionado." });
    }

    const { searchIndex } = await loadIndexFromGithub(config, config.githubToken);

    if (!searchIndex || !Array.isArray(searchIndex.files)) {
      return res.status(400).json({ error: "Nenhum índice de busca encontrado. Crie o catálogo primeiro." });
    }

    const scored = searchIndex.files
      .map(file => ({ file, score: scoreIndexFile(file, terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.file.path).localeCompare(String(b.file.path)))
      .slice(0, 30);

    const results = scored.map(item => ({
      score: item.score,
      name: item.file.name,
      path: item.file.path,
      extension: item.file.extension,
      githubUrl: item.file.githubUrl,
      contentIndexed: true,
      snippet: makeSnippet(item.file.text || item.file.preview || item.file.path, terms)
    }));

    res.json({
      ok: true,
      query: q,
      results
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Erro ao buscar no índice." });
  }
});

router.post("/prepare", async (req, res) => {
  const userId = req.session.user.id;
  const sortMode = normalizeSortMode(req.body.sortMode);
  const filters = req.body.filters || {};
  const filterExtensions = Array.isArray(filters.extensions) && filters.extensions.length > 0 ? new Set(filters.extensions.map(e => String(e).toLowerCase())) : null;
  const filterDirectories = Array.isArray(filters.directories) && filters.directories.length > 0 ? filters.directories.map(d => String(d).toLowerCase()) : null;
  const filterMinBytes = filters.minSizeKB ? Number(filters.minSizeKB) * 1024 : 0;
  const filterMaxBytes = filters.maxSizeMB ? Number(filters.maxSizeMB) * 1024 * 1024 : null;
  const filterPathContains = filters.pathContains ? String(filters.pathContains).toLowerCase() : null;
  let runId = null;

  try {
    const config = await getUserGithubConfig(userId);

    if (!config || Number(config.githubConnected) !== 1 || !config.githubToken) {
      return res.status(400).json({ error: "GitHub não conectado para este usuário." });
    }

    const selectedDataRepoFullName = config.selectedDataRepoFullName || config.selectedRepoFullName || null;
    const selectedIndexRepoFullName = config.selectedIndexRepoFullName || null;

    if (!selectedDataRepoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de dados selecionado." });
    }

    if (!selectedIndexRepoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de índice selecionado." });
    }

    const repoFullName = selectedDataRepoFullName;
    const indexRepoFullName = selectedIndexRepoFullName;
    const token = config.githubToken;
    const now = new Date().toISOString();

    const dataRepo = await fetchGithubJson(`https://api.github.com/repos/${repoFullName}`, token);
    const indexRepo = await fetchGithubJson(`https://api.github.com/repos/${indexRepoFullName}`, token);

    const defaultBranch = dataRepo.default_branch || "main";
    const indexDefaultBranch = indexRepo.default_branch || "main";

    // Fase 2: não gravamos mais a indexação no nosso banco.
    // runId é apenas um identificador local da execução, usado em logs e no manifest.
    runId = `local-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    const tree = await fetchGithubJson(
      `https://api.github.com/repos/${repoFullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      token
    );

    const rawFiles = Array.isArray(tree.tree)
      ? tree.tree.filter(item => item.type === "blob" && !isReservedAvdcIndexPath(item.path))
      : [];

    const discoveredAt = new Date().toISOString();

    // Aplicar filtros avançados se definidos
    function passesAdvancedFilters(item) {
      const { name, directory } = splitPath(item.path);
      const ext = extensionFromName(name).toLowerCase();
      const size = Number(item.size || 0);
      const pathLower = String(item.path || "").toLowerCase();

      if (filterExtensions && !filterExtensions.has(ext)) return false;
      if (filterDirectories && !filterDirectories.some(d => pathLower.startsWith(d))) return false;
      if (filterMinBytes && size < filterMinBytes) return false;
      if (filterMaxBytes && size > filterMaxBytes) return false;
      if (filterPathContains && !pathLower.includes(filterPathContains)) return false;

      return true;
    }

    const filteredRawFiles = (filterExtensions || filterDirectories || filterMinBytes || filterMaxBytes || filterPathContains)
      ? rawFiles.filter(passesAdvancedFilters)
      : rawFiles;

    console.log(`[AVDC] Filtro avançado: ${rawFiles.length} → ${filteredRawFiles.length} arquivos`);

    const files = filteredRawFiles.map(item => {
      const { name, directory } = splitPath(item.path);
      return {
        path: item.path,
        directory,
        name,
        extension: extensionFromName(name),
        githubType: item.type,
        sizeBytes: item.size ?? null,
        sha: item.sha || null,
        githubUrl: githubFileUrl(repoFullName, defaultBranch, item.path),
        githubCreatedAt: null,
        githubUpdatedAt: null,
        discoveredAt,
        contentIndexed: false,
        contentText: "",
        contentPreview: "",
        contentError: ""
      };
    });

    const dateLookupLimit = Number(process.env.AVDC_DATE_LOOKUP_LIMIT || "100");
    let dateLookupCount = 0;

    {
      const limit = Math.max(0, Math.min(files.length, dateLookupLimit));

      for (let i = 0; i < limit; i++) {
        files[i].githubUpdatedAt = await fetchLatestCommitDate(
          repoFullName,
          defaultBranch,
          files[i].path,
          token
        );

        if (files[i].githubUpdatedAt) dateLookupCount += 1;
      }
    }

    let contentIndexedCount = 0;
    let triedContentCount = 0;

    console.log(`[AVDC] Iniciando indexação de conteúdo. Total de arquivos descobertos: ${files.length}`);

    for (const file of files) {
      if (!shouldTryExtractContent(file)) continue;

      triedContentCount += 1;

      try {
        const result = await fetchFileContent(repoFullName, file.path, token);

        if (result.text) {
          file.contentText = result.text.slice(0, Number(process.env.AVDC_MAX_TEXT_CHARS || "200000"));
          file.contentPreview = safePreview(file.contentText);
          file.contentIndexed = true;
          contentIndexedCount += 1;
        } else {
          file.contentError = result.error || "Sem texto extraível.";
        }
      } catch (error) {
        file.contentError = error.message || String(error);
      }
    }

    console.log(`[AVDC] Indexação concluída. Tentados: ${triedContentCount} | Indexados: ${contentIndexedCount} | Total: ${files.length}`);

    // Fase 2: removido o INSERT em repo_index_files.
    // Nenhum dado do cliente (path, conteúdo, preview) é gravado no nosso banco.
    // O índice vive apenas no GitHub do cliente (writeIndexFilesToGithub).

    const writeResult = await writeIndexFilesToGithub({
      token,
      indexRepoFullName,
      indexDefaultBranch,
      dataRepoFullName: repoFullName,
      dataDefaultBranch: defaultBranch,
      sortMode,
      runId,
      files,
      createdAt: discoveredAt
    });

    const finishedAt = new Date().toISOString();

    // Fase 2: nada de UPDATE no banco. A resposta é montada a partir da memória
    // e dos JSON recém-gravados no GitHub do cliente.
    const responseFiles = sortCatalogFiles(
      files.map(file => ({
        path: file.path,
        directory: file.directory,
        name: file.name,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
        sha: file.sha,
        githubUrl: file.githubUrl,
        githubUpdatedAt: file.githubUpdatedAt,
        discoveredAt: file.discoveredAt,
        displayDate: file.githubUpdatedAt || file.discoveredAt,
        contentIndexed: !!file.contentIndexed,
        contentPreview: file.contentPreview || ""
      })),
      sortMode
    ).slice(0, 500);

    res.json({
      ok: true,
      run: {
        id: runId,
        repoFullName,
        indexRepoFullName,
        defaultBranch,
        sortMode,
        status: "completed",
        filesCount: files.length,
        truncated: !!tree.truncated,
        dateLookupCount,
        dateLookupLimit,
        indexWritten: true,
        indexManifestPath: MANIFEST_PATH,
        indexCatalogPath: CATALOG_PATH,
        indexSearchPath: SEARCH_INDEX_PATH,
        indexManifestCommitSha: writeResult.manifestResult.commitSha,
        indexCatalogCommitSha: writeResult.catalogResult.commitSha,
        indexSearchCommitSha: writeResult.searchResult.commitSha,
        indexWrittenAt: finishedAt,
        finishedAt,
        createdAt: discoveredAt
      },
      content: {
        tried: triedContentCount,
        indexed: contentIndexedCount
      },
      files: responseFiles
    });
  } catch (error) {
    console.error(error);

    // Fase 2: sem registro de falha no banco. O erro é apenas retornado e logado.
    res.status(error.status || 500).json({
      error: error.message || "Erro ao preparar catálogo do índice."
    });
  }
});


router.get("/scan", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const config = await getUserGithubConfig(userId);

    if (!config || Number(config.githubConnected) !== 1 || !config.githubToken) {
      return res.status(400).json({ error: "GitHub não conectado para este usuário." });
    }

    const repoFullName = config.selectedDataRepoFullName || config.selectedRepoFullName || null;

    if (!repoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de dados selecionado." });
    }

    const token = config.githubToken;
    const dataRepo = await fetchGithubJson(`https://api.github.com/repos/${repoFullName}`, token);
    const defaultBranch = dataRepo.default_branch || "main";

    const tree = await fetchGithubJson(
      `https://api.github.com/repos/${repoFullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      token
    );

    const blobs = Array.isArray(tree.tree)
      ? tree.tree.filter(item => item.type === "blob" && !isReservedAvdcIndexPath(item.path))
      : [];

    const extensionsSet = new Set();
    const directoriesSet = new Set();

    for (const item of blobs) {
      const { name, directory } = splitPath(item.path);
      const ext = extensionFromName(name);
      extensionsSet.add(ext);
      if (directory) directoriesSet.add(directory.split("/")[0]);
    }

    res.json({
      ok: true,
      repoFullName,
      totalFiles: blobs.length,
      extensions: Array.from(extensionsSet).sort(),
      directories: Array.from(directoriesSet).sort()
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Erro ao escanear repositório." });
  }
});

/*
  POST /api/index/note
  Guarda uma nota rápida (.vcd) na pasta /avdc-notes/ do repositório de DADOS.
  A nota é salva no repo de dados (não no de índice) justamente para entrar
  nas próximas indexações e ficar buscável pelo próprio sistema.

  Escopo intencionalmente mínimo: apenas cria o arquivo.
  Não edita, exclui, lista nem categoriza — isso fica por conta do usuário no GitHub.
*/
router.post("/note", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const rawName = String(req.body.name || "").trim();
    const content = String(req.body.content != null ? req.body.content : "");

    if (!rawName) {
      return res.status(400).json({ error: "Informe um nome para a nota." });
    }

    if (!content.trim()) {
      return res.status(400).json({ error: "A nota está vazia. Escreva algum conteúdo." });
    }

    const config = await getUserGithubConfig(userId);

    if (!config || Number(config.githubConnected) !== 1 || !config.githubToken) {
      return res.status(400).json({ error: "GitHub não conectado para este usuário." });
    }

    const dataRepoFullName = config.selectedDataRepoFullName || config.selectedRepoFullName || null;

    if (!dataRepoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de dados selecionado." });
    }

    const token = config.githubToken;

    const dataRepo = await fetchGithubJson(`https://api.github.com/repos/${dataRepoFullName}`, token);
    const branch = dataRepo.default_branch || "main";

    const slug = slugifyNoteName(rawName);
    const stamp = serverDateStamp();
    const suffix = randomNoteSuffix();
    const fileName = `${stamp}-${slug}-${suffix}.vcd`;
    const filePath = `${AVDC_NOTES_DIR}/${fileName}`;

    const commitMessage = `AVDC: nota rápida ${fileName}`;

    const result = await putGithubFile(
      dataRepoFullName,
      branch,
      filePath,
      content,
      commitMessage,
      token
    );

    res.json({
      ok: true,
      path: filePath,
      fileName,
      repoFullName: dataRepoFullName,
      branch,
      htmlUrl: result.htmlUrl || githubFileUrl(dataRepoFullName, branch, filePath)
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Erro ao guardar a nota." });
  }
});

module.exports = router;
