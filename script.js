const USERNAME = 'regi-lpf';
const grid = document.getElementById('projects-grid');

const IGNORED_REPOS = [`${USERNAME}.github.io`, USERNAME];

async function fetchRepos() {
  try {
    const response = await fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=100`);
    if (!response.ok) throw new Error('Erro ao buscar repositórios');
    
    const repos = await response.json();

    const filtered = repos.filter(repo => 
      !repo.fork && !IGNORED_REPOS.includes(repo.name)
    );

    // Projetos com deploy configurado aparecem primeiro
    filtered.sort((a, b) => {
      const aHasDeploy = Boolean(a.homepage && a.homepage.trim() !== '');
      const bHasDeploy = Boolean(b.homepage && b.homepage.trim() !== '');
      return bHasDeploy - aHasDeploy;
    });

    renderRepos(filtered);
  } catch (error) {
    grid.innerHTML = `<p>Não foi possível carregar os projetos no momento. <a href="https://github.com/${USERNAME}" target="_blank">Ver no GitHub</a>.</p>`;
  }
}

function renderRepos(repos) {
  if (repos.length === 0) {
    grid.innerHTML = '<p>Nenhum projeto público encontrado.</p>';
    return;
  }

  grid.innerHTML = repos.map(repo => {
    const hasDeploy = repo.homepage && repo.homepage.trim() !== '';
    const deployUrl = hasDeploy 
      ? (repo.homepage.startsWith('http') ? repo.homepage : `https://${repo.homepage}`)
      : null;

    const thumbUrl = deployUrl 
      ? `https://s.wordpress.com/mshots/v1/${encodeURIComponent(deployUrl)}?w=600` 
      : null;

    return `
      <article class="card">
        ${thumbUrl ? `
          <a href="${deployUrl}" target="_blank" rel="noopener">
            <img 
              src="${thumbUrl}" 
              alt="Preview de ${repo.name}" 
              class="card-thumb" 
              loading="lazy" 
              onerror="this.parentElement.style.display='none'"
            >
          </a>
        ` : ''}
        <div class="card-body">
          <div>
            <h3>${repo.name}</h3>
            <p>${repo.description || 'Sem descrição cadastrada.'}</p>
          </div>
          <div>
            <div class="meta">
              ${repo.language ? `<span class="badge">${repo.language}</span>` : '<span></span>'}
              <span>★ ${repo.stargazers_count}</span>
            </div>
            <div class="actions">
              <a href="${repo.html_url}" target="_blank" rel="noopener" class="btn btn-repo">Código</a>
              ${deployUrl ? `<a href="${deployUrl}" target="_blank" rel="noopener" class="btn btn-deploy">Deploy ↗</a>` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

fetchRepos();