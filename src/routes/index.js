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
const SEMANTIC_INDEX_PATH = `${AVDC_INDEX_DIR}/semantic-index.json`;
const EXTRACTION_REPORT_PATH = `${AVDC_INDEX_DIR}/extraction-report.txt`;

const DEFAULT_MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB
const DEFAULT_MAX_TEXT_CHARS = 40000;
const DEFAULT_MAX_SEARCH_TEXT_CHARS = 12000;
const DEFAULT_MAX_SEARCH_INDEX_TOTAL_CHARS = 4 * 1024 * 1024; // ~4 MB de texto antes do JSON/base64
const GITHUB_WRITE_RETRY_STATUSES = new Set([502, 503, 504]);

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function isHiddenOrTechnicalPath(filePath) {
  const normalized = String(filePath || "").replace(/^\/+/, "").toLowerCase();
  const parts = normalized.split("/").filter(Boolean);
  const name = parts[parts.length - 1] || "";

  return (
    !normalized ||
    isReservedAvdcIndexPath(normalized) ||
    normalized === ".git" ||
    normalized.startsWith(".git/") ||
    normalized.includes("/.git/") ||
    name === ".gitkeep" ||
    name === ".keep" ||
    name === ".ds_store" ||
    name === "thumbs.db"
  );
}

function semanticFilePenalty(file) {
  const path = String(file?.path || "").replace(/^\/+/, "").toLowerCase();
  const ext = String(file?.extension || "").toLowerCase();
  const text = String(file?.text || file?.preview || "").trim();
  let penalty = 0;

  // Notas do AVDC são conteúdo auxiliar. Elas podem aparecer se forem muito relevantes,
  // mas não devem dominar a busca semântica de arquivos originais do repositório.
  if (path === "avdc-notes" || path.startsWith("avdc-notes/")) penalty += 18;
  if (ext === "vcd") penalty += 8;
  if (text.length < 20) penalty += 12;

  return penalty;
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
      selected_index_repo_full_name AS "selectedIndexRepoFullName",
      ai_provider AS "aiProvider",
      ai_base_url AS "aiBaseUrl",
      ai_model AS "aiModel",
      ai_token_encrypted AS "aiToken"
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
    console.warn("[AVDC] Não foi possível buscar data de um arquivo.");
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

function boundedEditDistance(a, b, maxDistance = 2) {
  a = String(a || "");
  b = String(b || "");

  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function textHasApproxTerm(text, term) {
  const normalizedTerm = normalizeText(term);
  if (normalizedTerm.length < 5) return false;

  const maxDistance = normalizedTerm.length >= 8 ? 2 : 1;
  const words = normalizeText(text)
    .split(/[^a-z0-9_]+/i)
    .filter(word => word.length >= Math.max(4, normalizedTerm.length - maxDistance) && word.length <= normalizedTerm.length + maxDistance);

  const unique = Array.from(new Set(words)).slice(0, 800);
  return unique.some(word => boundedEditDistance(word, normalizedTerm, maxDistance) <= maxDistance);
}

function textHasPrefixTerm(text, term) {
  const normalizedTerm = normalizeText(term);
  if (normalizedTerm.length < 4) return false;

  const prefix = normalizedTerm.slice(0, Math.min(5, normalizedTerm.length));
  const words = normalizeText(text)
    .split(/[^a-z0-9_]+/i)
    .filter(word => word.length >= prefix.length);

  const unique = Array.from(new Set(words)).slice(0, 1200);
  return unique.some(word => word.startsWith(prefix) || normalizedTerm.startsWith(word));
}

function textHasLoosePrefixTerm(text, term) {
  const normalizedTerm = normalizeText(term);
  if (normalizedTerm.length < 3) return false;

  // Usado somente como resgate/fallback da busca semântica.
  // Exemplo real validado: "brada" deve conseguir alcançar "bradesco"
  // antes de a IA classificar os candidatos.
  const prefix = normalizedTerm.slice(0, Math.min(4, normalizedTerm.length));
  const words = normalizeText(text)
    .split(/[^a-z0-9_]+/i)
    .filter(word => word.length >= prefix.length);

  const unique = Array.from(new Set(words)).slice(0, 1800);
  return unique.some(word => word.startsWith(prefix) || normalizedTerm.startsWith(word));
}

function shouldTryExtractContent(file) {
  const ext = String(file.extension || "").toLowerCase();
  const size = Number(file.sizeBytes || 0);
  const maxBytes = Number(process.env.AVDC_MAX_FILE_BYTES || DEFAULT_MAX_FILE_BYTES);

  if (size > maxBytes) {
    // Log sanitizado: não imprimir nome, path ou conteúdo do cliente.
    return false;
  }
  if (BINARY_EXTENSIONS.has(ext)) {
    // Log sanitizado: não imprimir nome, path ou conteúdo do cliente.
    return false;
  }
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Sem extensão ou extensão desconhecida: tenta ler como texto.
  // fetchFileContent descarta se for binário (null byte).
  if (size === 0) {
    // Log sanitizado: não imprimir nome, path ou conteúdo do cliente.
    return false;
  }

  // Log sanitizado: não imprimir nome, path ou conteúdo do cliente.
  return true;
}

function extractionReason(file) {
  if (!file || file.contentIndexed) return null;

  const ext = String(file.extension || "").toLowerCase();
  const size = Number(file.sizeBytes || 0);
  const maxBytes = Number(process.env.AVDC_MAX_FILE_BYTES || DEFAULT_MAX_FILE_BYTES);

  if (file.contentError) return file.contentError;
  if (size === 0) return "Arquivo vazio";
  if (size > maxBytes) return "Arquivo muito grande";
  if (BINARY_EXTENSIONS.has(ext)) return "Extensão binária conhecida";
  if (!ext) return "Tipo sem extensão sem conteúdo extraído";

  return "Tipo ainda não suportado";
}

function buildExtractionDetails(files) {
  return (files || [])
    .filter(file => !file.contentIndexed)
    .map(file => ({
      path: file.path,
      name: file.name,
      extension: file.extension || "",
      sizeBytes: file.sizeBytes,
      githubUrl: file.githubUrl,
      reason: extractionReason(file)
    }));
}

function buildExtractionReportText({
  dataRepoFullName,
  dataDefaultBranch,
  indexRepoFullName,
  indexDefaultBranch,
  runId,
  files,
  createdAt,
  writeExtractionReport = false
}) {
  const details = buildExtractionDetails(files);
  const indexedCount = (files || []).filter(file => file.contentIndexed).length;

  const lines = [];
  lines.push("AVDC V6 - Relatório técnico de extração");
  lines.push("");
  lines.push("Este relatório foi salvo no GitHub porque o usuário marcou essa opção antes da indexação.");
  lines.push("Para visualizar este relatório novamente, acesse diretamente o repositório de índice no GitHub.");
  lines.push("A ferramenta AVDC não reabre relatórios técnicos salvos; para ver os detalhes novamente pela interface, execute a indexação novamente.");
  lines.push("");
  lines.push(`Repositório de dados: ${dataRepoFullName || "-"}`);
  lines.push(`Branch dos dados: ${dataDefaultBranch || "-"}`);
  lines.push(`Repositório de índice: ${indexRepoFullName || "-"}`);
  lines.push(`Branch do índice: ${indexDefaultBranch || "-"}`);
  lines.push(`Execução: ${runId || "-"}`);
  lines.push(`Gerado em: ${createdAt || "-"}`);
  lines.push("");
  lines.push(`Arquivos no catálogo: ${(files || []).length}`);
  lines.push(`Conteúdo extraído: ${indexedCount}`);
  lines.push(`Sem conteúdo extraído: ${details.length}`);
  lines.push("");
  lines.push("Arquivos sem conteúdo extraído");
  lines.push("--------------------------------");

  if (details.length === 0) {
    lines.push("Nenhum arquivo sem conteúdo extraído nesta execução.");
  } else {
    details.forEach((file, index) => {
      lines.push(`${index + 1}. ${file.path || file.name || "-"}`);
      lines.push(`   Motivo: ${file.reason || "Não informado"}`);
      lines.push(`   Extensão: ${file.extension || "sem extensão"}`);
      lines.push(`   Tamanho: ${file.sizeBytes ?? "-"} bytes`);
      if (file.githubUrl) lines.push(`   GitHub: ${file.githubUrl}`);
      lines.push("");
    });
  }

  return lines.join("\n");
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

  const payload = JSON.stringify(body);
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${path}`, {
      method: "PUT",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json"
      },
      body: payload
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        contentSha: data.content?.sha || null,
        commitSha: data.commit?.sha || null,
        htmlUrl: data.content?.html_url || null
      };
    }

    const messageText = data.message || `Erro ao gravar ${path} no GitHub`;
    lastError = new Error(messageText);
    lastError.status = response.status;
    lastError.details = data;

    if (!GITHUB_WRITE_RETRY_STATUSES.has(response.status) || attempt === maxAttempts) {
      break;
    }

    console.warn(`[AVDC] GitHub retornou ${response.status} ao gravar ${path}. Tentativa ${attempt}/${maxAttempts}. Repetindo...`);
    await sleep(700 * attempt);
  }

  throw lastError;
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

function buildSearchableFiles(files) {
  const maxPerFile = envNumber("AVDC_MAX_SEARCH_TEXT_CHARS", DEFAULT_MAX_SEARCH_TEXT_CHARS);
  const maxTotal = envNumber("AVDC_MAX_SEARCH_INDEX_TOTAL_CHARS", DEFAULT_MAX_SEARCH_INDEX_TOTAL_CHARS);
  let used = 0;

  return (files || [])
    .filter(file => !isHiddenOrTechnicalPath(file.path || file.name))
    .map(file => {
      const originalText = String(file.contentText || "");
      const hasContent = !!(file.contentIndexed && originalText.trim());
      const fallbackText = [
        file.name,
        file.path,
        file.extension ? `extensao ${file.extension}` : ""
      ].filter(Boolean).join(" ");

      let text = "";
      let textTruncated = false;

      if (hasContent) {
        const remaining = Math.max(0, maxTotal - used);
        const limit = Math.min(maxPerFile, remaining);
        text = originalText.slice(0, limit);
        used += text.length;
        textTruncated = originalText.length > text.length;
      } else {
        // O índice simples continua tendo metadados mínimos para não ficar vazio,
        // mas ele é separado do índice semântico. A busca semântica não lê este arquivo.
        text = fallbackText;
      }

      return {
        path: file.path,
        name: file.name,
        extension: file.extension,
        githubUrl: file.githubUrl,
        preview: file.contentPreview || fallbackText,
        text,
        contentIndexed: !!file.contentIndexed,
        metadataOnly: !hasContent,
        textTruncated
      };
    })
    .filter(file => String(file.text || file.preview || file.path || file.name || "").trim().length > 0);
}

function buildSemanticIndexFiles(files) {
  const maxPerFile = envNumber("AVDC_MAX_SEMANTIC_TEXT_CHARS", envNumber("AVDC_MAX_SEARCH_TEXT_CHARS", DEFAULT_MAX_SEARCH_TEXT_CHARS));
  const maxTotal = envNumber("AVDC_MAX_SEMANTIC_INDEX_TOTAL_CHARS", envNumber("AVDC_MAX_SEARCH_INDEX_TOTAL_CHARS", DEFAULT_MAX_SEARCH_INDEX_TOTAL_CHARS));
  let used = 0;

  return (files || [])
    .filter(file => !isHiddenOrTechnicalPath(file.path || file.name))
    .map(file => {
      const originalText = String(file.contentText || "");
      const hasContent = !!(file.contentIndexed && originalText.trim());
      const fallbackText = [
        file.name,
        file.path,
        file.extension ? `extensao ${file.extension}` : "",
        file.directory ? `diretorio ${file.directory}` : ""
      ].filter(Boolean).join(" ");

      let text = "";
      let textTruncated = false;

      if (hasContent) {
        const remaining = Math.max(0, maxTotal - used);
        const limit = Math.min(maxPerFile, remaining);
        text = originalText.slice(0, limit);
        used += text.length;
        textTruncated = originalText.length > text.length;
      } else {
        // Premissa da V6.0.18: o índice semântico é separado, mas nunca vazio
        // quando o catálogo tem arquivos válidos. Arquivos sem conteúdo entram
        // com metadados pesquisáveis para seleção de candidatos antes da IA.
        text = fallbackText;
      }

      return {
        path: file.path,
        directory: file.directory,
        name: file.name,
        extension: file.extension,
        githubUrl: file.githubUrl,
        preview: file.contentPreview || fallbackText,
        text,
        contentIndexed: !!file.contentIndexed,
        metadataOnly: !hasContent,
        textTruncated
      };
    })
    .filter(file => String(file.text || file.preview || file.path || file.name || "").trim().length > 0);
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
  createdAt,
  writeExtractionReport = false
}) {
  const searchableFiles = buildSearchableFiles(files);
  const semanticFiles = buildSemanticIndexFiles(files);
  const metadataOnlyFilesCount = searchableFiles.filter(file => file.metadataOnly).length;
  const semanticMetadataOnlyFilesCount = semanticFiles.filter(file => file.metadataOnly).length;

  const manifest = {
    avdc: {
      version: "6.0.18",
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
      searchIndexPath: SEARCH_INDEX_PATH,
      semanticIndexPath: SEMANTIC_INDEX_PATH,
      extractionReportPath: writeExtractionReport ? EXTRACTION_REPORT_PATH : null
    },
    run: {
      id: runId,
      sortMode,
      filesCount: files.length,
      searchableFilesCount: searchableFiles.length,
      semanticFilesCount: semanticFiles.length,
      metadataOnlyFilesCount,
      semanticMetadataOnlyFilesCount,
      searchIndexTextLimitPerFile: envNumber("AVDC_MAX_SEARCH_TEXT_CHARS", DEFAULT_MAX_SEARCH_TEXT_CHARS),
      searchIndexTextLimitTotal: envNumber("AVDC_MAX_SEARCH_INDEX_TOTAL_CHARS", DEFAULT_MAX_SEARCH_INDEX_TOTAL_CHARS),
      semanticIndexTextLimitPerFile: envNumber("AVDC_MAX_SEMANTIC_TEXT_CHARS", envNumber("AVDC_MAX_SEARCH_TEXT_CHARS", DEFAULT_MAX_SEARCH_TEXT_CHARS)),
      semanticIndexTextLimitTotal: envNumber("AVDC_MAX_SEMANTIC_INDEX_TOTAL_CHARS", envNumber("AVDC_MAX_SEARCH_INDEX_TOTAL_CHARS", DEFAULT_MAX_SEARCH_INDEX_TOTAL_CHARS)),
      extractionReportEnabled: !!writeExtractionReport,
      createdAt
    }
  };

  const catalog = {
    avdc: {
      version: "6.0.18",
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
      version: "6.0.18",
      type: "simple-search-index",
      note: "Índice da busca simples. A busca semântica usa arquivo separado em /avdc-index/semantic-index.json."
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch
    },
    generatedAt: createdAt,
    files: searchableFiles
  };

  const semanticIndex = {
    avdc: {
      version: "6.0.18",
      type: "semantic-search-index",
      note: "Índice separado para busca semântica. Mantém metadados mínimos quando o conteúdo não é extraído, para seleção de candidatos antes da IA."
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch
    },
    generatedAt: createdAt,
    files: semanticFiles
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

  const semanticResult = await putGithubFile(
    indexRepoFullName,
    indexDefaultBranch,
    SEMANTIC_INDEX_PATH,
    stableJson(semanticIndex),
    "AVDC: atualizar índice semântico",
    token
  );

  let extractionReportResult = null;

  if (writeExtractionReport) {
    const extractionReportText = buildExtractionReportText({
      dataRepoFullName,
      dataDefaultBranch,
      indexRepoFullName,
      indexDefaultBranch,
      runId,
      files,
      createdAt
    });

    extractionReportResult = await putGithubFile(
      indexRepoFullName,
      indexDefaultBranch,
      EXTRACTION_REPORT_PATH,
      extractionReportText,
      "AVDC: atualizar relatório técnico de extração",
      token
    );
  }

  return {
    manifestResult,
    catalogResult,
    searchResult,
    semanticResult,
    extractionReportResult
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

  let rawText = "";

  if (data.content && data.encoding === "base64") {
    rawText = fromBase64(String(data.content).replace(/\n/g, ""));
  } else {
    // Arquivos maiores podem não vir no campo `content` da API /contents.
    // Nesse caso, buscamos o mesmo arquivo em modo raw, sem persistir nada localmente.
    const rawResponse = await fetch(url, {
      headers: {
        ...githubHeaders(token),
        "Accept": "application/vnd.github.raw+json"
      }
    });

    if (rawResponse.status === 404) return null;

    if (!rawResponse.ok) {
      const message = `Erro ao ler conteúdo raw de ${filePath} no GitHub`;
      const error = new Error(message);
      error.status = rawResponse.status;
      throw error;
    }

    rawText = await rawResponse.text();
  }

  if (!rawText.trim()) return null;

  try {
    return JSON.parse(rawText);
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

// Carrega catalog.json, search-index.json e semantic-index.json do GitHub do cliente.
async function loadIndexFromGithub(config, token) {
  const resolved = await resolveIndexRepo(config, token);

  if (!resolved) return { catalog: null, searchIndex: null, semanticIndex: null };

  const { indexRepoFullName, branch } = resolved;

  const [catalog, searchIndex, semanticIndex] = await Promise.all([
    fetchIndexJson(indexRepoFullName, branch, CATALOG_PATH, token),
    fetchIndexJson(indexRepoFullName, branch, SEARCH_INDEX_PATH, token),
    fetchIndexJson(indexRepoFullName, branch, SEMANTIC_INDEX_PATH, token)
  ]);

  return { catalog, searchIndex, semanticIndex, indexRepoFullName, branch };
}
async function buildSemanticIndexOnDemand(config, token, reason = "missing") {
  const dataRepoFullName = config.selectedDataRepoFullName || config.selectedRepoFullName || null;
  const indexRepoFullName = config.selectedIndexRepoFullName || null;

  if (!dataRepoFullName) {
    const error = new Error("Nenhum repositório de dados selecionado para criar o índice semântico.");
    error.status = 400;
    throw error;
  }

  if (!indexRepoFullName) {
    const error = new Error("Nenhum repositório de índice selecionado para salvar o índice semântico.");
    error.status = 400;
    throw error;
  }

  const [dataRepo, indexRepo] = await Promise.all([
    fetchGithubJson(`https://api.github.com/repos/${dataRepoFullName}`, token),
    fetchGithubJson(`https://api.github.com/repos/${indexRepoFullName}`, token)
  ]);

  const dataDefaultBranch = dataRepo.default_branch || "main";
  const indexDefaultBranch = indexRepo.default_branch || "main";
  const createdAt = new Date().toISOString();
  const runId = `semantic-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

  const tree = await fetchGithubJson(
    `https://api.github.com/repos/${dataRepoFullName}/git/trees/${encodeURIComponent(dataDefaultBranch)}?recursive=1`,
    token
  );

  const rawFiles = Array.isArray(tree.tree)
    ? tree.tree.filter(item => item.type === "blob" && !isReservedAvdcIndexPath(item.path) && !isHiddenOrTechnicalPath(item.path))
    : [];

  const files = rawFiles.map(item => {
    const { name, directory } = splitPath(item.path);
    return {
      path: item.path,
      directory,
      name,
      extension: extensionFromName(name),
      githubType: item.type,
      sizeBytes: item.size ?? null,
      sha: item.sha || null,
      githubUrl: githubFileUrl(dataRepoFullName, dataDefaultBranch, item.path),
      githubCreatedAt: null,
      githubUpdatedAt: null,
      discoveredAt: createdAt,
      contentIndexed: false,
      contentText: "",
      contentPreview: "",
      contentError: ""
    };
  });

  const contentLimit = Math.max(0, envNumber("AVDC_SEMANTIC_ON_DEMAND_CONTENT_LIMIT", 120));
  let triedContentCount = 0;
  let contentIndexedCount = 0;

  for (const file of files) {
    if (contentLimit && triedContentCount >= contentLimit) break;
    if (!shouldTryExtractContent(file)) continue;

    triedContentCount += 1;

    try {
      const result = await fetchFileContent(dataRepoFullName, file.path, token);
      if (result.text) {
        file.contentText = result.text.slice(0, envNumber("AVDC_MAX_TEXT_CHARS", DEFAULT_MAX_TEXT_CHARS));
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

  const semanticFiles = buildSemanticIndexFiles(files);
  const semanticIndex = {
    avdc: {
      version: "6.0.18",
      type: "semantic-search-index",
      generationMode: "on-demand",
      note: "Índice separado da busca semântica, criado/atualizado automaticamente na hora da busca quando ausente ou vazio."
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch
    },
    generatedAt: createdAt,
    run: {
      id: runId,
      reason,
      filesDiscovered: files.length,
      contentTried: triedContentCount,
      contentIndexed: contentIndexedCount,
      metadataOnlyFilesCount: semanticFiles.filter(file => file.metadataOnly).length,
      treeTruncated: !!tree.truncated
    },
    files: semanticFiles
  };

  const writeResult = await putGithubFile(
    indexRepoFullName,
    indexDefaultBranch,
    SEMANTIC_INDEX_PATH,
    stableJson(semanticIndex),
    "AVDC: criar índice semântico sob demanda",
    token
  );

  return {
    semanticIndex,
    semanticIndexPath: SEMANTIC_INDEX_PATH,
    semanticIndexCommitSha: writeResult.commitSha,
    semanticIndexContentSha: writeResult.contentSha,
    indexRepoFullName,
    indexDefaultBranch,
    createdAt,
    filesDiscovered: files.length,
    semanticFilesCount: semanticFiles.length,
    contentTried: triedContentCount,
    contentIndexed: contentIndexedCount,
    reason
  };
}


function searchIndexFiles(searchIndex) {
  return searchIndex && Array.isArray(searchIndex.files) ? searchIndex.files : null;
}

function buildEmptySearchIndexError(searchIndex, catalog) {
  const catalogCount = Array.isArray(catalog?.files) ? catalog.files.length : null;
  const generatedAt = searchIndex?.generatedAt || catalog?.generatedAt || null;
  const message = catalogCount && catalogCount > 0
    ? `O catálogo existe com ${catalogCount} arquivo(s), mas o search-index.json está vazio. Gere novamente o catálogo/índice para recriar o índice de busca.`
    : "O search-index.json está vazio. Gere o catálogo do índice antes de usar a busca.";

  const error = new Error(message);
  error.status = 409;
  error.payload = {
    code: "EMPTY_SEARCH_INDEX",
    catalogFilesCount: catalogCount,
    searchIndexFilesCount: 0,
    generatedAt,
    action: "Clique em Criar catálogo do índice / Gerar índice novamente para recriar /avdc-index/search-index.json."
  };
  return error;
}

function assertUsableSearchIndex(searchIndex, catalog) {
  const files = searchIndexFiles(searchIndex);
  if (!files) {
    const error = new Error("Nenhum índice de busca encontrado. Crie o catálogo primeiro.");
    error.status = 400;
    error.payload = { code: "SEARCH_INDEX_NOT_FOUND" };
    throw error;
  }
  if (files.length === 0) {
    throw buildEmptySearchIndexError(searchIndex, catalog);
  }
  return files;
}

function semanticIndexFiles(semanticIndex) {
  return semanticIndex && Array.isArray(semanticIndex.files) ? semanticIndex.files : null;
}

function buildEmptySemanticIndexError(semanticIndex, catalog) {
  const catalogCount = Array.isArray(catalog?.files) ? catalog.files.length : null;
  const generatedAt = semanticIndex?.generatedAt || catalog?.generatedAt || null;
  const error = new Error("O índice semântico foi criado ou carregado, mas não possui arquivos pesquisáveis.");
  error.status = 409;
  error.payload = {
    code: "EMPTY_SEMANTIC_INDEX",
    catalogFilesCount: catalogCount,
    semanticIndexFilesCount: 0,
    generatedAt,
    action: "Execute a busca semântica novamente ou gere o índice semântico sob demanda; o AVDC não depende do botão Criar catálogo para a semântica."
  };
  return error;
}

function assertUsableSemanticIndex(semanticIndex, catalog) {
  const files = semanticIndexFiles(semanticIndex);
  if (!files) {
    const error = new Error("Nenhum índice semântico encontrado. O AVDC deve criar /avdc-index/semantic-index.json automaticamente na hora da busca.");
    error.status = 400;
    error.payload = { code: "SEMANTIC_INDEX_NOT_FOUND", action: "Tente a busca semântica novamente; se persistir, verifique o repositório de índice e o token GitHub." };
    throw error;
  }
  if (files.length === 0) {
    throw buildEmptySemanticIndexError(semanticIndex, catalog);
  }
  return files;
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
  const rawName = `${file.name || ""} ${file.path || ""} ${file.extension || ""}`;
  const rawContent = file.text || file.preview || "";
  const haystackName = normalizeText(rawName);
  const haystackContent = normalizeText(rawContent);

  let score = 0;

  for (const term of terms) {
    if (haystackName.includes(term)) score += 8;
    if (haystackContent.includes(term)) score += 3;

    // Tolerância simples para erro de digitação, exemplo: "indentidade" vs "identidade".
    // Isso ajuda a busca semântica a escolher bons candidatos antes de chamar a IA.
    if (!haystackName.includes(term) && textHasApproxTerm(rawName, term)) score += 5;
    if (!haystackContent.includes(term) && textHasApproxTerm(rawContent, term)) score += 2;

    // Tolerância de prefixo para buscas incompletas, exemplo: "brada" encontrando "bradesco".
    // Isso evita que a busca semântica zere antes de chamar a IA.
    if (!haystackName.includes(term) && textHasPrefixTerm(rawName, term)) score += 4;
    if (!haystackContent.includes(term) && textHasPrefixTerm(rawContent, term)) score += 2;
  }

  if (terms.length > 1) {
    const phrase = terms.join(" ");
    if (haystackContent.includes(phrase)) score += 12;
    if (haystackName.includes(phrase)) score += 15;
  }

  return score;
}

function scoreIndexFileLoose(file, terms) {
  const rawName = `${file.name || ""} ${file.path || ""} ${file.extension || ""}`;
  const rawContent = file.text || file.preview || "";
  let score = scoreIndexFile(file, terms);

  for (const term of terms) {
    if (textHasLoosePrefixTerm(rawName, term)) score += 3;
    if (textHasLoosePrefixTerm(rawContent, term)) score += 1;
  }

  return score;
}

function semanticResultIdCandidates(item) {
  const values = [
    item?.id,
    item?.fileId,
    item?.candidateId,
    item?.candidate_id,
    item?.index,
    item?.path,
    item?.file,
    item?.name
  ];

  return values
    .filter(value => value !== undefined && value !== null)
    .map(value => String(value).trim())
    .filter(Boolean);
}

function resolveSemanticResultFile(item, maps) {
  for (const key of semanticResultIdCandidates(item)) {
    if (maps.byId.has(key)) return maps.byId.get(key);
    if (maps.byPath.has(key)) return maps.byPath.get(key);
    if (maps.byName.has(key.toLowerCase())) return maps.byName.get(key.toLowerCase());
  }

  return null;
}

function buildSemanticResultFromFile(file, score, reason, query) {
  return {
    score: Number(score || 0),
    name: file.name,
    path: file.path,
    extension: file.extension,
    githubUrl: file.githubUrl,
    contentIndexed: true,
    semanticReason: String(reason || "Candidato mantido pelo fallback seguro da busca semântica do AVDC.").slice(0, 220),
    snippet: makeSnippet(file.text || file.preview || file.path, tokenize(query)) || safePreview(file.text || file.preview || file.path, 420)
  };
}

function hasUserAiConfigured(config) {
  return !!(config?.aiProvider && config?.aiBaseUrl && config?.aiModel && (config?.aiToken || config?.aiProvider === "ollama"));
}

function normalizeSemanticMode(value) {
  return String(value || "optimized").toLowerCase() === "full" ? "full" : "optimized";
}

function aiChatCompletionsUrl(baseUrl) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/chat/completions`;
}

const SEMANTIC_LIMITS = {
  optimized: {
    candidates: 10,
    previewChars: 500,
    maxPromptChars: 7200,
    maxOutputTokens: 650
  },
  full: {
    candidates: 18,
    previewChars: 700,
    maxPromptChars: 11800,
    maxOutputTokens: 900
  }
};

function semanticLimitsForMode(mode = "optimized") {
  return mode === "full" ? SEMANTIC_LIMITS.full : SEMANTIC_LIMITS.optimized;
}

function compactSemanticText(value, maxChars) {
  return safePreview(String(value || "").replace(/\s+/g, " ").trim(), maxChars);
}

function rankSemanticCandidates(files, query, mode = "optimized", loose = false) {
  const terms = tokenize(query);
  const minimumScore = mode === "full" ? 1 : 2;

  const scoredAll = (files || [])
    .filter(file => !isHiddenOrTechnicalPath(file?.path || file?.name))
    .map(file => {
      const rawScore = loose ? scoreIndexFileLoose(file, terms) : scoreIndexFile(file, terms);
      const penalty = semanticFilePenalty(file);
      return { file, rawScore, penalty, score: rawScore - penalty };
    })
    .filter(item => item.rawScore > 0)
    .sort((a, b) => b.score - a.score || b.rawScore - a.rawScore || String(a.file.path || "").localeCompare(String(b.file.path || "")));

  const preferred = scoredAll.filter(item => item.score >= minimumScore);
  const source = preferred.length > 0 ? preferred : scoredAll.filter(item => item.score > -10);

  return source;
}

function semanticCandidateFiles(files, query, mode = "optimized") {
  const limits = semanticLimitsForMode(mode);
  let ranked = rankSemanticCandidates(files, query, mode, false);

  // O modo completo não pode morrer em zero quando a busca textual possui
  // candidatos aproximados. Ele pode ser mais amplo, mas ainda filtrado.
  if (ranked.length === 0 || (mode === "full" && ranked.length < Math.min(6, limits.candidates))) {
    const looseRanked = rankSemanticCandidates(files, query, mode, true);
    const seen = new Set(ranked.map(item => String(item.file?.path || item.file?.name || "")));
    for (const item of looseRanked) {
      const key = String(item.file?.path || item.file?.name || "");
      if (!seen.has(key)) {
        ranked.push(item);
        seen.add(key);
      }
    }
    ranked = ranked.sort((a, b) => b.score - a.score || b.rawScore - a.rawScore || String(a.file.path || "").localeCompare(String(b.file.path || "")));
  }

  return ranked.slice(0, limits.candidates).map(item => item.file);
}

function buildSemanticPayload(query, candidates, mode = "optimized") {
  const limits = semanticLimitsForMode(mode);
  const compact = candidates.map((file, index) => ({
    id: index + 1,
    path: compactSemanticText(file.path, 260),
    name: compactSemanticText(file.name, 140),
    extension: compactSemanticText(file.extension, 30),
    preview: compactSemanticText(file.text || file.preview || file.path, limits.previewChars)
  }));

  let prompt = [
    "Você classifica candidatos por relevância semântica para a busca do usuário.",
    `Pergunta: ${compactSemanticText(query, 500)}`,
    "",
    "Candidatos:",
    JSON.stringify(compact),
    "",
    "Responda APENAS com JSON válido neste formato exato, sem nenhuma palavra extra:",
    "{\"results\":[{\"id\":1,\"score\":0.95,\"reason\":\"curto\"}]}",
    "",
    "Regras obrigatórias:",
    "1. Apenas JSON válido, sem texto antes ou depois.",
    "2. Use apenas IDs fornecidos (1 até " + candidates.length + ").",
    "3. Score entre 0.5 e 1.0 (número decimal).",
    "4. Máximo 10 resultados.",
    "5. Reason com no máximo 40 caracteres.",
    "6. Sem explicações, comentários ou markdown."
  ].join("\n");

  let compacted = false;
  if (prompt.length > limits.maxPromptChars) {
    compacted = true;
    let previewLimit = Math.max(220, Math.floor(limits.previewChars * 0.55));
    while (prompt.length > limits.maxPromptChars && previewLimit >= 160) {
      const smaller = compact.map(item => ({
        ...item,
        preview: compactSemanticText(item.preview, previewLimit)
      }));
      prompt = [
        "Classifique por relevância semântica para: " + compactSemanticText(query, 200),
        "Candidatos: " + JSON.stringify(smaller),
        "Responda APENAS em JSON: {\"results\":[{\"id\":1,\"score\":0.9,\"reason\":\"x\"}]}",
        "Sem texto extra, apenas JSON válido, IDs de 1 a " + candidates.length + "."
      ].join("\n");
      previewLimit = Math.floor(previewLimit * 0.75);
    }
  }

  return { prompt: safePreview(prompt, limits.maxPromptChars), compacted, limits };
}

function isAiPayloadTooLargeMessage(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("request too large")
    || text.includes("tokens per min")
    || text.includes("tpm")
    || text.includes("maximum context")
    || text.includes("context length")
    || text.includes("reduce") && text.includes("tokens");
}

function parseAiSemanticJson(content) {
  const raw = String(content || "").trim();
  
  // Remove markdown code blocks
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const attempts = [cleaned];
  
  // Extrair JSON entre { }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  
  // Extrair array de objetos
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const arrayPart = cleaned.slice(firstBracket, lastBracket + 1);
    attempts.push(`{"results":${arrayPart}}`);
  }

  // Procurar por "results" em qualquer lugar
  const resultsMatch = cleaned.match(/"results"\s*:\s*\[([\s\S]*?)\]/i);
  if (resultsMatch) {
    attempts.push(`{"results":[${resultsMatch[1]}]}`);
  }

  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      const results = Array.isArray(parsed.results) ? parsed.results : Array.isArray(parsed) ? parsed : [];
      
      // Validar que cada resultado tem id e score
      const validResults = results.filter(r => 
        typeof r.id !== 'undefined' && 
        (typeof r.score === 'number' || typeof r.score === 'string')
      );
      
      if (validResults.length > 0) {
        return validResults.slice(0, 20); // Limitar a 20 resultados
      }
    } catch {
      // Tenta a próxima forma
    }
  }

  return [];
}

function fallbackSemanticResults(candidates, query, mode = "optimized", reason = "fallback") {
  const terms = tokenize(query);
  const limit = mode === "full" ? 18 : 10;

  return (candidates || [])
    .map((file, index) => {
      const rawScore = scoreIndexFile(file, terms);
      const looseScore = scoreIndexFileLoose(file, terms);
      const effectiveScore = Math.max(rawScore, looseScore);
      const score = effectiveScore - semanticFilePenalty(file);
      return { file, index, rawScore: effectiveScore, score };
    })
    .filter(item => item.rawScore > 0 && !isHiddenOrTechnicalPath(item.file?.path || item.file?.name))
    .sort((a, b) => b.score - a.score || b.rawScore - a.rawScore || String(a.file.path || "").localeCompare(String(b.file.path || "")))
    .slice(0, limit)
    .map(item => ({
      id: item.index + 1,
      score: Math.max(0.35, Math.min(0.86, Math.max(item.score, item.rawScore) / 30)),
      reason: reason === "empty_ai"
        ? "A IA não retornou resultados estruturados; candidato mantido pelo fallback seguro do índice do AVDC."
        : reason === "invalid_ai_ids"
          ? "A IA retornou resultados sem ID correspondente; candidato mantido pelo fallback seguro do índice do AVDC."
          : "Candidato selecionado pelo ranqueamento textual filtrado do AVDC antes da análise da IA."
    }));
}

async function callUserAiForSemanticSearch(config, query, candidates, mode = "optimized") {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
  };

  if (config.aiToken) {
    headers.Authorization = `Bearer ${config.aiToken}`;
  }

  const payload = buildSemanticPayload(query, candidates, mode);

  const response = await fetch(aiChatCompletionsUrl(config.aiBaseUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.aiModel,
      temperature: 0.1,
      max_tokens: payload.limits.maxOutputTokens,
      messages: [
        { role: "system", content: "Você classifica candidatos por relevância semântica para o AVDC. Responda curto e somente em JSON." },
        { role: "user", content: payload.prompt }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || data.message || `Motor de IA respondeu com status ${response.status}`;
    const error = new Error(
      isAiPayloadTooLargeMessage(message)
        ? "A busca semântica tentou enviar conteúdo demais para o limite atual do provedor/modelo. A V6.0.18 compacta automaticamente a consulta; tente novamente em modo otimizado ou com uma pergunta mais específica."
        : message
    );
    error.status = isAiPayloadTooLargeMessage(message) ? 413 : response.status;
    error.aiPayloadTooLarge = isAiPayloadTooLargeMessage(message);
    throw error;
  }

  const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
  const parsedResults = parseAiSemanticJson(content);
  const usedFallback = parsedResults.length === 0;

  return {
    results: usedFallback ? fallbackSemanticResults(candidates, query, mode, "empty_ai") : parsedResults,
    compacted: payload.compacted,
    usedFallback,
    candidatesSent: candidates.length,
    previewChars: payload.limits.previewChars,
    maxPromptChars: payload.limits.maxPromptChars,
    maxOutputTokens: payload.limits.maxOutputTokens
  };
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

    const { catalog, searchIndex } = await loadIndexFromGithub(config, config.githubToken);
    const indexFiles = assertUsableSearchIndex(searchIndex, catalog);

    const scored = indexFiles
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
    res.status(error.status || 500).json({ error: error.message || "Erro ao buscar no índice.", ...(error.payload || {}) });
  }
});


router.get("/search-semantic", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const q = String(req.query.q || "").trim();
    const mode = normalizeSemanticMode(req.query.mode);

    if (!q) {
      return res.status(400).json({ error: "Digite uma pergunta ou termo para a busca semântica." });
    }

    const config = await getUserGithubConfig(userId);
    const selectedDataRepoFullName = config?.selectedDataRepoFullName || config?.selectedRepoFullName || null;
    const selectedIndexRepoFullName = config?.selectedIndexRepoFullName || null;

    if (!hasUserAiConfigured(config)) {
      return res.status(400).json({
        error: "Busca semântica indisponível. Configure primeiro o Motor de IA deste usuário. A busca simples continua disponível sem IA."
      });
    }

    if (!selectedDataRepoFullName) {
      return res.status(400).json({ error: "Nenhum repositório de dados selecionado." });
    }

    if (!selectedIndexRepoFullName || !config?.githubToken) {
      return res.status(400).json({ error: "Nenhum repositório de índice selecionado." });
    }

    const { catalog, semanticIndex } = await loadIndexFromGithub(config, config.githubToken);
    let indexFiles = semanticIndexFiles(semanticIndex);
    let semanticIndexCreatedOnDemand = false;
    let semanticIndexBuild = null;

    if (!indexFiles || indexFiles.length === 0) {
      semanticIndexBuild = await buildSemanticIndexOnDemand(
        config,
        config.githubToken,
        !indexFiles ? "missing_before_search" : "empty_before_search"
      );
      semanticIndexCreatedOnDemand = true;
      indexFiles = semanticIndexFiles(semanticIndexBuild.semanticIndex);
    }

    if (!indexFiles || indexFiles.length === 0) {
      throw buildEmptySemanticIndexError(semanticIndexBuild?.semanticIndex || semanticIndex, catalog);
    }

    const candidates = semanticCandidateFiles(indexFiles, q, mode);

    if (candidates.length === 0) {
      return res.json({
        ok: true,
        query: q,
        mode,
        semantic: true,
        provider: config.aiProvider,
        model: config.aiModel,
        candidatesSelected: 0,
        semanticIndexFilesCount: indexFiles.length,
        semanticIndexCreatedOnDemand,
        semanticIndexPath: SEMANTIC_INDEX_PATH,
        semanticIndexBuild,
        warning: "O índice semântico existe, mas nenhum candidato textual foi compatível com a busca. Tente um termo mais próximo do nome/caminho/conteúdo indexado.",
        results: []
      });
    }

    const semanticResponse = await callUserAiForSemanticSearch(config, q, candidates, mode);
    let aiResults = semanticResponse.results || [];
    const candidateById = new Map(candidates.map((file, index) => [String(index + 1), file]));
    const candidateByPath = new Map(candidates.map(file => [String(file.path || ""), file]));
    const candidateByName = new Map(candidates.map(file => [String(file.name || "").toLowerCase(), file]));
    const maps = { byId: candidateById, byPath: candidateByPath, byName: candidateByName };

    let results = aiResults
      .map(item => {
        const file = resolveSemanticResultFile(item, maps);
        if (!file) return null;
        return buildSemanticResultFromFile(
          file,
          Number(item.score || 0),
          item.reason || "Relevante para a busca semântica.",
          q
        );
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    let usedMappingFallback = false;
    if (results.length === 0 && candidates.length > 0) {
      usedMappingFallback = true;
      aiResults = fallbackSemanticResults(candidates, q, mode, semanticResponse.usedFallback ? "empty_ai" : "invalid_ai_ids");
      results = aiResults
        .map(item => {
          const file = candidateById.get(String(item.id));
          if (!file) return null;
          return buildSemanticResultFromFile(file, Number(item.score || 0), item.reason, q);
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    }

    res.json({
      ok: true,
      query: q,
      mode,
      semantic: true,
      provider: config.aiProvider,
      model: config.aiModel,
      compacted: !!semanticResponse.compacted,
      usedFallback: !!semanticResponse.usedFallback || usedMappingFallback,
      mappingFallback: usedMappingFallback,
      candidatesSelected: candidates.length,
      candidatesSent: semanticResponse.candidatesSent,
      semanticIndexFilesCount: indexFiles.length,
      semanticIndexCreatedOnDemand,
      semanticIndexPath: SEMANTIC_INDEX_PATH,
      semanticIndexBuild,
      limits: {
        previewChars: semanticResponse.previewChars,
        maxPromptChars: semanticResponse.maxPromptChars,
        maxOutputTokens: semanticResponse.maxOutputTokens
      },
      warning: (semanticResponse.usedFallback || usedMappingFallback)
        ? "A IA não retornou resultado estruturado aproveitável; o AVDC exibiu os melhores candidatos do índice local."
        : semanticResponse.compacted
          ? "A consulta foi compactada automaticamente para respeitar o limite de tokens do provedor de IA."
          : null,
      results
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message || "Erro na busca semântica.", ...(error.payload || {}) });
  }
});

router.post("/prepare", async (req, res) => {
  const userId = req.session.user.id;
  const sortMode = normalizeSortMode(req.body.sortMode);
  const filters = req.body.filters || {};
  const writeExtractionReport = req.body.writeExtractionReport === true;
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
          file.contentText = result.text.slice(0, envNumber("AVDC_MAX_TEXT_CHARS", DEFAULT_MAX_TEXT_CHARS));
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
      createdAt: discoveredAt,
      writeExtractionReport
    });

    const finishedAt = new Date().toISOString();
    const extractionDetails = buildExtractionDetails(files);

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
        extractionReportEnabled: writeExtractionReport,
        extractionReportPath: writeExtractionReport ? EXTRACTION_REPORT_PATH : null,
        extractionReportCommitSha: writeResult.extractionReportResult?.commitSha || null,
        indexWrittenAt: finishedAt,
        finishedAt,
        createdAt: discoveredAt
      },
      content: {
        tried: triedContentCount,
        indexed: contentIndexedCount,
        withoutContent: files.length - contentIndexedCount
      },
      extractionDetails,
      extractionReport: {
        requested: writeExtractionReport,
        written: !!writeResult.extractionReportResult,
        path: writeExtractionReport ? EXTRACTION_REPORT_PATH : null,
        commitSha: writeResult.extractionReportResult?.commitSha || null
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
