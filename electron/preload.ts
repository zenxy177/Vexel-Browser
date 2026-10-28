import { contextBridge, ipcRenderer } from 'electron';
import { AdBlockerStats, BrowserDownload } from './types';

contextBridge.exposeInMainWorld('znyAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Chrome Importer
  checkChromeInstalled: () => ipcRenderer.invoke('check-chrome-installed'),
  getChromeProfiles: () => ipcRenderer.invoke('get-chrome-profiles'),
  importChromeBookmarks: () => ipcRenderer.invoke('import-chrome-bookmarks'),
  importChromeBookmarksForProfile: (profileId: string) => ipcRenderer.invoke('import-chrome-bookmarks-for-profile', profileId),
  importChromeHistory: () => ipcRenderer.invoke('import-chrome-history'),
  importChromeHistoryForProfile: (profileId: string) => ipcRenderer.invoke('import-chrome-history-for-profile', profileId),
  selectChromeHistoryProfile: () => ipcRenderer.invoke('select-chrome-history-profile'),
  selectChromeProfile: () => ipcRenderer.invoke('select-chrome-profile'),

  // Security Shield
  getSecurityStats: () => ipcRenderer.invoke('get-security-stats'),
  setShieldActive: (active: boolean) => ipcRenderer.invoke('set-shield-active', active),
  setSiteProtection: (site: string, allowed: boolean): Promise<AdBlockerStats> =>
    ipcRenderer.invoke('set-site-protection', site, allowed),
  refreshAdBlockerFilters: (): Promise<AdBlockerStats> => ipcRenderer.invoke('refresh-adblock-filters'),

  // Google Suggestions (Omnibox)
  getGoogleSuggestions: (query: string) => ipcRenderer.invoke('get-google-suggestions', query),

  // Translation
  translateText: (text: string, targetLang?: string) => ipcRenderer.invoke('translate-text', text, targetLang),

  // Memory metrics
  getMemoryMetrics: () => ipcRenderer.invoke('get-memory-metrics'),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: (): Promise<{ ok: boolean; message?: string }> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (status: {
    state: 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error';
    currentVersion: string;
    version?: string;
    percent?: number;
    message?: string;
  }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: Parameters<typeof callback>[0]) => callback(status);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // Open in new tab listener from web contents popup handler
  onOpenNewTab: (callback: (url: string, isPopup: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, url: string, isPopup: boolean) => callback(url, isPopup);
    ipcRenderer.on('open-new-tab', handler);
    return () => {
      ipcRenderer.removeListener('open-new-tab', handler);
    };
  },
  onBlockedMainFrameNavigation: (callback: (webContentsId: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, webContentsId: number) => callback(webContentsId);
    ipcRenderer.on('blocked-main-frame-navigation', handler);
    return () => ipcRenderer.removeListener('blocked-main-frame-navigation', handler);
  },
  onBrowserShortcut: (callback: (shortcut: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, shortcut: string) => callback(shortcut);
    ipcRenderer.on('browser-shortcut', handler);
    return () => ipcRenderer.removeListener('browser-shortcut', handler);
  },

  // Path to webview preload
  getWebviewPreloadPath: () => ipcRenderer.invoke('get-webview-preload-path'),
  getWebviewPreloadPathSync: () => ipcRenderer.sendSync('get-webview-preload-path-sync'),
  getDownloads: (): Promise<BrowserDownload[]> => ipcRenderer.invoke('get-downloads'),
  controlDownload: (id: string, action: 'pause' | 'resume' | 'cancel' | 'remove'): Promise<boolean> =>
    ipcRenderer.invoke('control-download', id, action),
  openDownloadedFile: (id: string): Promise<string> => ipcRenderer.invoke('open-downloaded-file', id),
  showDownloadInFolder: (id: string): Promise<boolean> => ipcRenderer.invoke('show-download-in-folder', id),
  onDownloadsChanged: (callback: (downloads: BrowserDownload[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, downloads: BrowserDownload[]) => callback(downloads);
    ipcRenderer.on('downloads-changed', handler);
    return () => ipcRenderer.removeListener('downloads-changed', handler);
  },
});
