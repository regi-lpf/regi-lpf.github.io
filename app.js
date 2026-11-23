const USERNAME = 'regi-lpf';
const IGNORED_REPOS = [`${USERNAME}.github.io`, USERNAME];

const grid = document.getElementById('projects-grid');
const sourceBadge = document.getElementById('data-source-badge');

/**
 * Carrega os projetos priorizando o arquivo estático enriquecido por LLM (data/portfolio.json).
 * Caso o arquivo ainda esteja vazio, faz fallback automático para a API pública do GitHub.
 */
async function initPortfolio() {
  try {
    const localRes = await fetch('./data/portfolio.json', { cache: 'no-cache' });
    if (localRes.ok) {
      const data = await localRes.json();
      if (Array.isArray(data.projects) && data.projects.length > 0) {
        sourceBadge.textContent = `Curadoria via ${data.provider || 'LLM'} • ${formatDate(data.generatedAt)}`;
        renderProjects(data.projects);
        return;
      }
    }
  } catch (_) {
    // Segue silenciosamente para o fallback da API do GitHub
  }

  await loadFromGitHubFallback();
}

/**
 * Fallback direto via API pública do GitHub caso data/portfolio.json não tenha sido gerado ainda.
 */
async function loadFromGitHubFallback() {
  try {
    const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=100`);
    if (!res.ok) throw new Error('Falha ao consultar API do GitHub');

    const repos = await res.json();
    const filtered = repos
      .filter(repo => !repo.fork && !IGNORED_REPOS.includes(repo.name))
      .map(repo => ({
        name: repo.name,
        summary: repo.description || 'Repositório público no GitHub.',
        highlight: null,
        tags: repo.language ? [repo.language] : [],
        repoUrl: repo.html_url,
        deployUrl: normalizeUrl(repo.homepage)
      }));

    // Projetos com deploy ativo aparecem primeiro
    filtered.sort((a, b) => Boolean(b.deployUrl) - Boolean(a.deployUrl));

    sourceBadge.textContent = 'Sincronizado via GitHub API';
    renderProjects(filtered);
  } catch (err) {
    grid.innerHTML = `<p class="status-msg">Não foi possível carregar os projetos agora. Acesse diretamente em <a href="https://github.com/${USERNAME}" target="_blank" rel="noopener">github.com/${USERNAME}</a>.</p>`;
  }
}

function renderProjects(projects) {
  if (!projects.length) {
    grid.innerHTML = '<p class="status-msg">Nenhum projeto público encontrado.</p>';
    return;
  }

  grid.innerHTML = projects.map(project => {
    const deployUrl = normalizeUrl(project.deployUrl);
    const thumbUrl = deployUrl
      ? `https://s.wordpress.com/mshots/v1/${encodeURIComponent(deployUrl)}?w=600`
      : null;

    const tagsHtml = (project.tags || [])
      .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');

    return `
      <article class="card">
        ${thumbUrl ? `
          <a href="${deployUrl}" target="_blank" rel="noopener" class="card-thumb-link">
            <img
              src="${thumbUrl}"
              alt="Preview do deploy de ${escapeHtml(project.name)}"
              class="card-thumb"
              loading="lazy"
              onerror="this.parentElement.style.display='none'"
            >
          </a>
        ` : ''}
        <div class="card-body">
          <div>
            <h3>${escapeHtml(project.name)}</h3>
            <p class="card-desc">${escapeHtml(project.summary)}</p>
            ${project.highlight ? `<p class="card-highlight">${escapeHtml(project.highlight)}</p>` : ''}
          </div>
          <div>
            ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
            <div class="actions">
              <a href="${project.repoUrl}" target="_blank" rel="noopener" class="btn btn-repo">Código</a>
              ${deployUrl ? `<a href="${deployUrl}" target="_blank" rel="noopener" class="btn btn-deploy">Deploy ↗</a>` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') return null;
  const trimmed = url.trim();
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

initPortfolio();
