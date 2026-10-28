export interface Tab {
  id: string;
  spaceId: string;
  title: string;
  url: string;
  favicon?: string;
  isPinned: boolean;
  isHibernated: boolean; // Memory sleeping state
  lastAccessed: number;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  dateAdded?: number;
  folder?: string;
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

export interface BlockedRequest {
  domain: string;
  site: string;
  resourceType: string;
  timestamp: number;
  category: 'ad' | 'tracker';
}

export interface AdBlockerStats {
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

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  visitTime: number;
}

export interface GoogleService {
  id: string;
  name: string;
  url: string;
  iconName: string;
  color: string;
}

export interface SecurityStats {
  adsBlocked: number;
  trackersBlocked: number;
  httpsUpgraded: number;
  isShieldActive: boolean;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  contextExplanation?: string;
}
