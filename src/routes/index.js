const express = require("express");

const { query, getOne, getAll } = require("../db");
const { requireUser } = require("../middleware");

const router = express.Router();

router.use(requireUser);

const VALID_SORT_MODES = new Set(["alpha", "updated_desc"]);
const AVDC_INDEX_DIR = "avdc-index";
const MANIFEST_PATH = `${AVDC_INDEX_DIR}/manifest.json`;
const CATALOG_PATH = `${AVDC_INDEX_DIR}/catalog.json`;

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

async function getExistingContentSha(repoFullName, path, token) {
  const url = `https://api.github.com/repos/${repoFullName}/contents/${path}`;

  const response = await fetch(url, {
    headers: githubHeaders(token)
  });

  if (response.status === 404) {
    return null;
  }

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

  if (existingSha) {
    body.sha = existingSha;
  }

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
  const manifest = {
    avdc: {
      version: "3.0.2",
      reservedDirectory: AVDC_INDEX_DIR,
      note: "Arquivos gerados pelo AVDC. Não editar manualmente."
    },
    source: {
      dataRepository: dataRepoFullName,
      dataDefaultBranch,
      ignoredPaths: [
        `${AVDC_INDEX_DIR}/`,
        ".avdc-index/"
      ]
    },
    index: {
      indexRepository: indexRepoFullName,
      indexDefaultBranch,
      manifestPath: MANIFEST_PATH,
      catalogPath: CATALOG_PATH
    },
    run: {
      id: runId,
      sortMode,
      filesCount: files.length,
      createdAt
    }
  };

  const catalog = {
    avdc: {
      version: "3.0.2",
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
      displayDate: file.githubUpdatedAt || file.discoveredAt
    }))
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

  return {
    manifestResult,
    catalogResult
  };
}

function mapRun(row) {
  if (!row) return null;

  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    indexRepoFullName: row.index_repo_full_name,
    defaultBranch: row.default_branch,
    sortMode: row.sort_mode,
    status: row.status,
    filesCount: row.files_count,
    truncated: Number(row.truncated) === 1,
    dateLookupCount: row.date_lookup_count,
    dateLookupLimit: row.date_lookup_limit,
    indexWritten: Number(row.index_written) === 1,
    indexManifestPath: row.index_manifest_path,
    indexCatalogPath: row.index_catalog_path,
    indexWrittenAt: row.index_written_at,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapFile(row) {
  return {
    id: row.id,
    path: row.path,
    directory: row.directory,
    name: row.name,
    extension: row.extension,
    sizeBytes: row.size_bytes,
    sha: row.sha,
    githubUrl: row.github_url,
    githubCreatedAt: row.github_created_at,
    githubUpdatedAt: row.github_updated_at,
    discoveredAt: row.discovered_at,
    displayDate: row.github_updated_at || row.discovered_at
  };
}

async function getLatestRun(userId, repoFullName) {
  return getOne(`
    SELECT *
    FROM repo_index_runs
    WHERE user_id = $1
      AND repo_full_name = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId, repoFullName]);
}

async function getFilesForRun(runId, sortMode) {
  const orderBy = sortMode === "updated_desc"
    ? `github_updated_at DESC NULLS LAST, lower(path) ASC`
    : `lower(path) ASC`;

  return getAll(`
    SELECT *
    FROM repo_index_files
    WHERE run_id = $1
    ORDER BY ${orderBy}
    LIMIT 500
  `, [runId]);
}

router.get("/latest", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const config = await getUserGithubConfig(userId);
    const selectedDataRepoFullName = config?.selectedDataRepoFullName || config?.selectedRepoFullName || null;

    if (!selectedDataRepoFullName) {
      return res.json({
        ok: true,
        selectedRepoFullName: null,
        selectedDataRepoFullName: null,
        selectedIndexRepoFullName: config?.selectedIndexRepoFullName || null,
        run: null,
        files: []
      });
    }

    const sortMode = normalizeSortMode(req.query.sortMode);
    const run = await getLatestRun(userId, selectedDataRepoFullName);

    if (!run) {
      return res.json({
        ok: true,
        selectedRepoFullName: selectedDataRepoFullName,
        selectedDataRepoFullName,
        selectedIndexRepoFullName: config.selectedIndexRepoFullName || null,
        run: null,
        files: []
      });
    }

    const files = await getFilesForRun(run.id, sortMode);

    res.json({
      ok: true,
      selectedRepoFullName: selectedDataRepoFullName,
      selectedDataRepoFullName,
      selectedIndexRepoFullName: config.selectedIndexRepoFullName || null,
      run: mapRun(run),
      files: files.map(mapFile)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao carregar catálogo do índice."
    });
  }
});

router.get("/files", async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sortMode = normalizeSortMode(req.query.sortMode);
    const config = await getUserGithubConfig(userId);
    const selectedDataRepoFullName = config?.selectedDataRepoFullName || config?.selectedRepoFullName || null;

    if (!selectedDataRepoFullName) {
      return res.status(400).json({
        error: "Nenhum repositório de dados selecionado."
      });
    }

    const run = await getLatestRun(userId, selectedDataRepoFullName);

    if (!run) {
      return res.json({
        ok: true,
        run: null,
        files: []
      });
    }

    const files = await getFilesForRun(run.id, sortMode);

    res.json({
      ok: true,
      run: mapRun(run),
      files: files.map(mapFile)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao listar arquivos do catálogo."
    });
  }
});

router.post("/prepare", async (req, res) => {
  const userId = req.session.user.id;
  const sortMode = normalizeSortMode(req.body.sortMode);

  let runId = null;

  try {
    const config = await getUserGithubConfig(userId);

    if (!config || Number(config.githubConnected) !== 1 || !config.githubToken) {
      return res.status(400).json({
        error: "GitHub não conectado para este usuário."
      });
    }

    const selectedDataRepoFullName = config.selectedDataRepoFullName || config.selectedRepoFullName || null;
    const selectedIndexRepoFullName = config.selectedIndexRepoFullName || null;

    if (!selectedDataRepoFullName) {
      return res.status(400).json({
        error: "Nenhum repositório de dados selecionado."
      });
    }

    if (!selectedIndexRepoFullName) {
      return res.status(400).json({
        error: "Nenhum repositório de índice selecionado."
      });
    }

    const repoFullName = selectedDataRepoFullName;
    const indexRepoFullName = selectedIndexRepoFullName;
    const token = config.githubToken;
    const now = new Date().toISOString();

    const dataRepo = await fetchGithubJson(`https://api.github.com/repos/${repoFullName}`, token);
    const indexRepo = await fetchGithubJson(`https://api.github.com/repos/${indexRepoFullName}`, token);

    const defaultBranch = dataRepo.default_branch || "main";
    const indexDefaultBranch = indexRepo.default_branch || "main";

    const startResult = await query(`
      INSERT INTO repo_index_runs (
        user_id,
        repo_full_name,
        index_repo_full_name,
        default_branch,
        sort_mode,
        status,
        started_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'running', $6, $6, $6)
      RETURNING id
    `, [userId, repoFullName, indexRepoFullName, defaultBranch, sortMode, now]);

    runId = startResult.rows[0].id;

    const tree = await fetchGithubJson(
      `https://api.github.com/repos/${repoFullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`,
      token
    );

    const rawFiles = Array.isArray(tree.tree)
      ? tree.tree.filter(item => item.type === "blob" && !isReservedAvdcIndexPath(item.path))
      : [];

    const discoveredAt = new Date().toISOString();

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
        githubUrl: githubFileUrl(repoFullName, defaultBranch, item.path),
        githubCreatedAt: null,
        githubUpdatedAt: null,
        discoveredAt
      };
    });

    /*
      A árvore simples do GitHub não traz data de criação do arquivo.
      Nesta versão, se o usuário escolher "mais recentes", buscamos a ÚLTIMA ALTERAÇÃO
      em modo conservador, só até AVDC_DATE_LOOKUP_LIMIT arquivos.
    */
    const dateLookupLimit = Number(process.env.AVDC_DATE_LOOKUP_LIMIT || "100");
    let dateLookupCount = 0;

    /*
      v3.0.2:
      Agora tentamos buscar a última alteração sempre, não apenas quando a ordenação
      escolhida é "mais recentes". Isso evita coluna de data vazia na tela.
      Para repositórios grandes, mantemos limite configurável.
      Se não conseguirmos a data do GitHub, a interface usa discoveredAt como fallback.
    */
    {
      const limit = Math.max(0, Math.min(files.length, dateLookupLimit));

      for (let i = 0; i < limit; i++) {
        files[i].githubUpdatedAt = await fetchLatestCommitDate(
          repoFullName,
          defaultBranch,
          files[i].path,
          token
        );

        if (files[i].githubUpdatedAt) {
          dateLookupCount += 1;
        }
      }
    }

    for (const file of files) {
      await query(`
        INSERT INTO repo_index_files (
          run_id,
          user_id,
          repo_full_name,
          default_branch,
          path,
          directory,
          name,
          extension,
          github_type,
          size_bytes,
          sha,
          github_url,
          github_created_at,
          github_updated_at,
          discovered_at,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $15, $15
        )
      `, [
        runId,
        userId,
        repoFullName,
        defaultBranch,
        file.path,
        file.directory,
        file.name,
        file.extension,
        file.githubType,
        file.sizeBytes,
        file.sha,
        file.githubUrl,
        file.githubCreatedAt,
        file.githubUpdatedAt,
        file.discoveredAt
      ]);
    }

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

    await query(`
      UPDATE repo_index_runs
      SET
        status = 'completed',
        files_count = $1,
        truncated = $2,
        date_lookup_count = $3,
        date_lookup_limit = $4,
        index_written = 1,
        index_manifest_path = $5,
        index_catalog_path = $6,
        index_manifest_commit_sha = $7,
        index_catalog_commit_sha = $8,
        index_written_at = $9,
        finished_at = $9,
        updated_at = $9
      WHERE id = $10
    `, [
      files.length,
      tree.truncated ? 1 : 0,
      dateLookupCount,
      dateLookupLimit,
      MANIFEST_PATH,
      CATALOG_PATH,
      writeResult.manifestResult.commitSha,
      writeResult.catalogResult.commitSha,
      finishedAt,
      runId
    ]);

    const run = await getOne(`SELECT * FROM repo_index_runs WHERE id = $1`, [runId]);
    const visibleFiles = await getFilesForRun(runId, sortMode);

    res.json({
      ok: true,
      run: mapRun(run),
      files: visibleFiles.map(mapFile)
    });
  } catch (error) {
    console.error(error);

    if (runId) {
      const failedAt = new Date().toISOString();

      await query(`
        UPDATE repo_index_runs
        SET
          status = 'failed',
          error_message = $1,
          finished_at = $2,
          updated_at = $2
        WHERE id = $3
      `, [error.message || String(error), failedAt, runId]);
    }

    res.status(error.status || 500).json({
      error: error.message || "Erro ao preparar catálogo do índice."
    });
  }
});

module.exports = router;
