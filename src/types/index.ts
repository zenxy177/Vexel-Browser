export type TabStatus = 'active' | 'background' | 'hibernated' | 'loading' | 'error';

export interface Tab {
  id: string;
  spaceId: string;
  title: string;
  url: string;
  favicon?: string;
  isPinned: boolean;
  isHibernated: boolean;
  lastAccessed: number;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isActive?: boolean;
  errorMessage?: string;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string; // Gradient or hex
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  dateAdded?: number;
  folder?: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  visitTime: number;
  searchTerm?: string;
}

export interface ChromeHistoryImportResult {
  status: 'success' | 'no_profile' | 'no_history' | 'read_error';
  items: HistoryItem[];
  errorMessage?: string;
}

export interface ChromeImportResult {
  status: 'no_profile' | 'no_bookmarks' | 'success' | 'read_error';
  bookmarks: Bookmark[];
  profileCount: number;
  errorMessage?: string;
}

export interface ChromeProfile {
  id: string;
  name: string;
  hasBookmarks: boolean;
  hasHistory: boolean;
}

export interface BrowserDownload {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  receivedBytes: number;
  totalBytes: number;
  state: 'progressing' | 'paused' | 'completed' | 'cancelled' | 'interrupted';
  canResume: boolean;
  startTime: number;
  error?: string;
}

export interface SecurityStats {
  adsBlocked: number;
  trackersBlocked: number;
  blockedPopups: number;
  httpsUpgraded: number;
  isShieldActive: boolean;
  filterListDomains: number;
  filterListUpdatedAt: number | null;
  filterListStatus: 'bundled' | 'ready' | 'updating' | 'error';
  filterListError?: string;
  allowedSites: string[];
  recentBlocked: BlockedRequest[];
}

export interface BlockedRequest {
  domain: string;
  site: string;
  resourceType: string;
  timestamp: number;
  category: 'ad' | 'tracker';
}

export interface ContextualTranslation {
  text: string;
  translation: string;
  sourceLang: string;
  targetLang: string;
  x: number;
  y: number;
  isError?: boolean;
  errorMessage?: string;
}

export interface GoogleService {
  id: string;
  name: string;
  url: string;
  icon: string;
  color: string;
  description: string;
}

export interface MemoryMetrics {
  totalMB: number;
  mainProcessMB: number;
  processCount: number;
  isUnavailable?: boolean;
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  version?: string;
  percent?: number;
  message?: string;
}

// Window Augmentation for znyAPI
declare global {
  interface Window {
    znyAPI: {
      minimize: () => Promise<void>;
      maximize: () => Promise<boolean>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      checkChromeInstalled: () => Promise<boolean>;
      getChromeProfiles: () => Promise<ChromeProfile[]>;
      importChromeBookmarks: () => Promise<ChromeImportResult>;
      importChromeBookmarksForProfile: (profileId: string) => Promise<ChromeImportResult>;
      selectChromeProfile: () => Promise<ChromeImportResult | null>;
      importChromeHistory: () => Promise<ChromeHistoryImportResult>;
      importChromeHistoryForProfile: (profileId: string) => Promise<ChromeHistoryImportResult>;
      selectChromeHistoryProfile: () => Promise<ChromeHistoryImportResult | null>;
      getSecurityStats: () => Promise<SecurityStats>;
      setShieldActive: (active: boolean) => Promise<SecurityStats>;
      setSiteProtection: (site: string, allowed: boolean) => Promise<SecurityStats>;
      refreshAdBlockerFilters: () => Promise<SecurityStats>;
      getGoogleSuggestions: (query: string) => Promise<string[]>;
      translateText: (text: string, targetLang?: string) => Promise<{
        success: boolean;
        originalText: string;
        translatedText?: string;
        sourceLang?: string;
        targetLang?: string;
        error?: string;
      } | null>;
      getMemoryMetrics: () => Promise<MemoryMetrics>;
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{ ok: boolean; message?: string }>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
      onOpenNewTab: (callback: (url: string, isPopup: boolean, shouldFocus: boolean) => void) => () => void;
      onBlockedMainFrameNavigation: (callback: (webContentsId: number) => void) => () => void;
      onBrowserShortcut: (callback: (shortcut: string) => void) => () => void;
      onFullscreenChanged: (callback: (isFullscreen: boolean) => void) => () => void;
      getWebviewPreloadPath: () => Promise<string>;
      getWebviewPreloadPathSync: () => string;
      getDownloads: () => Promise<BrowserDownload[]>;
      controlDownload: (id: string, action: 'pause' | 'resume' | 'cancel' | 'remove') => Promise<boolean>;
      openDownloadedFile: (id: string) => Promise<string>;
      showDownloadInFolder: (id: string) => Promise<boolean>;
      onDownloadsChanged: (callback: (downloads: BrowserDownload[]) => void) => () => void;
    };
  }
}
