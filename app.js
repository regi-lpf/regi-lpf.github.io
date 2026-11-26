const USERNAME = 'regi-lpf';
const IGNORED_REPOS = [`${USERNAME}.github.io`, USERNAME];

const featuredGrid = document.getElementById('featured-grid');
const moreList = document.getElementById('more-projects-list');
const moreSummary = document.getElementById('more-projects-summary');

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchGitHubRepos() {
  try {
    const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=100`);
    if (!res.ok) return null;
    const repos = await res.json();
    return repos
      .filter(repo => !repo.fork && !IGNORED_REPOS.includes(repo.name))
      .map(repo => ({
        name: repo.name,
        summary: repo.description || 'Repositório público no GitHub.',
        highlight: null,
        tags: repo.language ? [repo.language] : [],
        repoUrl: repo.html_url,
        deployUrl: normalizeUrl(repo.homepage)
      }));
  } catch {
    return null;
  }
}

async function initPortfolio() {
  const [curationResult, portfolioResult] = await Promise.allSettled([
    fetchJsonSafe('./data/curation.json'),
    fetchJsonSafe('./data/portfolio.json')
  ]);

  const curation = curationResult.status === 'fulfilled' && curationResult.value
    ? curationResult.value
    : { featured: [], overrides: {}, hidden: [] };

  let projects = portfolioResult.status === 'fulfilled' && Array.isArray(portfolioResult.value?.projects)
    ? portfolioResult.value.projects
    : null;

  if (!projects || projects.length === 0) {
    projects = await fetchGitHubRepos();
  }

  renderFeatured(curation.featured || []);
  renderMoreProjects(projects, curation);
}

function getInitials(title) {
  const words = String(title || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'RF';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function buildPlaceholderElement(title) {
  const placeholder = document.createElement('div');
  placeholder.className = 'card-thumb-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  const span = document.createElement('span');
  span.textContent = getInitials(title);
  placeholder.appendChild(span);
  return placeholder;
}

function renderFeatured(featured) {
  if (!featuredGrid) return;

  if (!featured.length) {
    featuredGrid.innerHTML = `<p class="status-msg">Projetos em destaque indisponíveis no momento. Veja os repositórios em <a href="${escapeHtml(`https://github.com/${USERNAME}`)}" target="_blank" rel="noopener">github.com/${escapeHtml(USERNAME)}</a>.</p>`;
    return;
  }

  featuredGrid.innerHTML = featured.map(item => {
    const title = escapeHtml(item.title || item.repo || '');
    const summary = escapeHtml(item.summary || '');
    const highlight = item.highlight ? `<p class="card-highlight">${escapeHtml(item.highlight)}</p>` : '';
    const tagsHtml = (item.tags || [])
      .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');

    const linksHtml = (item.links || [])
      .map(link => {
        const href = normalizeUrl(link.url);
        if (!href) return '';
        const cls = link.primary ? 'btn btn-primary' : 'btn btn-ghost';
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="${cls}">${escapeHtml(link.label)}</a>`;
      })
      .join('');

    const primaryLink = (item.links || []).find(l => l.primary) || (item.links || [])[0];
    const thumbHref = primaryLink ? normalizeUrl(primaryLink.url) : null;
    const imageSrc = item.image ? escapeHtml(item.image) : '';

    const mediaInner = imageSrc
      ? `<img src="${imageSrc}" alt="Preview do projeto ${title}" class="card-thumb" loading="lazy" data-title="${title}">`
      : `<div class="card-thumb-placeholder" aria-hidden="true"><span>${escapeHtml(getInitials(item.title || item.repo))}</span></div>`;

    const thumbHtml = thumbHref
      ? `<a href="${escapeHtml(thumbHref)}" target="_blank" rel="noopener" class="card-thumb-link">${mediaInner}</a>`
      : `<div class="card-thumb-link">${mediaInner}</div>`;

    return `
      <article class="card">
        ${thumbHtml}
        <div class="card-body">
          <div>
            <h3>${title}</h3>
            <p class="card-desc">${summary}</p>
            ${highlight}
          </div>
          <div>
            ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
            ${linksHtml ? `<div class="actions">${linksHtml}</div>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  featuredGrid.querySelectorAll('img.card-thumb').forEach(img => {
    const swapToPlaceholder = () => {
      const placeholder = buildPlaceholderElement(img.dataset.title || '');
      img.replaceWith(placeholder);
    };
    img.addEventListener('error', swapToPlaceholder, { once: true });
    if (img.complete && img.naturalWidth === 0) {
      swapToPlaceholder();
    }
  });
}

function firstSentenceCapped(text, maxLen = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Repositório público no GitHub.';
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  const sentence = match ? match[0].trim() : clean;
  if (sentence.length <= maxLen) return sentence;
  return `${sentence.slice(0, maxLen - 1).trimEnd()}…`;
}

function renderMoreProjects(projects, curation) {
  if (!moreList || !moreSummary) return;

  if (!projects) {
    moreSummary.textContent = 'Ver outros projetos';
    moreList.innerHTML = `<li class="more-empty">Não foi possível carregar os demais repositórios agora. Acesse <a href="${escapeHtml(`https://github.com/${USERNAME}`)}" target="_blank" rel="noopener">github.com/${escapeHtml(USERNAME)}</a>.</li>`;
    return;
  }

  const excluded = new Set(IGNORED_REPOS);
  for (const feat of curation.featured || []) {
    if (feat.repo) excluded.add(feat.repo);
    for (const rel of feat.related || []) excluded.add(rel);
  }
  for (const h of curation.hidden || []) excluded.add(h);

  const overrides = curation.overrides || {};
  const overrideOrder = Object.keys(overrides);

  const others = projects
    .filter(p => p && p.name && !excluded.has(p.name))
    .map(p => {
      const ov = overrides[p.name];
      if (ov) {
        return {
          repoName: p.name,
          title: ov.title || p.name,
          summary: ov.summary || firstSentenceCapped(p.summary),
          tags: (ov.tags || []).slice(0, 3),
          repoUrl: normalizeUrl(p.repoUrl),
          deployUrl: normalizeUrl(p.deployUrl),
          deployLabel: ov.deployLabel || 'Demo ↗'
        };
      }
      return {
        repoName: p.name,
        title: p.name,
        summary: firstSentenceCapped(p.summary),
        tags: (p.tags || []).slice(0, 3),
        repoUrl: normalizeUrl(p.repoUrl),
        deployUrl: normalizeUrl(p.deployUrl),
        deployLabel: 'Demo ↗'
      };
    });

  others.sort((a, b) => {
    const idxA = overrideOrder.indexOf(a.repoName);
    const idxB = overrideOrder.indexOf(b.repoName);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  moreSummary.textContent = `Ver outros projetos (${others.length})`;

  if (!others.length) {
    moreList.innerHTML = '<li class="more-empty">Nenhum outro repositório disponível.</li>';
    return;
  }

  moreList.innerHTML = others.map(item => {
    const tagsHtml = item.tags
      .map(tag => `<span class="tag tag-sm">${escapeHtml(tag)}</span>`)
      .join('');
    const repoBtn = item.repoUrl
      ? `<a href="${escapeHtml(item.repoUrl)}" target="_blank" rel="noopener" class="row-link">Código</a>`
      : '';
    const deployBtn = item.deployUrl
      ? `<a href="${escapeHtml(item.deployUrl)}" target="_blank" rel="noopener" class="row-link row-link-accent">${escapeHtml(item.deployLabel)}</a>`
      : '';

    return `
      <li class="more-row">
        <div class="more-row-main">
          <div class="more-row-head">
            <h3>${escapeHtml(item.title)}</h3>
            ${tagsHtml ? `<div class="tags tags-inline">${tagsHtml}</div>` : ''}
          </div>
          <p class="more-row-desc">${escapeHtml(item.summary)}</p>
        </div>
        <div class="more-row-actions">
          ${repoBtn}
          ${deployBtn}
        </div>
      </li>
    `;
  }).join('');
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

initPortfolio();
