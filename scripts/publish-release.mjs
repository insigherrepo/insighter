import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1).trim();
    }
    result[key] = val;
  }
  return result;
}

function normalizeRepoSlug(raw) {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

async function main() {
  const envDocker = parseEnvFile(path.join(rootDir, '.env.docker'));
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = pkg.version || '0.1.0';
  const tag = `v${version}`;

  const repoSlug = normalizeRepoSlug(envDocker.GITHUB_UPDATE_REPO || envDocker.VITE_GITHUB_UPDATE_REPO || '');
  const token = envDocker.GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';

  if (!repoSlug) {
    console.error(
      '❌ Defina GITHUB_UPDATE_REPO=usuario/repositorio no arquivo .env.docker antes de publicar a release.'
    );
    process.exit(1);
  }

  // Grava apenas o slug público do repositório em build/update-config.json antes de empacotar
  fs.writeFileSync(
    path.join(rootDir, 'build', 'update-config.json'),
    JSON.stringify({ repo: repoSlug, installDir: '/Applications/Capitolio/Insighter.app' }, null, 2) + '\n',
    'utf8'
  );

  console.log(`🚀 Compilando e gerando bundle de release em dist/ (${tag})...`);
  execSync('npm run desktop:dist', { cwd: rootDir, stdio: 'inherit' });

  const zipPath = path.join(rootDir, 'dist', 'Insighter-macOS-arm64.zip');
  const appBundlePath = path.join(rootDir, 'dist', 'mac-arm64', 'Insighter.app');

  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  console.log('📦 Compactando Insighter-macOS-arm64.zip para auto-update...');
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appBundlePath, zipPath], {
    stdio: 'inherit',
  });

  const envWithToken = { ...process.env };
  if (token) {
    envWithToken.GH_TOKEN = token;
    envWithToken.GITHUB_TOKEN = token;
  }

  // Verifica se o repositório existe no GitHub; se não existir, cria automaticamente
  try {
    execFileSync('gh', ['repo', 'view', repoSlug], { env: envWithToken, stdio: 'ignore' });
    console.log(`✅ Repositório ${repoSlug} localizado no GitHub.`);
  } catch {
    console.log(`🆕 Criando repositório de updates ${repoSlug} no GitHub...`);
    execFileSync(
      'gh',
      [
        'repo',
        'create',
        repoSlug,
        '--public',
        '--description',
        'Insighter — Repositório de Atualizações Automáticas (macOS)',
      ],
      { env: envWithToken, stdio: 'inherit' }
    );
  }

  // Publica ou atualiza a Release no GitHub
  console.log(`☁️ Publicando release ${tag} em ${repoSlug}...`);
  try {
    execFileSync('gh', ['release', 'view', tag, '--repo', repoSlug], { env: envWithToken, stdio: 'ignore' });
    execFileSync('gh', ['release', 'upload', tag, zipPath, '--clobber', '--repo', repoSlug], {
      env: envWithToken,
      stdio: 'inherit',
    });
  } catch {
    execFileSync(
      'gh',
      [
        'release',
        'create',
        tag,
        zipPath,
        '--repo',
        repoSlug,
        '--title',
        `Insighter ${tag}`,
        '--notes',
        `Atualização automática do Insighter (${tag}) para macOS Apple Silicon.`,
      ],
      { env: envWithToken, stdio: 'inherit' }
    );
  }

  console.log(`🎉 Release ${tag} publicada com sucesso em https://github.com/${repoSlug}/releases/tag/${tag}`);
}

main().catch((err) => {
  console.error('Erro ao publicar release:', err);
  process.exit(1);
});
