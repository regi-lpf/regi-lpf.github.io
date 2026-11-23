import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStructuredSummary as runLlamaCpp } from './providers/llamacpp.js';
import { generateStructuredSummary as runOpenRouter } from './providers/openrouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, '../data/portfolio.json');

const USERNAME = process.env.GITHUB_USERNAME || 'regi-lpf';
const PROVIDER = (process.env.LLM_PROVIDER || 'llamacpp').toLowerCase();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Repositórios ignorados explicitamente
const IGNORED_REPOS = [`${USERNAME}.github.io`, USERNAME];

// Se quiser curadoria estrita, defina FILTER_TOPIC="portfolio" para incluir apenas repos com essa tag
const FILTER_TOPIC = process.env.FILTER_TOPIC || '';

// Schema rigoroso para extração via LLM
const PROJECT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Resumo técnico objetivo em português (máximo 2 frases) explicando o problema resolvido e o propósito do projeto.'
    },
    highlight: {
      type: 'string',
      description: 'Um destaque arquitetural ou técnico específico extraído do README/stack (máximo 12 palavras). Ex: "API REST com Spring Boot, JWT e testes de integração".'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Lista de 2 a 4 tecnologias ou conceitos principais (ex: ["Java", "Spring Boot", "React", "Docker"]).'
    }
  },
  required: ['summary', 'highlight', 'tags'],
  additionalProperties: false
};

function githubHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'regi-lpf-portfolio-enricher'
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchRepos() {
  const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?sort=updated&per_page=100`, {
    headers: githubHeaders()
  });
  if (!res.ok) throw new Error(`Erro ao listar repositórios: ${res.status}`);
  const repos = await res.json();

  return repos.filter(repo => {
    if (repo.fork || repo.private || IGNORED_REPOS.includes(repo.name)) return false;
    if (FILTER_TOPIC && !(repo.topics || []).includes(FILTER_TOPIC)) return false;
    return true;
  });
}

async function fetchReadme(repoName) {
  try {
    const res = await fetch(`https://api.github.com/repos/${USERNAME}/${repoName}/readme`, {
      headers: {
        ...githubHeaders(),
        'Accept': 'application/vnd.github.raw+json'
      }
    });
    if (!res.ok) return '';
    const text = await res.text();
    // Limita a 4000 caracteres para caber com folga no contexto de modelos locais menores
    return text.slice(0, 4000);
  } catch {
    return '';
  }
}

async function analyzeRepo(repo, readme, providerFn) {
  const messages = [
    {
      role: 'system',
      content: [
        'Você é um engenheiro de software sênior escrevendo descrições técnicas concisas para um portfólio.',
        'Regras estritas:',
        '- Escreva em português do Brasil.',
        '- Seja direto, técnico e factual. Evite adjetivos promocionais como "incrível", "inovador" ou "robusto".',
        '- Baseie-se estritamente nos metadados e no README fornecidos.'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        name: repo.name,
        description: repo.description || '',
        primaryLanguage: repo.language || '',
        topics: repo.topics || [],
        hasDeploy: Boolean(repo.homepage),
        readmeExcerpt: readme || 'README não disponível.'
      })
    }
  ];

  return await providerFn(messages, PROJECT_ANALYSIS_SCHEMA);
}

async function main() {
  console.log(`Iniciando enriquecimento via provedor: ${PROVIDER}`);

  const providerFn = PROVIDER === 'openrouter' ? runOpenRouter : runLlamaCpp;
  const repos = await fetchRepos();

  console.log(`${repos.length} repositório(s) elegível(is) encontrado(s).`);
  const enrichedProjects = [];

  for (const repo of repos) {
    process.stdout.write(`Analisando ${repo.name}... `);
    try {
      const readme = await fetchReadme(repo.name);
      const analysis = await analyzeRepo(repo, readme, providerFn);

      enrichedProjects.push({
        name: repo.name,
        summary: analysis.summary,
        highlight: analysis.highlight,
        tags: analysis.tags,
        repoUrl: repo.html_url,
        deployUrl: repo.homepage || null,
        updatedAt: repo.pushed_at
      });
      console.log('OK');
    } catch (err) {
      console.log(`FALHA (${err.message})`);
      // Mantém o projeto com os metadados básicos caso a análise individual falhe
      enrichedProjects.push({
        name: repo.name,
        summary: repo.description || 'Repositório público no GitHub.',
        highlight: null,
        tags: repo.language ? [repo.language] : [],
        repoUrl: repo.html_url,
        deployUrl: repo.homepage || null,
        updatedAt: repo.pushed_at
      });
    }
  }

  // Ordena priorizando projetos que possuem URL de deploy
  enrichedProjects.sort((a, b) => Boolean(b.deployUrl) - Boolean(a.deployUrl));

  const outputPayload = {
    generatedAt: new Date().toISOString(),
    provider: PROVIDER,
    projects: enrichedProjects
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(outputPayload, null, 2), 'utf-8');
  console.log(`\nArquivo salvo com sucesso em: ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Erro fatal no pipeline:', err);
  process.exit(1);
});
