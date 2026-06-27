/*
 * AVDC v5.0 — Prioridade 1
 * Interface limpa para listagens grandes.
 *
 * Regras desta camada:
 * - listagens recolhidas por padrão;
 * - botões de abrir/ocultar perto do resumo;
 * - paginação visual com 15 itens por página;
 * - pastas técnicas ignoradas na listagem do catálogo.
 */

(function () {
  const PAGE_SIZE = 15;

  let avdcRepoList = [];
  let avdcRepoOpen = false;
  let avdcRepoPage = 1;

  let avdcCatalogFiles = [];
  let avdcCatalogIgnored = 0;
  let avdcCatalogOpen = false;
  let avdcCatalogPage = 1;

  function byId(id) {
    return document.getElementById(id);
  }

  function injectV5Styles() {
    if (document.getElementById("avdc-v5-style")) return;

    const style = document.createElement("style");
    style.id = "avdc-v5-style";
    style.textContent = `
      .avdc-v5-summary {
        background: var(--bg-color);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 14px;
        margin-top: 14px;
      }

      .avdc-v5-summary p {
        margin-bottom: 6px;
      }

      .avdc-v5-list {
        margin-top: 14px;
      }

      .avdc-v5-pagination {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin: 12px 0;
      }

      .avdc-v5-pagination span {
        color: var(--text-support);
        font-size: 13px;
      }

      .avdc-v5-pagination .btn {
        margin-top: 0;
      }

      .avdc-v5-muted {
        color: var(--text-support);
        font-size: 13px;
        opacity: 0.9;
      }

      .avdc-v5-control-btn {
        margin-top: 10px;
      }
    `;

    document.head.appendChild(style);
  }

  function isReservedPath(path) {
    const value = String(path || "")
      .replace(/^\/+/, "")
      .toLowerCase();

    return (
      value === ".git" ||
      value.startsWith(".git/") ||
      value === "avdc-index" ||
      value.startsWith("avdc-index/") ||
      value === ".avdc-index" ||
      value.startsWith(".avdc-index/")
    );
  }

  function paginate(items, page) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * PAGE_SIZE;
    const endIndex = Math.min(startIndex + PAGE_SIZE, total);

    return {
      total,
      totalPages,
      page: safePage,
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex)
    };
  }

  function renderPager({ prefix, page, totalPages, startIndex, endIndex, total, label }) {
    if (total === 0) return "";

    const previousDisabled = page <= 1 ? "disabled" : "";
    const nextDisabled = page >= totalPages ? "disabled" : "";

    return `
      <div class="avdc-v5-pagination">
        <span>Mostrando ${startIndex + 1}–${endIndex} de ${total} ${label}</span>
        <button class="btn btn-secondary" id="${prefix}-prev" type="button" ${previousDisabled}>Anterior</button>
        <button class="btn btn-secondary" id="${prefix}-next" type="button" ${nextDisabled}>Próxima</button>
      </div>
    `;
  }

  function bindPager(prefix, onPrevious, onNext) {
    const previous = byId(`${prefix}-prev`);
    const next = byId(`${prefix}-next`);

    if (previous) previous.onclick = onPrevious;
    if (next) next.onclick = onNext;
  }

  function repoItemHTML(repo) {
    return `
      <div class="repo-item ${repo.isDataRepo || repo.isIndexRepo ? "repo-active" : ""}">
        <div>
          <p>
            <strong>${escapeHTML(repo.fullName)}</strong>
            ${repo.isDataRepo ? '<span class="badge badge-ok">Dados</span>' : ""}
            ${repo.isIndexRepo ? '<span class="badge badge-ok">Índice</span>' : ""}
          </p>
          <p>${repo.private ? "Privado" : "Público"} · branch padrão: ${escapeHTML(repo.defaultBranch || "-")}</p>
          <p class="code">${escapeHTML(repo.htmlUrl || "")}</p>
        </div>
        <div class="repo-actions">
          <button class="btn" onclick="selectDataRepo('${escapeAttr(repo.fullName)}')">
            ${repo.isDataRepo ? "Fonte de dados" : "Usar como dados"}
          </button>
          <button class="btn btn-secondary" onclick="selectIndexRepo('${escapeAttr(repo.fullName)}')">
            ${repo.isIndexRepo ? "Repo de índice" : "Usar como índice"}
          </button>
        </div>
      </div>
    `;
  }

  function renderRepoListV5() {
    const box = byId("repos-container");
    if (!box) return;

    if (!avdcRepoList || avdcRepoList.length === 0) {
      box.innerHTML = "<p>Nenhum repositório encontrado.</p>";
      return;
    }

    const pageData = paginate(avdcRepoList, avdcRepoPage);
    avdcRepoPage = pageData.page;

    box.innerHTML = `
      <div class="avdc-v5-summary">
        <p><strong>Repositórios carregados.</strong></p>
        <p>${avdcRepoList.length} repositório(s) encontrado(s).</p>
        <button class="btn avdc-v5-control-btn" id="btn-toggle-repo-list" type="button">
          ${avdcRepoOpen ? "Ocultar listagem de repositórios" : "Ver listagem de repositórios"}
        </button>
      </div>

      ${avdcRepoOpen ? `
        <div class="avdc-v5-list">
          ${renderPager({
            prefix: "repo-list",
            page: pageData.page,
            totalPages: pageData.totalPages,
            startIndex: pageData.startIndex,
            endIndex: pageData.endIndex,
            total: pageData.total,
            label: "repositório(s)"
          })}

          ${pageData.visibleItems.map(repoItemHTML).join("")}
        </div>
      ` : ""}
    `;

    byId("btn-toggle-repo-list").onclick = () => {
      avdcRepoOpen = !avdcRepoOpen;
      if (avdcRepoOpen) avdcRepoPage = 1;
      renderRepoListV5();
    };

    bindPager(
      "repo-list",
      () => {
        avdcRepoPage -= 1;
        renderRepoListV5();
      },
      () => {
        avdcRepoPage += 1;
        renderRepoListV5();
      }
    );
  }

  function catalogRowHTML(file) {
    return `
      <tr>
        <td><a href="${escapeAttr(file.githubUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHTML(file.name || "-")}</a></td>
        <td>${escapeHTML(file.extension || "-")}</td>
        <td class="code">${escapeHTML(file.path || "-")}</td>
        <td>${formatBytes(file.sizeBytes)}</td>
        <td>${formatDate(file.displayDate || file.githubUpdatedAt || file.discoveredAt)}</td>
      </tr>
    `;
  }

  function renderCatalogFilesV5() {
    const box = byId("catalog-container");
    if (!box) return;

    if (!avdcCatalogFiles || avdcCatalogFiles.length === 0) {
      const ignoredText = avdcCatalogIgnored > 0
        ? `<p class="avdc-v5-muted">Pastas técnicas e reservadas foram ignoradas automaticamente.</p>`
        : "";

      box.innerHTML = `
        <div class="avdc-v5-summary">
          <p><strong>Catálogo criado.</strong></p>
          <p>Nenhum arquivo no catálogo.</p>
          ${ignoredText}
        </div>
      `;
      return;
    }

    const pageData = paginate(avdcCatalogFiles, avdcCatalogPage);
    avdcCatalogPage = pageData.page;

    const ignoredText = avdcCatalogIgnored > 0
      ? `<p class="avdc-v5-muted">Pastas técnicas e reservadas foram ignoradas automaticamente.</p>`
      : "";

    box.innerHTML = `
      <div class="avdc-v5-summary">
        <p><strong>Catálogo criado.</strong></p>
        <p>${avdcCatalogFiles.length} arquivo(s) no catálogo.</p>
        ${ignoredText}
        <button class="btn avdc-v5-control-btn" id="btn-toggle-catalog-files" type="button">
          ${avdcCatalogOpen ? "Ocultar arquivos do catálogo" : "Ver arquivos do catálogo"}
        </button>
      </div>

      ${avdcCatalogOpen ? `
        <div class="avdc-v5-list">
          ${renderPager({
            prefix: "catalog-files",
            page: pageData.page,
            totalPages: pageData.totalPages,
            startIndex: pageData.startIndex,
            endIndex: pageData.endIndex,
            total: pageData.total,
            label: "arquivo(s) do catálogo"
          })}

          <div class="catalog-table-wrap">
            <table class="catalog-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Extensão</th>
                  <th>Caminho</th>
                  <th>Tamanho</th>
                  <th>Última alteração</th>
                </tr>
              </thead>
              <tbody>
                ${pageData.visibleItems.map(catalogRowHTML).join("")}
              </tbody>
            </table>
          </div>
        </div>
      ` : ""}
    `;

    byId("btn-toggle-catalog-files").onclick = () => {
      avdcCatalogOpen = !avdcCatalogOpen;
      if (avdcCatalogOpen) avdcCatalogPage = 1;
      renderCatalogFilesV5();
    };

    bindPager(
      "catalog-files",
      () => {
        avdcCatalogPage -= 1;
        renderCatalogFilesV5();
      },
      () => {
        avdcCatalogPage += 1;
        renderCatalogFilesV5();
      }
    );
  }

  window.loadRepos = async function loadReposV5() {
    try {
      const data = await api("/auth/github/repos");
      avdcRepoList = data.repos || [];
      avdcRepoOpen = false;
      avdcRepoPage = 1;

      renderRepoListV5();
      msg("repos-msg", `${avdcRepoList.length} repositório(s) carregado(s).`, "ok");
    } catch (err) {
      msg("repos-msg", err.message, "error");
    }
  };

  window.renderCatalogFiles = function renderCatalogFilesOverride(files) {
    const originalFiles = files || [];
    avdcCatalogFiles = originalFiles.filter(file => !isReservedPath(file.path));
    avdcCatalogIgnored = originalFiles.length - avdcCatalogFiles.length;
    avdcCatalogOpen = false;
    avdcCatalogPage = 1;

    renderCatalogFilesV5();
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectV5Styles();

    const loadReposButton = byId("btn-load-repos");
    if (loadReposButton) loadReposButton.onclick = window.loadRepos;
  });
})();
