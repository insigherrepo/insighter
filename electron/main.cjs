const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { execFileSync, spawn } = require('child_process');

// Define explicitamente o nome do aplicativo para a barra de menus do macOS
app.setName('Insighter');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const CAPITOLIO_APP_DIR = '/Applications/Capitolio';
const CAPITOLIO_APP_PATH = '/Applications/Capitolio/Insighter.app';

let currentUpdateState = {
  status: 'idle', // 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error' | 'unconfigured'
  currentVersion: app.getVersion() || '0.1.0',
  latestVersion: null,
  releaseNotes: '',
  downloadUrl: null,
  assetApiUrl: null,
  htmlUrl: null,
  progress: 0,
  repo: '',
  error: null,
};

function normalizeRepoSlug(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function getGitHubUpdateConfig() {
  let bundledRepo = '';
  try {
    const cfgPath = path.join(__dirname, '..', 'build', 'update-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      bundledRepo = parsed.repo || '';
    }
  } catch {
    // ignore
  }

  return { repo: normalizeRepoSlug(bundledRepo) };
}

function compareSemver(vA, vB) {
  const cleanA = String(vA || '0.0.0').replace(/^v/i, '').split('-')[0].split('.').map(Number);
  const cleanB = String(vB || '0.0.0').replace(/^v/i, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const a = cleanA[i] || 0;
    const b = cleanB[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function broadcastUpdateState(patch) {
  currentUpdateState = {
    ...currentUpdateState,
    ...patch,
    currentVersion: app.getVersion() || '0.1.0',
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('insighter:update-status', currentUpdateState);
  }
}

function fetchJsonFromGitHub(url, token) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Insighter-AutoUpdater/1.0',
      Accept: 'application/vnd.github+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchJsonFromGitHub(res.headers.location, token).then(resolve).catch(reject);
          return;
        }
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`GitHub API HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      })
      .on('error', reject);
  });
}

function downloadFileWithProgress(url, destPath, token, isApiAsset, onProgress) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'Insighter-AutoUpdater/1.0',
    };
    if (isApiAsset) {
      headers.Accept = 'application/octet-stream';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const request = (targetUrl, includeAuth = true) => {
      const reqHeaders = { ...headers };
      if (!includeAuth) {
        delete reqHeaders.Authorization;
        delete reqHeaders.Accept;
      }
      https
        .get(targetUrl, { headers: reqHeaders }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            // S3 redirect from GitHub shouldn't include Authorization header
            request(res.headers.location, false);
            return;
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Falha no download (HTTP ${res.statusCode})`));
            return;
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;
          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
              onProgress(Math.min(99, Math.round((receivedBytes / totalBytes) * 100)));
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => resolve(destPath));
          });
          fileStream.on('error', reject);
        })
        .on('error', reject);
    };

    request(url, true);
  });
}

async function checkForAppUpdates({ silent = true } = {}) {
  const { repo } = getGitHubUpdateConfig();
  if (!repo) {
    broadcastUpdateState({
      status: 'unconfigured',
      repo: '',
      error: null,
    });
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Insighter Atualizado',
        message: `Versão instalada: v${app.getVersion() || '0.1.0'}`,
        detail: `Aplicativo instalado em ${CAPITOLIO_APP_PATH}.`,
      });
    }
    return currentUpdateState;
  }

  broadcastUpdateState({ status: 'checking', repo, error: null });

  try {
    const release = await fetchJsonFromGitHub(`https://api.github.com/repos/${repo}/releases/latest`, '');
    const latestTag = release.tag_name || release.name || '';
    const latestVersion = latestTag.replace(/^v/i, '');
    const currentVersion = app.getVersion() || '0.1.0';

    const assets = Array.isArray(release.assets) ? release.assets : [];
    const zipAsset =
      assets.find((a) => a.name && a.name.endsWith('.zip') && a.name.toLowerCase().includes('mac')) ||
      assets.find((a) => a.name && a.name.endsWith('.zip'));

    if (compareSemver(latestVersion, currentVersion) > 0) {
      broadcastUpdateState({
        status: 'available',
        latestVersion,
        releaseNotes: release.body || '',
        downloadUrl: zipAsset ? zipAsset.browser_download_url : null,
        assetApiUrl: zipAsset ? zipAsset.url : null,
        htmlUrl: release.html_url || `https://github.com/${repo}/releases`,
        repo,
      });

      if (!silent && mainWindow) {
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'info',
          buttons: ['Atualizar Agora em /Applications/Capitolio', 'Depois'],
          defaultId: 0,
          cancelId: 1,
          title: `Nova Atualização Disponível (v${latestVersion})`,
          message: `Uma nova versão do Insighter (v${latestVersion}) está disponível!`,
          detail: `Versão instalada: v${currentVersion}\nDestino: ${CAPITOLIO_APP_PATH}\n\n${release.body || ''}`,
        });
        if (response === 0) {
          await downloadAndInstallUpdate();
        }
      }
    } else {
      broadcastUpdateState({
        status: 'up-to-date',
        latestVersion: latestVersion || currentVersion,
        repo,
      });
      if (!silent && mainWindow) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Insighter Atualizado',
          message: `Você já está na versão mais recente (v${currentVersion}).`,
          detail: `Instalado em: ${CAPITOLIO_APP_PATH}`,
        });
      }
    }
  } catch (err) {
    broadcastUpdateState({
      status: 'error',
      repo,
      error: err && err.message ? err.message : 'Erro ao consultar atualizações.',
    });
    if (!silent && mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Verificação de Atualizações',
        message: 'Não foi possível verificar atualizações no momento.',
        detail: `${err && err.message ? err.message : err}`,
      });
    }
  }

  return currentUpdateState;
}

async function downloadAndInstallUpdate() {
  const targetUrl = currentUpdateState.downloadUrl;

  if (!targetUrl) {
    if (currentUpdateState.htmlUrl) {
      shell.openExternal(currentUpdateState.htmlUrl);
    }
    return { ok: false, error: 'Pacote .zip não encontrado na release.' };
  }

  const tmpZip = path.join(os.tmpdir(), `insighter-update-${Date.now()}.zip`);
  const tmpExtractDir = path.join(os.tmpdir(), `insighter-extract-${Date.now()}`);

  try {
    broadcastUpdateState({ status: 'downloading', progress: 2, error: null });

    await downloadFileWithProgress(
      targetUrl,
      tmpZip,
      '',
      false,
      (pct) => broadcastUpdateState({ status: 'downloading', progress: pct })
    );

    broadcastUpdateState({ status: 'installing', progress: 100 });

    fs.mkdirSync(tmpExtractDir, { recursive: true });
    execFileSync('/usr/bin/ditto', ['-x', '-k', tmpZip, tmpExtractDir]);

    const extractedApp = path.join(tmpExtractDir, 'Insighter.app');
    if (!fs.existsSync(extractedApp)) {
      throw new Error('Insighter.app não encontrado dentro do arquivo .zip da release.');
    }

    // Garante que a pasta /Applications/Capitolio exista e atualiza o .app lá
    if (!fs.existsSync(CAPITOLIO_APP_DIR)) {
      fs.mkdirSync(CAPITOLIO_APP_DIR, { recursive: true });
    }
    if (fs.existsSync(CAPITOLIO_APP_PATH)) {
      fs.rmSync(CAPITOLIO_APP_PATH, { recursive: true, force: true });
    }
    execFileSync('/usr/bin/ditto', [extractedApp, CAPITOLIO_APP_PATH]);
    try {
      execFileSync('/usr/bin/xattr', ['-cr', CAPITOLIO_APP_PATH]);
    } catch {
      // ignore xattr warnings
    }

    // Limpa arquivos temporários
    fs.rmSync(tmpZip, { force: true });
    fs.rmSync(tmpExtractDir, { recursive: true, force: true });

    // Reinicia o aplicativo diretamente de /Applications/Capitolio/Insighter.app
    isQuitting = true;
    spawn('/usr/bin/open', ['-n', CAPITOLIO_APP_PATH], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    app.quit();
    return { ok: true };
  } catch (err) {
    broadcastUpdateState({
      status: 'error',
      error: err && err.message ? err.message : 'Falha ao instalar atualização.',
    });
    return { ok: false, error: err && err.message ? err.message : 'Falha ao instalar atualização.' };
  }
}

function hideToMenuBar() {
  if (mainWindow) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    mainWindow.hide();
  }
  // Remove o aplicativo do Dock do macOS quando oculto no menu superior
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }
}

async function showFromMenuBar() {
  if (process.platform === 'darwin' && app.dock) {
    await app.dock.show();
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
  if (!mainWindow) {
    createStudioWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function getConnectedDisplaysInfo() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  let currentDisplay = null;
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      currentDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    } catch {
      currentDisplay = primary;
    }
  } else {
    currentDisplay = primary;
  }

  return displays.map((disp, idx) => {
    const isCurrent = currentDisplay ? currentDisplay.id === disp.id : disp.id === primary.id;
    const isPrimary = disp.id === primary.id;
    const label = disp.label || (isPrimary ? `Monitor ${idx + 1} (Principal)` : `Monitor ${idx + 1}`);
    return {
      id: disp.id,
      label,
      isPrimary,
      isCurrent,
      bounds: disp.bounds,
      workArea: disp.workArea,
    };
  });
}

function moveWindowToDisplay(targetDisplay) {
  if (!mainWindow || !targetDisplay) return;

  const wasMaximized = mainWindow.isMaximized();
  const wasFullScreen = mainWindow.isFullScreen();
  if (wasFullScreen) mainWindow.setFullScreen(false);
  if (wasMaximized) mainWindow.unmaximize();

  const { x, y, width: dispW, height: dispH } = targetDisplay.workArea;
  const currentBounds = mainWindow.getBounds();

  // Ajusta o tamanho caso o monitor destino tenha resolução menor
  const newW = Math.min(currentBounds.width, dispW - 40);
  const newH = Math.min(currentBounds.height, dispH - 40);
  const newX = Math.round(x + (dispW - newW) / 2);
  const newY = Math.round(y + (dispH - newH) / 2);

  mainWindow.setBounds({ x: newX, y: newY, width: newW, height: newH });

  if (wasMaximized) {
    mainWindow.maximize();
  }
  if (wasFullScreen) {
    mainWindow.setFullScreen(true);
  }

  mainWindow.show();
  mainWindow.focus();
  configureAppMenu();
}

function moveToNextDisplay() {
  const displays = screen.getAllDisplays();
  if (displays.length <= 1 || !mainWindow) return;
  const current = screen.getDisplayMatching(mainWindow.getBounds());
  const currentIndex = displays.findIndex((d) => d.id === current.id);
  const nextIndex = (currentIndex + 1) % displays.length;
  moveWindowToDisplay(displays[nextIndex]);
}

function normalizeUserFilePath(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return '';
  let cleaned = rawInput.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.startsWith('file://')) {
    try {
      cleaned = decodeURIComponent(cleaned.replace(/^file:\/\//, ''));
    } catch {
      cleaned = cleaned.replace(/^file:\/\//, '');
    }
  }
  if (cleaned.startsWith('~/')) {
    cleaned = path.join(os.homedir(), cleaned.slice(2));
  }
  if (!fs.existsSync(cleaned) && cleaned.includes('\\ ')) {
    const unescaped = cleaned.replace(/\\ /g, ' ');
    if (fs.existsSync(unescaped)) {
      cleaned = unescaped;
    }
  }
  return cleaned;
}

function extractPdfTextMacOS(filePath) {
  try {
    const jxaScript = `
ObjC.import("PDFKit");
ObjC.import("Foundation");

function run(argv) {
    var filePath = argv[0];
    var nsUrl = $.NSURL.fileURLWithPath($(filePath));
    var doc = $.PDFDocument.alloc.initWithURL(nsUrl);
    if (!doc) return "";
    var pageCount = doc.pageCount;
    var maxPages = Math.min(pageCount, 150);
    var parts = [];
    for (var i = 0; i < maxPages; i++) {
        var page = doc.pageAtIndex(i);
        if (page) {
            var str = page.string;
            if (str && str.length > 0) {
                var unwrapped = ObjC.unwrap(str).trim();
                if (unwrapped) {
                    parts.push("--- [Página " + (i + 1) + "] ---\\n" + unwrapped);
                }
            }
        }
    }
    return parts.join("\\n\\n");
}
`;
    const output = execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', jxaScript, filePath], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 40 * 1024 * 1024,
    });
    if (output && output.trim().length > 30) {
      return output.trim().slice(0, 80000);
    }
  } catch (err) {
    console.error('Erro na extração nativa de PDF com PDFKit (JXA):', err);
  }

  // Fallback com strings do unix caso PDFKit encontre problemas
  try {
    const stringsOutput = execFileSync('/usr/bin/strings', ['-n', '6', filePath], {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stringsOutput && stringsOutput.trim().length > 200) {
      return stringsOutput.trim().slice(0, 35000);
    }
  } catch {
    // fallback
  }

  return `[Documento PDF: "${path.basename(filePath)}" — O arquivo PDF não contém camada de texto selecionável ou requer OCR.]`;
}

function readSingleFileAsSource(filePath) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath);
  const sizeKb = Math.max(1, Math.round(stat.size / 1024));

  const imageExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.heic', '.tiff', '.svg']);
  if (imageExts.has(ext)) {
    const nImg = nativeImage.createFromPath(filePath);
    const size = nImg.getSize();
    let resized = nImg;
    if (size.width > 1024) {
      resized = nImg.resize({ width: 1024 });
    }
    const dataUrl =
      ext === '.svg'
        ? `data:image/svg+xml;base64,${fs.readFileSync(filePath).toString('base64')}`
        : resized.toDataURL();

    return {
      title: baseName,
      type: 'image_visual',
      authorOrOrigin: `Imagem local (${sizeKb} KB · ${size.width || '?'}×${size.height || '?'}px)`,
      content: `[Referência Visual / Imagem anexada: "${baseName}" (${size.width || '?'}×${size.height || '?'}px) — Arquivo: ${filePath}. O motor multimodal Gemini analisará diretamente os elementos visuais, composição, atmosfera e detalhes de cena desta imagem.]`,
      filePath,
      mimeType: ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg',
      mediaDataUrl: dataUrl,
    };
  }

  if (ext === '.pdf') {
    const extracted = extractPdfTextMacOS(filePath);
    return {
      title: baseName,
      type: 'pdf_article',
      authorOrOrigin: `PDF local (${sizeKb} KB)`,
      content: extracted,
      filePath,
      mimeType: 'application/pdf',
    };
  }

  const richTextExts = new Set(['.docx', '.doc', '.rtf', '.odt', '.html', '.htm', '.webarchive']);
  if (richTextExts.has(ext) && process.platform === 'darwin') {
    try {
      const converted = execFileSync('/usr/bin/textutil', ['-convert', 'txt', '-stdout', filePath], {
        encoding: 'utf8',
        timeout: 8000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        title: baseName,
        type: 'pdf_article',
        authorOrOrigin: `Documento local (${sizeKb} KB)`,
        content: converted.trim().slice(0, 35000) || `[Documento "${baseName}"]`,
        filePath,
      };
    } catch {
      // fallback para leitura direta
    }
  }

  const scriptExts = new Set(['.fountain', '.fdx']);
  const transcriptExts = new Set(['.srt', '.vtt']);
  const rawText = fs.readFileSync(filePath, 'utf8').slice(0, 35000);

  return {
    title: baseName,
    type: scriptExts.has(ext)
      ? 'script_draft'
      : transcriptExts.has(ext)
      ? 'youtube_transcript'
      : 'pdf_article',
    authorOrOrigin: `Arquivo local (${sizeKb} KB)`,
    content: rawText.trim() || `[Arquivo "${baseName}" (${sizeKb} KB)]`,
    filePath,
  };
}

function createMenuBarTray() {
  if (tray) return;
  const trayIconPath = path.join(__dirname, '..', 'build', 'tray-icon.png');
  if (!fs.existsSync(trayIconPath)) return;

  const image = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(image);
  tray.setToolTip('Insighter — Clique para Mostrar/Ocultar no Menu Superior (Sem Dock)');

  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible()) {
      hideToMenuBar();
    } else {
      showFromMenuBar();
    }
  });

  tray.on('right-click', () => {
    const displays = getConnectedDisplaysInfo();
    const moveTrayItems = displays.map((disp) => ({
      label: `Mover para ${disp.label} (${disp.bounds.width}×${disp.bounds.height})${disp.isCurrent ? ' ✓' : ''}`,
      enabled: !disp.isCurrent,
      click: () => {
        const target = screen.getAllDisplays().find((d) => d.id === disp.id);
        if (target) moveWindowToDisplay(target);
      },
    }));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: mainWindow && mainWindow.isVisible() ? 'Ocultar no Menu Superior (Sem Dock)' : 'Abrir Insighter',
        click: () => {
          if (mainWindow && mainWindow.isVisible()) {
            hideToMenuBar();
          } else {
            showFromMenuBar();
          }
        },
      },
      {
        label: 'Mover para Monitor',
        submenu: moveTrayItems.length > 0 ? moveTrayItems : [{ label: '1 monitor conectado', enabled: false }],
      },
      { type: 'separator' },
      {
        label: 'Verificar Atualizações...',
        click: () => checkForAppUpdates({ silent: false }),
      },
      { label: 'Sobre o Insighter', role: 'about' },
      {
        label: 'Encerrar Insighter',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.popUpContextMenu(contextMenu);
  });
}

function configureAppMenu() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }

  app.setAboutPanelOptions({
    applicationName: 'Insighter',
    applicationVersion: app.getVersion() || '1.0.0',
    version: 'Estúdio Noturno',
    copyright: '© Insighter — Estúdio de Síntese Cruzada & Brainstorming para Roteiros',
    credits: 'Motor de Síntese Gemini 3.8 Flash + Banco de Dados Supabase',
    iconPath: fs.existsSync(iconPath) ? iconPath : undefined,
  });

  const displays = getConnectedDisplaysInfo();
  const moveSubmenu = displays.map((disp) => ({
    label: `Mover para ${disp.label} (${disp.bounds.width}×${disp.bounds.height})${disp.isCurrent ? ' ✓ (Atual)' : ''}`,
    enabled: !disp.isCurrent,
    click: () => {
      const target = screen.getAllDisplays().find((d) => d.id === disp.id);
      if (target) moveWindowToDisplay(target);
    },
  }));

  const template = [
    {
      label: 'Insighter',
      submenu: [
        {
          label: 'Sobre o Insighter',
          role: 'about',
        },
        {
          label: 'Verificar Atualizações...',
          click: () => checkForAppUpdates({ silent: false }),
        },
        { type: 'separator' },
        {
          label: 'Ocultar no Menu Superior (Sem Dock)',
          accelerator: 'Cmd+H',
          click: () => hideToMenuBar(),
        },
        { type: 'separator' },
        {
          label: 'Encerrar Insighter',
          accelerator: 'Cmd+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Visualizar',
      submenu: [
        {
          label: 'Aumentar Zoom (Zoom In)',
          accelerator: 'CmdOrControl+=',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-zoom-in');
          },
        },
        {
          label: 'Diminuir Zoom (Zoom Out)',
          accelerator: 'CmdOrControl+-',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-zoom-out');
          },
        },
        {
          label: 'Zoom 100%',
          accelerator: 'CmdOrControl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-zoom-reset');
          },
        },
        { type: 'separator' },
        {
          label: 'Enquadrar Todos os Cards',
          accelerator: 'CmdOrControl+Shift+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-zoom-fit');
          },
        },
      ],
    },
    {
      label: 'Janela',
      submenu: [
        {
          label: 'Mover para Monitor',
          submenu: moveSubmenu.length > 0 ? moveSubmenu : [{ label: 'Apenas 1 monitor detectado', enabled: false }],
        },
        {
          label: 'Alternar para o Próximo Monitor',
          accelerator: 'Cmd+Shift+M',
          enabled: displays.length > 1,
          click: () => moveToNextDisplay(),
        },
        { type: 'separator' },
        {
          label: 'Minimizar',
          role: 'minimize',
        },
        {
          label: 'Alternar Tela Cheia (Zen)',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createStudioWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    title: 'Insighter',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    width: 1540,
    height: 960,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#161514',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');

  if (process.env.ELECTRON_USE_DEV === 'true') {
    mainWindow.loadURL(devServerUrl);
  } else if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL(devServerUrl);
  }

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    hideToMenuBar();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideToMenuBar();
    }
  });

  mainWindow.on('moved', () => {
    configureAppMenu();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || (!input.meta && !input.control)) return;
    const key = input.key.toLowerCase();
    if (key === 'c') {
      mainWindow.webContents.copy();
      event.preventDefault();
    } else if (key === 'v') {
      mainWindow.webContents.paste();
      event.preventDefault();
    } else if (key === 'x') {
      mainWindow.webContents.cut();
      event.preventDefault();
    } else if (key === 'a') {
      mainWindow.webContents.selectAll();
      event.preventDefault();
    } else if (key === 'z') {
      if (input.shift) {
        mainWindow.webContents.redo();
      } else {
        mainWindow.webContents.undo();
      }
      event.preventDefault();
    } else if (key === 'm' && input.shift) {
      moveToNextDisplay();
      event.preventDefault();
    } else if (key === 'h' || key === 'w') {
      hideToMenuBar();
      event.preventDefault();
    } else if (key === 'q') {
      isQuitting = true;
      app.quit();
      event.preventDefault();
    } else if (
      key === '+' ||
      key === '=' ||
      input.code === 'Equal' ||
      input.code === 'NumpadAdd'
    ) {
      mainWindow.webContents.send('menu-zoom-in');
      event.preventDefault();
    } else if (
      key === '-' ||
      key === '_' ||
      input.code === 'Minus' ||
      input.code === 'NumpadSubtract'
    ) {
      mainWindow.webContents.send('menu-zoom-out');
      event.preventDefault();
    } else if (key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
      if (input.shift) {
        mainWindow.webContents.send('menu-zoom-fit');
      } else {
        mainWindow.webContents.send('menu-zoom-reset');
      }
      event.preventDefault();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    configureAppMenu();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('insighter:toggle-native-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('insighter:hide-to-menubar', () => {
  hideToMenuBar();
  return true;
});

ipcMain.handle('insighter:get-displays', () => {
  return getConnectedDisplaysInfo();
});

ipcMain.handle('insighter:move-to-display', (_event, displayId) => {
  const displays = screen.getAllDisplays();
  const target = displays.find((d) => d.id === displayId);
  if (target) {
    moveWindowToDisplay(target);
    return true;
  }
  return false;
});

ipcMain.handle('insighter:load-source-from-path', (_event, rawPath) => {
  try {
    const resolved = normalizeUserFilePath(rawPath);
    if (!resolved) {
      return { ok: false, error: 'Caminho vazio.' };
    }
    if (!fs.existsSync(resolved)) {
      return { ok: false, error: `Arquivo ou pasta não encontrado: ${resolved}` };
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const entries = fs
        .readdirSync(resolved)
        .filter((name) => !name.startsWith('.'))
        .slice(0, 12);
      const loaded = [];
      for (const entry of entries) {
        const full = path.join(resolved, entry);
        if (fs.statSync(full).isFile()) {
          loaded.push(readSingleFileAsSource(full));
        }
      }
      if (loaded.length === 0) {
        return { ok: false, error: 'Nenhum arquivo suportado encontrado na pasta.' };
      }
      return { ok: true, sources: loaded };
    }

    const single = readSingleFileAsSource(resolved);
    return { ok: true, sources: [single] };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : 'Erro ao ler o caminho informado.',
    };
  }
});

ipcMain.handle('insighter:extract-pdf-text', (_event, rawPath) => {
  try {
    const resolved = normalizeUserFilePath(rawPath);
    if (!resolved || !fs.existsSync(resolved)) {
      return { ok: false, error: 'Arquivo não encontrado.' };
    }
    const text = extractPdfTextMacOS(resolved);
    return { ok: true, text, length: text.length };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : 'Erro ao extrair PDF' };
  }
});

ipcMain.handle('insighter:check-for-updates', (_event, silent = false) => {
  return checkForAppUpdates({ silent: Boolean(silent) });
});

ipcMain.handle('insighter:install-update', () => {
  return downloadAndInstallUpdate();
});

ipcMain.handle('insighter:get-update-state', () => {
  const { repo } = getGitHubUpdateConfig();
  return {
    ...currentUpdateState,
    repo: repo || currentUpdateState.repo,
  };
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  configureAppMenu();
  createMenuBarTray();
  createStudioWindow();

  // Verificação automática de atualização via GitHub Releases ao iniciar e a cada 30 min
  setTimeout(() => {
    checkForAppUpdates({ silent: true });
  }, 4500);
  setInterval(() => {
    checkForAppUpdates({ silent: true });
  }, 30 * 60 * 1000);

  // Atualiza menus dinamicamente quando monitores forem conectados ou desconectados
  screen.on('display-added', () => configureAppMenu());
  screen.on('display-removed', () => configureAppMenu());
  screen.on('display-metrics-changed', () => configureAppMenu());

  app.on('activate', () => {
    showFromMenuBar();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
