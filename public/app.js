let cachedUsers = [];
let lastCreatedToken = "";

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erro na requisição.");
  }

  return data;
}

function msg(id, text, type = "ok") {
  const el = $(id);
  if (!el) return;

  el.textContent = text;
  el.className = "msg " + type;
}

function switchLoginTab(type) {
  $("tab-admin").classList.toggle("active", type === "admin");
  $("tab-user").classList.toggle("active", type === "user");

  $("form-admin").classList.toggle("hidden", type !== "admin");
  $("form-user").classList.toggle("hidden", type !== "user");

  msg("login-msg", "", "");
}

function showAdminPage(page) {
  ["dashboard", "usuarios", "senha", "futuro"].forEach(p => {
    $("page-" + p).classList.add("hidden");
  });

  $("page-" + page).classList.remove("hidden");

  document.querySelectorAll(".menu button").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  if (page === "dashboard") loadDashboard();
  if (page === "usuarios") loadUsers();
}

async function loginAdmin(event) {
  event.preventDefault();

  try {
    const data = await api("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({
        adminUser: $("admin-user").value.trim(),
        adminPassword: $("admin-pass").value.trim()
      })
    });

    $("login-screen").classList.add("hidden");
    $("admin-screen").classList.remove("hidden");
    $("user-screen").classList.add("hidden");

    $("logged-as").textContent = data.admin.user;

    loadDashboard();
    loadUsers();
  } catch (err) {
    msg("login-msg", err.message, "error");
  }
}

async function loginUser(event) {
  event.preventDefault();

  try {
    const data = await api("/api/auth/user/login", {
      method: "POST",
      body: JSON.stringify({
        userCode: $("login-user-code").value.trim(),
        userToken: $("login-user-token").value.trim()
      })
    });

    $("login-screen").classList.add("hidden");
    $("admin-screen").classList.add("hidden");
    $("user-screen").classList.remove("hidden");

    $("user-logged-as").textContent = `${data.user.name} (${data.user.userCode})`;
    $("user-name-view").textContent = data.user.name;
    $("user-code-view").textContent = data.user.userCode;

    await loadUserProfile();
  } catch (err) {
    msg("login-msg", err.message, "error");
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/";
}

async function loadDashboard() {
  try {
    const data = await api("/api/admin/dashboard");

    $("total-users").textContent = data.totalUsers;
    $("active-users").textContent = data.activeUsers;
  } catch (err) {
    console.error(err);
  }
}

function normalizeUserCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function suggestUserCode() {
  const name = $("new-user-name").value.trim();
  const code = normalizeUserCode(name).replaceAll("-", ".");
  $("new-user-code").value = code;
}

async function createUser() {
  $("new-user-result").classList.add("hidden");

  try {
    const data = await api("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: $("new-user-name").value.trim(),
        userCode: $("new-user-code").value.trim()
      })
    });

    const user = data.user;
    lastCreatedToken = user.userToken;

    $("created-name").textContent = user.name;
    $("created-code").textContent = user.userCode;
    $("created-token").textContent = user.userToken;
    $("new-user-result").classList.remove("hidden");

    $("new-user-name").value = "";
    $("new-user-code").value = "";

    msg("create-user-msg", "Usuário criado com sucesso.", "ok");

    loadUsers();
    loadDashboard();
  } catch (err) {
    msg("create-user-msg", err.message, "error");
  }
}

async function copyCreatedToken() {
  if (!lastCreatedToken) return;

  await navigator.clipboard.writeText(lastCreatedToken);
  msg("create-user-msg", "Token copiado.", "ok");
}

async function loadUsers() {
  try {
    const data = await api("/api/admin/users");
    cachedUsers = data.users;
    renderUsers();
  } catch (err) {
    $("users-container").textContent = err.message;
  }
}

function renderUsers() {
  const filter = ($("user-filter")?.value || "").toLowerCase().trim();
  const box = $("users-container");

  const users = cachedUsers.filter(user =>
    !filter ||
    user.name.toLowerCase().includes(filter) ||
    user.userCode.toLowerCase().includes(filter)
  );

  if (users.length === 0) {
    box.innerHTML = "Nenhum usuário encontrado.";
    return;
  }

  box.innerHTML = users.map(user => `
    <div class="item">
      <p>
        <strong>${escapeHTML(user.name)}</strong>
        <span class="badge ${user.status === "active" ? "badge-ok" : "badge-warning"}">${escapeHTML(user.status)}</span>
      </p>

      <div class="user-meta">
        <p>Código: <span class="code">${escapeHTML(user.userCode)}</span></p>
        <p>Token: <span class="badge">${escapeHTML(user.userToken)}</span></p>
        <p>Criado: ${formatDate(user.createdAt)}</p>
        <p>Atualizado: ${formatDate(user.updatedAt)}</p>
      </div>

      <div class="user-actions">
        <button class="btn" onclick="copyText('${escapeAttr(user.userToken)}')">Copiar token</button>
        <button class="btn btn-warning" onclick="regenerateToken(${user.id})">Gerar novo token</button>
        <button class="btn btn-secondary" onclick="toggleStatus(${user.id}, '${user.status === "active" ? "inactive" : "active"}')">
          ${user.status === "active" ? "Inativar" : "Ativar"}
        </button>
        <button class="btn btn-danger" onclick="deleteUser(${user.id})">Excluir</button>
      </div>
    </div>
  `).join("");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  alert("Copiado: " + text);
}

async function regenerateToken(id) {
  if (!confirm("Gerar novo token? O token anterior deixará de funcionar.")) return;

  try {
    const data = await api(`/api/admin/users/${id}/regenerate-token`, {
      method: "POST"
    });

    alert("Novo token: " + data.userToken);

    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

async function toggleStatus(id, status) {
  try {
    await api(`/api/admin/users/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });

    loadUsers();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteUser(id) {
  if (!confirm("Excluir usuário? Esta ação remove o usuário do banco administrativo.")) return;

  try {
    await api(`/api/admin/users/${id}`, {
      method: "DELETE"
    });

    loadUsers();
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

async function changeAdminPassword() {
  try {
    await api("/api/admin/change-password", {
      method: "POST",
      body: JSON.stringify({
        newPassword: $("new-admin-pass").value.trim()
      })
    });

    $("new-admin-pass").value = "";

    msg("admin-pass-msg", "Senha alterada com sucesso.", "ok");
  } catch (err) {
    msg("admin-pass-msg", err.message, "error");
  }
}

async function loadUserProfile() {
  try {
    const data = await api("/api/user/profile");
    renderGithubStatus(data.github); renderRepositoryStatus(data.repository); await loadLatestCatalog();
  } catch (err) {
    msg("github-msg", err.message, "error");
  }
}

function renderGithubStatus(github) {
  const connected = !!github?.connected;

  $("github-status-label").textContent = connected ? "Conectado" : "Não conectado";
  $("github-status-label").className = connected ? "badge badge-ok" : "badge badge-warning";

  $("github-profile").classList.toggle("hidden", !connected);

  $("btn-connect-github").classList.toggle("hidden", connected);
  $("btn-change-github").classList.toggle("hidden", !connected);
  $("btn-disconnect-github").classList.toggle("hidden", !connected);

  if (connected) {
    $("github-avatar").src = github.avatarUrl || "";
    $("github-login").textContent = github.login || "-";
    $("github-name").textContent = github.name || "-";
    $("github-connected-at").textContent = formatDate(github.connectedAt);
  } else {
    $("github-avatar").src = "";
    $("github-login").textContent = "-";
    $("github-name").textContent = "-";
    $("github-connected-at").textContent = "-";
  }
}

function connectGithub() {
  location.href = "/auth/github/connect";
}

async function disconnectGithub() {
  if (!confirm("Desconectar GitHub deste usuário?")) return;

  try {
    await api("/auth/github/disconnect", {
      method: "POST"
    });

    msg("github-msg", "GitHub desconectado.", "ok");
    await loadUserProfile();
  } catch (err) {
    msg("github-msg", err.message, "error");
  }
}


function renderRepositoryStatus(repository) {
  const selectedData = repository?.selectedDataRepoFullName || repository?.selectedRepoFullName || null;
  const selectedIndex = repository?.selectedIndexRepoFullName || null;

  const dataLabel = $("selected-data-repo-label");
  const indexLabel = $("selected-index-repo-label");
  const catalogIndexLabel = $("catalog-index-repo-label");

  if (dataLabel) dataLabel.textContent = selectedData || "Nenhum";
  if (indexLabel) indexLabel.textContent = selectedIndex || "Nenhum";
  if (catalogIndexLabel) catalogIndexLabel.textContent = selectedIndex || "Nenhum";
}

async function loadRepos() {
  try {
    const data = await api("/auth/github/repos");
    const box = $("repos-container");

    if (!data.repos || data.repos.length === 0) {
      box.innerHTML = "<p>Nenhum repositório encontrado.</p>";
      return;
    }

    box.innerHTML = data.repos.map(repo => `
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
    `).join("");

    msg("repos-msg", "Repositórios carregados.", "ok");
  } catch (err) {
    msg("repos-msg", err.message, "error");
  }
}


async function selectDataRepo(repoFullName) {
  try {
    const data = await api("/auth/github/repos/select-data", {
      method: "POST",
      body: JSON.stringify({ repoFullName })
    });

    msg("repos-msg", "Repositório de dados selecionado: " + data.selectedDataRepoFullName, "ok");

    await loadUserProfile();
    await loadRepos();
    await loadLatestCatalog();
  } catch (err) {
    msg("repos-msg", err.message, "error");
  }
}

async function selectIndexRepo(repoFullName) {
  try {
    const data = await api("/auth/github/repos/select-index", {
      method: "POST",
      body: JSON.stringify({ repoFullName })
    });

    msg("repos-msg", "Repositório de índice selecionado: " + data.selectedIndexRepoFullName, "ok");

    await loadUserProfile();
    await loadRepos();
    await loadLatestCatalog();
  } catch (err) {
    msg("repos-msg", err.message, "error");
  }
}



function clearCatalogView() {
  const repoLabel = $("catalog-repo-label");
  const statusLabel = $("catalog-status-label");
  const countLabel = $("catalog-files-count");
  const runDate = $("catalog-run-date");
  const writtenLabel = $("catalog-written-label");
  const box = $("catalog-container");
  const indexRepoLabel = $("catalog-index-repo-label");

  if (repoLabel) repoLabel.textContent = "Nenhum";
  if (statusLabel) statusLabel.textContent = "Nenhum catálogo criado";
  if (countLabel) countLabel.textContent = "0";
  if (runDate) runDate.textContent = "-";
  if (writtenLabel) writtenLabel.textContent = "Ainda não gravado";
  if (indexRepoLabel) indexRepoLabel.textContent = "Nenhum";
  if (box) box.innerHTML = "<p>Nenhum catálogo criado ainda.</p>";
}

function currentCatalogSortMode() {
  return $("catalog-sort-mode")?.value || "alpha";
}

async function loadLatestCatalog() {
  try {
    const sortMode = currentCatalogSortMode();
    const data = await api(`/api/index/latest?sortMode=${encodeURIComponent(sortMode)}`);

    if (!data.run) {
      clearCatalogView();
      if (data.selectedRepoFullName && $("catalog-repo-label")) {
        $("catalog-repo-label").textContent = data.selectedRepoFullName;
      }
      if (data.selectedIndexRepoFullName && $("catalog-index-repo-label")) {
        $("catalog-index-repo-label").textContent = data.selectedIndexRepoFullName;
      }
      return;
    }

    renderCatalogRun(data.run);
    renderCatalogFiles(data.files || []);
  } catch (err) {
    clearCatalogView();
  }
}

async function refreshCatalogView() {
  try {
    const sortMode = currentCatalogSortMode();
    const data = await api(`/api/index/files?sortMode=${encodeURIComponent(sortMode)}`);

    if (data.run) {
      renderCatalogRun(data.run);
    }

    renderCatalogFiles(data.files || []);
    msg("catalog-msg", "Visualização atualizada.", "ok");
  } catch (err) {
    msg("catalog-msg", err.message, "error");
  }
}

async function prepareCatalog() {
  try {
    const sortMode = currentCatalogSortMode();

    msg("catalog-msg", "Criando catálogo. Aguarde...", "ok");

    const data = await api("/api/index/prepare", {
      method: "POST",
      body: JSON.stringify({ sortMode })
    });

    renderCatalogRun(data.run);
    renderCatalogFiles(data.files || []);

    let text = `Catálogo criado com ${data.run.filesCount} arquivo(s) e gravado no repositório de índice.`;

    if (data.run.truncated) {
      text += " Atenção: o GitHub informou que a árvore foi truncada.";
    }

    if (sortMode === "updated_desc" && data.run.dateLookupLimit > 0) {
      text += ` Datas de última alteração obtidas para ${data.run.dateLookupCount} arquivo(s), com limite de ${data.run.dateLookupLimit}.`;
    }

    msg("catalog-msg", text, "ok");
  } catch (err) {
    msg("catalog-msg", err.message, "error");
  }
}

function renderCatalogRun(run) {
  if (!run) {
    clearCatalogView();
    return;
  }

  $("catalog-repo-label").textContent = run.repoFullName || "Nenhum";
  $("catalog-status-label").textContent = run.status || "-";
  $("catalog-files-count").textContent = String(run.filesCount ?? 0);
  $("catalog-run-date").textContent = formatDate(run.finishedAt || run.createdAt);

  const writtenLabel = $("catalog-written-label");
  if (writtenLabel) {
    if (run.indexWritten) {
      writtenLabel.textContent = `${run.indexRepoFullName || ""}/${run.indexCatalogPath || "avdc-index/catalog.json"}`;
    } else {
      writtenLabel.textContent = "Ainda não gravado";
    }
  }
}

function renderCatalogFiles(files) {
  const box = $("catalog-container");

  if (!box) return;

  if (!files || files.length === 0) {
    box.innerHTML = "<p>Nenhum arquivo no catálogo.</p>";
    return;
  }

  box.innerHTML = `
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
          ${files.map(file => `
            <tr>
              <td><a href="${escapeAttr(file.githubUrl || "#")}" target="_blank" rel="noopener noreferrer">${escapeHTML(file.name || "-")}</a></td>
              <td>${escapeHTML(file.extension || "-")}</td>
              <td class="code">${escapeHTML(file.path || "-")}</td>
              <td>${formatBytes(file.sizeBytes)}</td>
              <td>${formatDate(file.githubUpdatedAt)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <p class="catalog-help">Mostrando até 500 arquivos do catálogo mais recente.</p>
  `;
}

function formatBytes(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";
  if (number < 1024) return `${number} B`;
  if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;

  return `${(number / (1024 * 1024)).toFixed(1)} MB`;
}


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value).replaceAll("`", "");
}

function formatDate(value) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  $("tab-admin").onclick = () => switchLoginTab("admin");
  $("tab-user").onclick = () => switchLoginTab("user");

  $("form-admin").onsubmit = loginAdmin;
  $("form-user").onsubmit = loginUser;

  $("btn-admin-logout").onclick = logout;
  $("btn-user-logout").onclick = logout;

  document.querySelectorAll(".menu button").forEach(btn => {
    btn.onclick = () => showAdminPage(btn.dataset.page);
  });

  $("btn-suggest-code").onclick = suggestUserCode;
  $("btn-create-user").onclick = createUser;
  $("btn-copy-created-token").onclick = copyCreatedToken;
  $("user-filter").oninput = renderUsers;
  $("btn-change-admin-pass").onclick = changeAdminPassword;

  $("btn-connect-github").onclick = connectGithub;
  $("btn-change-github").onclick = connectGithub;
  $("btn-disconnect-github").onclick = disconnectGithub;
  $("btn-load-repos").onclick = loadRepos;
  $("btn-prepare-catalog").onclick = prepareCatalog;
  $("btn-refresh-catalog").onclick = refreshCatalogView;
  $("catalog-sort-mode").onchange = refreshCatalogView;

  const params = new URLSearchParams(location.search);
  if (params.get("github") === "connected") {
    history.replaceState({}, "", "/");

    try {
      const me = await api("/api/auth/me");
      if (me.authenticated && me.type === "user") {
        $("login-screen").classList.add("hidden");
        $("admin-screen").classList.add("hidden");
        $("user-screen").classList.remove("hidden");

        $("user-logged-as").textContent = `${me.user.name} (${me.user.userCode})`;
        $("user-name-view").textContent = me.user.name;
        $("user-code-view").textContent = me.user.userCode;

        await loadUserProfile();
        msg("github-msg", "GitHub conectado com sucesso.", "ok");
      }
    } catch (error) {
      console.error(error);
    }
  }
});
