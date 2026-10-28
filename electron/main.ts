import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'path';
import https from 'https';
import { fileURLToPath, pathToFileURL } from 'url';
import { adBlocker } from './adblocker';
import { ChromeImporter } from './chrome-importer';
import { ChromeHistoryImporter } from './chrome-history-importer';
import { getChromeProfilePath, getChromeProfiles } from './chrome-profiles';
import { isAllowedWebviewSource, isSafeWebUrl, isTrustedAppFrameUrl } from './security-policy';
import { AdBlockerStats, BrowserDownload } from './types';
import { getPermissionLabel, getSecurePermissionOrigin, isSitePermission } from './site-permissions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let isUpdateCheckRunning = false;
const sitePermissionDecisions = new Map<string, boolean>();
const sessionPermissionDecisions = new Map<string, boolean>();
const pendingPermissionPrompts = new Map<string, Promise<boolean>>();
const downloads = new Map<string, BrowserDownload>();
const activeDownloads = new Map<string, Electron.DownloadItem>();
let sitePermissionsLoaded = false;
const MAX_DOWNLOAD_HISTORY = 100;

const permissionDecisionKey = (origin: string, permission: string) => `${origin}\u0000${permission}`;

function emptyAdBlockerStats(): AdBlockerStats {
  return {
    adsBlocked: 0,
    trackersBlocked: 0,
    blockedPopups: 0,
    httpsUpgraded: 0,
    isShieldActive: false,
    filterListDomains: 0,
    filterListUpdatedAt: null,
    filterListStatus: 'bundled',
    allowedSites: [],
    recentBlocked: [],
  };
}

function loadSitePermissionDecisions(): void {
  if (sitePermissionsLoaded) return;
  sitePermissionsLoaded = true;
  const permissionsPath = path.join(app.getPath('userData'), 'site-permissions.json');
  try {
    const persisted = JSON.parse(fs.readFileSync(permissionsPath, 'utf8')) as Record<string, Record<string, unknown>>;
    for (const [origin, decisions] of Object.entries(persisted)) {
      if (getSecurePermissionOrigin(origin) !== origin || !decisions || typeof decisions !== 'object') continue;
      for (const [permission, allowed] of Object.entries(decisions)) {
        if (isSitePermission(permission) && typeof allowed === 'boolean') {
          sitePermissionDecisions.set(permissionDecisionKey(origin, permission), allowed);
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Could not load saved site permission decisions:', error);
    }
  }
}

function saveSitePermissionDecisions(): void {
  const serialized: Record<string, Record<string, boolean>> = {};
  for (const [key, allowed] of sitePermissionDecisions) {
    const [origin, permission] = key.split('\u0000');
    if (!origin || !permission) continue;
    serialized[origin] ??= {};
    serialized[origin][permission] = allowed;
  }
  try {
    fs.writeFileSync(
      path.join(app.getPath('userData'), 'site-permissions.json'),
      JSON.stringify(serialized, null, 2),
      'utf8',
    );
  } catch (error) {
    console.error('Could not save site permission decisions:', error);
  }
}

function configureSitePermissionHandlers(): void {
  loadSitePermissionDecisions();
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission === 'fullscreen') return true;
    if (!isSitePermission(permission)) return false;
    const origin = getSecurePermissionOrigin(details.securityOrigin || requestingOrigin);
    if (!origin) return false;
    const key = permissionDecisionKey(origin, permission);
    return sitePermissionDecisions.get(key) ?? sessionPermissionDecisions.get(key) ?? false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const request = details as Electron.PermissionRequest;
    if (permission === 'fullscreen') {
      callback(Boolean(request.isMainFrame));
      return;
    }
    if (!isSitePermission(permission) || !request.isMainFrame) {
      callback(false);
      return;
    }

    const origin = getSecurePermissionOrigin(request.requestingUrl);
    if (!origin || getSecurePermissionOrigin(webContents.getURL()) !== origin) {
      callback(false);
      return;
    }

    const key = permissionDecisionKey(origin, permission);
    const savedDecision = sitePermissionDecisions.get(key);
    if (savedDecision !== undefined) {
      callback(savedDecision);
      return;
    }

    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined;
    const prompt = pendingPermissionPrompts.get(key) ?? (async () => {
      const options: Electron.MessageBoxOptions = {
        type: 'question',
        title: 'Site izni isteği',
        message: `${origin} ${getPermissionLabel(permission, mediaTypes)} için izin istiyor.`,
        detail: 'Yalnızca güvendiğiniz sitelere izin verin. HTTP bağlantıları ve gömülü çerçeveler reddedilir.',
        buttons: ['İzin ver', 'Engelle'],
        defaultId: 1,
        cancelId: 1,
        checkboxLabel: 'Bu site için seçimi hatırla',
      };
      const result = mainWindow && !mainWindow.isDestroyed()
        ? await dialog.showMessageBox(mainWindow, options)
        : await dialog.showMessageBox(options);
      const allowed = result.response === 0;
      sessionPermissionDecisions.set(key, allowed);
      if (result.checkboxChecked) {
        sitePermissionDecisions.set(key, allowed);
        saveSitePermissionDecisions();
      }
      return allowed;
    })().catch(error => {
      console.error(`Could not show ${permission} permission prompt for ${origin}:`, error);
      return false;
    }).finally(() => {
      pendingPermissionPrompts.delete(key);
    });

    pendingPermissionPrompts.set(key, prompt);
    void prompt.then(callback);
  });
}

function sendDownloads(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const items = [...downloads.values()].sort((a, b) => b.startTime - a.startTime);
  mainWindow.webContents.send('downloads-changed', items);
}

function pruneDownloads(): void {
  if (downloads.size <= MAX_DOWNLOAD_HISTORY) return;
  const completedDownloads = [...downloads.values()]
    .filter(download => !activeDownloads.has(download.id))
    .sort((a, b) => a.startTime - b.startTime);
  while (downloads.size > MAX_DOWNLOAD_HISTORY && completedDownloads.length > 0) {
    const oldest = completedDownloads.shift();
    if (oldest) downloads.delete(oldest.id);
  }
}

function updateDownload(id: string, item: Electron.DownloadItem, state?: string, error?: string): void {
  const previous = downloads.get(id);
  if (!previous) return;
  const itemState = state ?? item.getState();
  downloads.set(id, {
    ...previous,
    filename: item.getFilename(),
    savePath: item.getSavePath(),
    receivedBytes: item.getReceivedBytes(),
    totalBytes: item.getTotalBytes(),
    canResume: item.canResume(),
    state: itemState === 'completed' || itemState === 'cancelled' || itemState === 'interrupted'
      ? itemState
      : item.isPaused() ? 'paused' : 'progressing',
    error,
  });
  sendDownloads();
}

type UpdateStatus = {
  state: 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  version?: string;
  percent?: number;
  message?: string;
};

// The built directory structure
//
// ├─┬ dist-electron
// │ ├── main.js
// │ ├── preload.js
// │ └── webview-preload.js
// ├─┬ dist
// │ └── index.html

process.env.DIST_ELECTRON = path.join(__dirname, '../');
process.env.DIST = path.join(process.env.DIST_ELECTRON, '../dist');
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST;

// Hardware acceleration flags (Chromium site isolation is preserved for security)
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization');
app.commandLine.appendSwitch('high-dpi-support', '1');

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Sleek frameless Arc window
    backgroundColor: '#0F1117',
    icon: path.join(process.env.VITE_PUBLIC ?? path.join(__dirname, '../dist'), 'zny.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Required for tabbed webviews
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });

  // Initialize ad blocker on default session
  await adBlocker.initialize(session.defaultSession, app.getPath('userData'), (webContentsId) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('blocked-main-frame-navigation', webContentsId);
    }
  });

  configureSitePermissionHandlers();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Sender Authorization Validator
function isAuthorizedSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const senderFrame = event.senderFrame;
  const mainFrame = event.sender.mainFrame;
  if (
    event.sender.id !== mainWindow.webContents.id ||
    !senderFrame ||
    senderFrame.processId !== mainFrame.processId ||
    senderFrame.routingId !== mainFrame.routingId
  ) {
    return false;
  }

  const appDocumentUrl = pathToFileURL(path.join(__dirname, '../dist/index.html')).toString();
  return isTrustedAppFrameUrl(senderFrame.url, process.env.VITE_DEV_SERVER_URL, appDocumentUrl);
}

function sendUpdateStatus(status: Omit<UpdateStatus, 'currentVersion'>): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update-status', {
    ...status,
    currentVersion: app.getVersion(),
  } satisfies UpdateStatus);
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.allowPrerelease = false;

autoUpdater.on('checking-for-update', () => {
  sendUpdateStatus({ state: 'checking' });
});
autoUpdater.on('update-available', (info) => {
  isUpdateCheckRunning = false;
  sendUpdateStatus({ state: 'available', version: info.version });
});
autoUpdater.on('update-not-available', () => {
  isUpdateCheckRunning = false;
  sendUpdateStatus({ state: 'up-to-date' });
});
autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus({ state: 'downloading', percent: progress.percent });
});
autoUpdater.on('update-downloaded', (info) => {
  sendUpdateStatus({ state: 'downloaded', version: info.version });
});
autoUpdater.on('error', (error) => {
  isUpdateCheckRunning = false;
  console.error('Update process failed:', error);
  sendUpdateStatus({ state: 'error', message: error.message });
});

ipcMain.handle('get-app-version', (event) => {
  if (!isAuthorizedSender(event)) {
    console.warn('Rejected app version request from an unauthorized renderer.');
    return '';
  }
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async (event) => {
  if (!isAuthorizedSender(event)) {
    console.warn('Rejected update check from an unauthorized renderer.');
    return { ok: false, message: 'Güncelleme isteğine izin verilmedi.' };
  }
  if (!app.isPackaged) {
    const message = 'Güncelleme denetimi yalnızca kurulu uygulama sürümünde kullanılabilir.';
    sendUpdateStatus({
      state: 'error',
      message,
    });
    return { ok: false, message };
  }
  if (isUpdateCheckRunning) return { ok: true };
  isUpdateCheckRunning = true;
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    isUpdateCheckRunning = false;
    console.error('Could not check for updates:', error);
    const message = error instanceof Error ? error.message : 'Güncelleme denetlenemedi.';
    sendUpdateStatus({
      state: 'error',
      message,
    });
    return { ok: false, message };
  }
});

ipcMain.handle('download-update', async (event) => {
  if (!isAuthorizedSender(event) || !app.isPackaged) return;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error('Could not download update:', error);
    sendUpdateStatus({
      state: 'error',
      message: error instanceof Error ? error.message : 'Güncelleme indirilemedi.',
    });
  }
});

ipcMain.handle('install-update', (event) => {
  if (!isAuthorizedSender(event) || !app.isPackaged) return;
  autoUpdater.quitAndInstall();
});

// IPC Handlers: Window Controls
ipcMain.handle('window-minimize', (event) => {
  if (!isAuthorizedSender(event)) return;
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', (event) => {
  if (!isAuthorizedSender(event)) return false;
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow?.maximize();
    return true;
  }
});

ipcMain.handle('window-close', (event) => {
  if (!isAuthorizedSender(event)) return;
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  if (!isAuthorizedSender(event)) return false;
  return mainWindow?.isMaximized() ?? false;
});

// IPC Handlers: Chrome Importer
ipcMain.handle('check-chrome-installed', (event) => {
  if (!isAuthorizedSender(event)) return false;
  return ChromeImporter.checkChromeInstalled();
});

ipcMain.handle('get-chrome-profiles', (event) => {
  if (!isAuthorizedSender(event)) return [];
  return getChromeProfiles();
});

ipcMain.handle('import-chrome-bookmarks', (event) => {
  if (!isAuthorizedSender(event)) {
    return { status: 'read_error', bookmarks: [], profileCount: 0, errorMessage: 'Yetkisiz erişim çağrısı.' };
  }
  return ChromeImporter.importBookmarks();
});

ipcMain.handle('import-chrome-bookmarks-for-profile', (event, profileId: string) => {
  if (!isAuthorizedSender(event)) {
    return { status: 'read_error', bookmarks: [], profileCount: 0, errorMessage: 'Yetkisiz erişim çağrısı.' };
  }
  const profilePath = getChromeProfilePath(profileId);
  if (!profilePath) {
    return { status: 'no_profile', bookmarks: [], profileCount: 0, errorMessage: 'Seçilen Chrome profili bulunamadı.' };
  }
  return ChromeImporter.importBookmarksForProfile(profilePath);
});

ipcMain.handle('select-chrome-profile', async (event) => {
  if (!isAuthorizedSender(event) || !mainWindow) {
    return { status: 'read_error', bookmarks: [], profileCount: 0, errorMessage: 'Klasör seçimine izin verilmedi.' };
  }

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Chrome kullanıcı verisi veya profil klasörünü seçin',
    buttonLabel: 'Bu klasörü tara',
    properties: ['openDirectory'],
  });
  if (selection.canceled || selection.filePaths.length === 0) return null;
  return ChromeImporter.importBookmarks(selection.filePaths[0]);
});

ipcMain.handle('import-chrome-history', (event) => {
  if (!isAuthorizedSender(event)) {
    return { status: 'read_error', items: [], errorMessage: 'Yetkisiz erişim çağrısı.' };
  }
  return ChromeHistoryImporter.importHistory();
});

ipcMain.handle('import-chrome-history-for-profile', (event, profileId: string) => {
  if (!isAuthorizedSender(event)) {
    return { status: 'read_error', items: [], errorMessage: 'Yetkisiz erişim çağrısı.' };
  }
  return ChromeHistoryImporter.importHistoryForProfile(profileId);
});

ipcMain.handle('select-chrome-history-profile', async (event) => {
  if (!isAuthorizedSender(event) || !mainWindow) {
    return { status: 'read_error', items: [], errorMessage: 'Klasör seçimine izin verilmedi.' };
  }

  const selection = await dialog.showOpenDialog(mainWindow, {
    title: 'Chrome kullanıcı verisi veya profil klasörünü seçin',
    buttonLabel: 'Geçmişi içe aktar',
    properties: ['openDirectory'],
  });
  if (selection.canceled || selection.filePaths.length === 0) return null;
  return ChromeHistoryImporter.importHistory(selection.filePaths[0]);
});

// IPC Handlers: Security Shield
ipcMain.handle('get-security-stats', (event) => {
  if (!isAuthorizedSender(event)) return emptyAdBlockerStats();
  return adBlocker.getStats();
});

ipcMain.handle('set-shield-active', (event, active: boolean) => {
  if (!isAuthorizedSender(event)) return emptyAdBlockerStats();
  if (typeof active !== 'boolean') return adBlocker.getStats();
  adBlocker.setShieldActive(active);
  return adBlocker.getStats();
});

ipcMain.handle('set-site-protection', (event, site: string, allowed: boolean) => {
  if (!isAuthorizedSender(event)) return emptyAdBlockerStats();
  if (typeof site !== 'string' || site.length > 253 || typeof allowed !== 'boolean') {
    throw new Error('Geçerli bir alan adı ve kalkan tercihi gerekli.');
  }
  return adBlocker.setSiteAllowed(site, allowed);
});

ipcMain.handle('refresh-adblock-filters', async (event) => {
  if (!isAuthorizedSender(event)) return emptyAdBlockerStats();
  return adBlocker.refreshFilterList();
});

// IPC Handlers: Google Suggestions
ipcMain.handle('get-google-suggestions', async (event, query: string) => {
  if (!isAuthorizedSender(event) || typeof query !== 'string' || !query.trim() || query.length > 300) {
    return [];
  }

  const cleanQuery = query.trim();
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(cleanQuery)}`;
  try {
    const parsed = await getHttpsJson(url, 64 * 1024);
    if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
      return parsed[1].filter((item): item is string => typeof item === 'string').slice(0, 7);
    }
    throw new Error('Unexpected suggestions response');
  } catch (err) {
    console.warn('Google suggestions request failed:', err);
    throw new Error('Google suggestions are temporarily unavailable');
  }
});

// IPC Handlers: Translation (Google Translate API)
ipcMain.handle('translate-text', async (event, text: string, targetLang = 'tr') => {
  if (!isAuthorizedSender(event) || typeof text !== 'string' || !text.trim() || text.length > 4000) {
    return null;
  }

  const cleanLang = typeof targetLang === 'string' && /^[a-zA-Z-]{2,10}$/.test(targetLang) ? targetLang : 'tr';
  const cleanText = text.trim();

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${cleanLang}&dt=t&dt=bd&q=${encodeURIComponent(cleanText)}`;
  try {
    const parsed = await getHttpsJson(url, 1024 * 1024);
    let translatedText = '';
    if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
      for (const item of parsed[0]) {
        if (Array.isArray(item) && typeof item[0] === 'string') {
          translatedText += item[0];
        }
      }
    }
    if (!translatedText) {
      return {
        success: false,
        originalText: cleanText,
        error: 'Çeviri servisi boş metin döndürdü.',
      };
    }

    return {
      success: true,
      originalText: cleanText,
      translatedText,
      sourceLang: Array.isArray(parsed) && typeof parsed[2] === 'string' ? parsed[2] : 'auto',
      targetLang: cleanLang,
    };
  } catch (err) {
    console.error('Translation request failed:', err);
    return {
      success: false,
      originalText: cleanText,
      error: 'Çeviri sunucusuna ulaşılamadı veya geçersiz yanıt verdi.',
    };
  }
});

function getHttpsJson(url: string, maxResponseBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        fail(new Error(`Unexpected HTTP status ${response.statusCode ?? 'unknown'}`));
        return;
      }

      const contentLength = Number(response.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
        response.destroy(new Error('Response exceeded size limit'));
        fail(new Error('Response exceeded size limit'));
        return;
      }

      let responseBytes = 0;
      let responseBody = '';
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        responseBytes += buffer.length;
        if (responseBytes > maxResponseBytes) {
          request.destroy(new Error('Response exceeded size limit'));
          return;
        }
        responseBody += buffer.toString('utf8');
      });
      response.on('end', () => {
        try {
          const result: unknown = JSON.parse(responseBody);
          if (settled) return;
          settled = true;
          resolve(result);
        } catch {
          fail(new Error('Invalid JSON response'));
        }
      });
      response.on('error', fail);
    });

    request.setTimeout(8000, () => request.destroy(new Error('Request timed out')));
    request.on('error', fail);
  });
}

// IPC Handler: Real memory metrics from Electron process and app metrics
ipcMain.handle('get-memory-metrics', async (event) => {
  if (!isAuthorizedSender(event)) {
    return { totalMB: 0, mainProcessMB: 0, processCount: 0, isUnavailable: true };
  }
  try {
    const metrics = app.getAppMetrics();
    let totalResidentSetKB = 0;
    for (const m of metrics) {
      const mem = m.memory as any;
      totalResidentSetKB += (mem?.residentSet || mem?.privateBytes || mem?.workingSetSize || 0);
    }
    const procMem = (await process.getProcessMemoryInfo()) as any;
    const nodeRssKB = Math.round(process.memoryUsage().rss / 1024);
    const mainResidentMB = Math.round((procMem?.residentSet || procMem?.private || nodeRssKB) / 1024);
    const totalMB = Math.round(totalResidentSetKB / 1024);
    return {
      totalMB: totalMB > 0 ? totalMB : mainResidentMB,
      mainProcessMB: mainResidentMB,
      processCount: metrics.length,
      isUnavailable: false,
    };
  } catch (err) {
    console.error('Failed to get memory metrics:', err);
    return { totalMB: 0, mainProcessMB: 0, processCount: 0, isUnavailable: true };
  }
});

// IPC Handler: Webview preload path
ipcMain.handle('get-webview-preload-path', (event) => {
  if (!isAuthorizedSender(event)) return '';
  return pathToFileURL(path.join(__dirname, 'webview-preload.js')).toString();
});

ipcMain.on('get-webview-preload-path-sync', (event) => {
  if (!isAuthorizedSender(event)) {
    event.returnValue = '';
    return;
  }
  event.returnValue = pathToFileURL(path.join(__dirname, 'webview-preload.js')).toString();
});

ipcMain.handle('get-downloads', (event) => {
  if (!isAuthorizedSender(event)) return [];
  return [...downloads.values()].sort((a, b) => b.startTime - a.startTime);
});

ipcMain.handle('control-download', (event, id: string, action: 'pause' | 'resume' | 'cancel' | 'remove') => {
  if (!isAuthorizedSender(event) || typeof id !== 'string') return false;
  const record = downloads.get(id);
  if (!record) return false;
  const item = activeDownloads.get(id);
  if (action === 'remove') {
    if (item) return false;
    downloads.delete(id);
    sendDownloads();
    return true;
  }
  if (!item) return false;
  if (action === 'pause' && !item.isPaused()) item.pause();
  else if (action === 'resume' && (item.isPaused() || item.canResume())) item.resume();
  else if (action === 'cancel') item.cancel();
  else return false;
  updateDownload(id, item);
  return true;
});

ipcMain.handle('open-downloaded-file', async (event, id: string) => {
  if (!isAuthorizedSender(event) || typeof id !== 'string') return 'Dosya açma isteğine izin verilmedi.';
  const record = downloads.get(id);
  if (!record || record.state !== 'completed' || !record.savePath || !fs.existsSync(record.savePath)) {
    return 'İndirilen dosya bulunamadı.';
  }
  return shell.openPath(record.savePath);
});

ipcMain.handle('show-download-in-folder', (event, id: string) => {
  if (!isAuthorizedSender(event) || typeof id !== 'string') return false;
  const record = downloads.get(id);
  if (!record || record.state !== 'completed' || !record.savePath || !fs.existsSync(record.savePath)) {
    return false;
  }
  shell.showItemInFolder(record.savePath);
  return true;
});

// Intercept popups / window.open across all WebContents and route to new tabs safely
app.on('web-contents-created', (_, contents) => {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.alt || !(input.control || input.meta)) return;

    const key = input.key.toLowerCase();
    const shortcuts: Record<string, string> = {
      k: 'command-palette',
      t: 'new-tab',
      w: 'close-tab',
      h: 'history',
      l: 'focus-address',
      r: 'reload',
      f: 'find-in-page',
      j: 'downloads',
    };
    const shortcut = input.shift && key === 't' ? 'reopen-closed-tab' : shortcuts[key];

    if (!shortcut) return;
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('browser-shortcut', shortcut);
    }
  });

  contents.on('will-attach-webview', (event, webPreferences, params) => {
    if (contents !== mainWindow?.webContents || !isAllowedWebviewSource(params.src || '')) {
      event.preventDefault();
      console.warn('Blocked webview attachment from an untrusted frame or URL.');
      return;
    }

    delete params.partition;
    webPreferences.preload = pathToFileURL(path.join(__dirname, 'webview-preload.js')).toString();
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
    webPreferences.plugins = false;
    webPreferences.webviewTag = false;
  });

  // Navigation guard: Block untrusted protocols (javascript:, file:, custom protocols)
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && navigationUrl !== 'about:blank') {
        event.preventDefault();
        console.warn(`Blocked navigation to untrusted protocol: ${navigationUrl}`);
      }
    } catch {
      event.preventDefault();
    }
  });

  // Window open guard: Only allow safe http/https popups to be opened as new tabs
  contents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && mainWindow && !mainWindow.isDestroyed()) {
        if (!adBlocker.shouldBlockPopup(contents.getURL(), url)) {
          mainWindow.webContents.send('open-new-tab', url, true);
        }
      }
    } catch {
      // invalid URL ignored
    }
    return { action: 'deny' };
  });

  contents.on('context-menu', (_event, params) => {
    if (
      contents.getType() !== 'webview' ||
      !mainWindow ||
      mainWindow.isDestroyed()
    ) {
      return;
    }

    const template: Electron.MenuItemConstructorOptions[] = [];
    const addSeparator = () => {
      if (template.length > 0 && template[template.length - 1].type !== 'separator') {
        template.push({ type: 'separator' });
      }
    };
    const addSafeOpenAction = (label: string, url: string) => {
      if (!isSafeWebUrl(url)) return;
      template.push({
        label,
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.focus();
            mainWindow.webContents.send('open-new-tab', url);
          }
        },
      });
    };

    if (params.isEditable) {
      template.push(
        { label: 'Geri Al', role: 'undo', enabled: params.editFlags.canUndo },
        { label: 'Yinele', role: 'redo', enabled: params.editFlags.canRedo },
      );
      addSeparator();
      template.push(
        { label: 'Kes', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Kopyala', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Yapıştır', role: 'paste', enabled: params.editFlags.canPaste },
      );
      addSeparator();
      template.push({ label: 'Tümünü Seç', role: 'selectAll', enabled: params.editFlags.canSelectAll });
    } else {
      if (params.linkURL) {
        addSafeOpenAction('Bağlantıyı yeni sekmede aç', params.linkURL);
        template.push({
          label: 'Bağlantı adresini kopyala',
          click: () => clipboard.writeText(params.linkURL),
        });
      }

      if (params.mediaType === 'image' && params.srcURL) {
        addSeparator();
        addSafeOpenAction('Resmi yeni sekmede aç', params.srcURL);
        if (isSafeWebUrl(params.srcURL)) {
          template.push({
            label: 'Resmi farklı kaydet…',
            click: () => contents.downloadURL(params.srcURL),
          });
        }
        template.push({
          label: 'Resmi kopyala',
          click: () => contents.copyImageAt(params.x, params.y),
        });
        template.push({
          label: 'Resim adresini kopyala',
          click: () => clipboard.writeText(params.srcURL),
        });
      }

      const selectedText = params.selectionText.trim();
      if (selectedText) {
        addSeparator();
        template.push({
          label: 'Kopyala',
          role: 'copy',
        });
        template.push({
          label: `Google’da “${selectedText.slice(0, 48)}${selectedText.length > 48 ? '…' : ''}” ara`,
          click: () => {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(selectedText.slice(0, 2000))}`;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-new-tab', searchUrl);
            }
          },
        });
      }

      addSeparator();
      template.push(
        { label: 'Geri', enabled: contents.canGoBack(), click: () => contents.goBack() },
        { label: 'İleri', enabled: contents.canGoForward(), click: () => contents.goForward() },
        { label: 'Yenile', click: () => contents.reload() },
      );
    }

    if (template.length === 0) return;
    Menu.buildFromTemplate(template).popup({ window: mainWindow });
  });
});

app.whenReady().then(() => {
  session.defaultSession.on('will-download', (event, item) => {
    const options = { defaultPath: item.getFilename() };
    const filePath = mainWindow && !mainWindow.isDestroyed()
      ? dialog.showSaveDialogSync(mainWindow, options)
      : dialog.showSaveDialogSync(options);

    if (!filePath) {
      event.preventDefault();
      return;
    }
    item.setSavePath(filePath);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    downloads.set(id, {
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      savePath: filePath,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      state: 'progressing',
      canResume: false,
      startTime: Date.now(),
    });
    activeDownloads.set(id, item);
    item.on('updated', (_downloadEvent, state) => updateDownload(id, item, state));
    item.once('done', (_downloadEvent, state) => {
      const error = state === 'interrupted' ? 'İndirme kesildi. Yeniden deneyin.' : undefined;
      updateDownload(id, item, state, error);
      if (state !== 'interrupted' || !item.canResume()) activeDownloads.delete(id);
      pruneDownloads();
      sendDownloads();
    });
    pruneDownloads();
    sendDownloads();
  });
  void createWindow().catch(error => {
    console.error('Could not initialize the browser window:', error);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow().catch(error => {
      console.error('Could not reopen the browser window:', error);
    });
  }
});
