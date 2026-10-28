import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Titlebar } from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { WebViewContainer } from './components/WebViewContainer';
import { CommandPalette } from './components/CommandPalette';
import { GoogleHubModal } from './components/GoogleHubModal';
import { ChromeImportModal } from './components/ChromeImportModal';
import { SecurityModal } from './components/SecurityModal';
import { TranslateTooltip } from './components/TranslateTooltip';
import { Tab, Space, Bookmark, HistoryItem, SecurityStats, ContextualTranslation, MemoryMetrics, UpdateStatus, BrowserDownload } from './types';
import { selectTabForSpace, hibernateIdleTabs, deduplicateBookmarks } from './utils/browser-logic';
import { HistoryModal } from './components/HistoryModal';
import { DownloadsModal } from './components/DownloadsModal';

const STORAGE_KEYS = {
  TABS: 'zny_browser_tabs',
  ACTIVE_SPACE: 'zny_browser_active_space',
  ACTIVE_TAB: 'zny_browser_active_tab',
  BOOKMARKS: 'zny_browser_bookmarks',
  HISTORY: 'zny_browser_history',
  PRIVACY: 'zny_browser_privacy_settings',
};

const INITIAL_SPACES: Space[] = [
  { id: 'space-personal', name: 'Kişisel', icon: 'User', color: '#3B82F6' },
  { id: 'space-work', name: 'İş & Proje', icon: 'Briefcase', color: '#10B981' },
  { id: 'space-research', name: 'Araştırma', icon: 'Compass', color: '#8B5CF6' },
];

const DEFAULT_INITIAL_TABS: Tab[] = [
  {
    id: 'tab-initial-1',
    spaceId: 'space-personal',
    title: 'Google',
    url: 'https://www.google.com/',
    isPinned: false,
    isHibernated: false,
    lastAccessed: Date.now(),
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
  },
  {
    id: 'tab-initial-2',
    spaceId: 'space-personal',
    title: 'Google Gemini',
    url: 'https://gemini.google.com/app',
    isPinned: true,
    isHibernated: false,
    lastAccessed: Date.now(),
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
  }
];

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

export const App: React.FC = () => {
  const [spaces, setSpaces] = useState<Space[]>(INITIAL_SPACES);

  // Restore activeSpaceId from localStorage
  const [activeSpaceId, setActiveSpaceId] = useState<string>(() => {
    try {
      const savedSpace = localStorage.getItem(STORAGE_KEYS.ACTIVE_SPACE);
      if (savedSpace && INITIAL_SPACES.some(s => s.id === savedSpace)) {
        return savedSpace;
      }
    } catch (error) {
      console.warn('Failed to restore active space from localStorage:', error);
    }
    return 'space-personal';
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 5000);
      }
    } catch (error) {
      console.warn('Failed to restore browsing history:', error);
    }
    return [];
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Restore tabs from localStorage
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TABS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sanitize tabs (reset transient loading / navigation state & normalize URLs)
          return parsed.map((t: Tab) => {
            let url = t.url;
            if (url === 'https://www.google.com') url = 'https://www.google.com/';
            if (url === 'https://gemini.google.com') url = 'https://gemini.google.com/app';
            return {
              ...t,
              url,
              lastAccessed: Date.now(),
              isLoading: false,
              canGoBack: false,
              canGoForward: false,
              errorMessage: undefined,
            };
          });
        }

      }
    } catch (e) {
      console.warn('Failed to load tabs from localStorage:', e);
    }
    return DEFAULT_INITIAL_TABS;
  });

  // Restore activeTabId from localStorage or select from active space using selectTabForSpace
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const savedSpace = localStorage.getItem(STORAGE_KEYS.ACTIVE_SPACE) || 'space-personal';
      const savedTabsRaw = localStorage.getItem(STORAGE_KEYS.TABS);
      const savedTabs: Tab[] = savedTabsRaw ? JSON.parse(savedTabsRaw) : [];
      const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || undefined;

      const selected = selectTabForSpace(savedTabs, savedSpace, savedTab);
      if (selected) {
        return selected.id;
      }
    } catch (error) {
      console.warn('Failed to restore active tab from localStorage:', error);
    }
    return 'tab-initial-1';
  });

  // Restore bookmarks from localStorage
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load bookmarks from localStorage:', e);
    }
    return [];
  });

  // Privacy settings: Google suggestions and text translation
  const [privacySettings, setPrivacySettings] = useState<{
    searchSuggestionsEnabled: boolean;
    selectionTranslationEnabled: boolean;
  }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PRIVACY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to restore privacy settings from localStorage:', error);
    }
    return {
      searchSuggestionsEnabled: true,
      selectionTranslationEnabled: true,
    };
  });

  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);
  const [popupTabIds, setPopupTabIds] = useState<Set<string>>(() => new Set());
  const popupTabTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const handleNewTabRef = useRef<(url?: string, isPopup?: boolean) => void>(() => {});
  const closedTabsRef = useRef<Tab[]>([]);

  // Modals & Overlays
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isGoogleHubOpen, setIsGoogleHubOpen] = useState(false);
  const [isChromeImportOpen, setIsChromeImportOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
  const [downloads, setDownloads] = useState<BrowserDownload[]>([]);
  const [contextualTranslation, setContextualTranslation] = useState<ContextualTranslation | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: 'idle',
    currentVersion: '',
  });
  const [appError, setAppError] = useState<string | null>(null);
  const memoryErrorReportedRef = useRef(false);
  const securityErrorReportedRef = useRef(false);

  const reportAppError = useCallback((message: string, error?: unknown) => {
    if (error !== undefined) console.error(message, error);
    setAppError(message);
  }, []);

  const handleDownloadAction = async (id: string, action: 'pause' | 'resume' | 'cancel' | 'remove') => {
    try {
      const succeeded = await window.znyAPI.controlDownload(id, action);
      if (!succeeded) reportAppError('İndirme işlemi tamamlanamadı. İndirme durumu değişmiş olabilir.');
    } catch (error) {
      reportAppError('İndirme yönetilemedi.', error);
    }
  };

  const handleOpenDownloadedFile = async (id: string) => {
    try {
      const errorMessage = await window.znyAPI.openDownloadedFile(id);
      if (errorMessage) reportAppError(`Dosya açılamadı: ${errorMessage}`);
    } catch (error) {
      reportAppError('İndirilen dosya açılamadı.', error);
    }
  };

  const handleShowDownloadInFolder = async (id: string) => {
    try {
      if (!await window.znyAPI.showDownloadInFolder(id)) {
        reportAppError('İndirilen dosya klasörde bulunamadı.');
      }
    } catch (error) {
      reportAppError('İndirilen dosyanın konumu açılamadı.', error);
    }
  };

  useEffect(() => {
    const api = window.znyAPI;
    if (!api?.getDownloads || !api.onDownloadsChanged) return;
    let isMounted = true;
    const unsubscribe = api.onDownloadsChanged(setDownloads);
    api.getDownloads().then(items => {
      if (isMounted) setDownloads(items);
    }).catch(error => {
      if (isMounted) reportAppError('İndirme listesi alınamadı.', error);
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [reportAppError]);

  // Real Memory Metrics from Electron process
  const [memoryMetrics, setMemoryMetrics] = useState<MemoryMetrics | undefined>(undefined);

  // Live Security Shield Stats
  const [securityStats, setSecurityStats] = useState<SecurityStats>({
    adsBlocked: 0,
    trackersBlocked: 0,
    blockedPopups: 0,
    httpsUpgraded: 0,
    isShieldActive: true,
    filterListDomains: 0,
    filterListUpdatedAt: null,
    filterListStatus: 'bundled',
    allowedSites: [],
    recentBlocked: [],
  });

  useEffect(() => {
    const api = window.znyAPI;
    if (!api || typeof api.getAppVersion !== 'function' || typeof api.onUpdateStatus !== 'function') {
      setUpdateStatus((status) => ({
        ...status,
        state: 'error',
        message: 'Uygulama köprüsü yüklenemedi. Uygulamayı yeniden kurun.',
      }));
      return;
    }

    const unsubscribe = api.onUpdateStatus(setUpdateStatus);
    api.getAppVersion().then((currentVersion) => {
      setUpdateStatus((status) => ({ ...status, currentVersion }));
    }).catch((error: unknown) => {
      console.error('Could not read app version:', error);
      setUpdateStatus((status) => ({
        ...status,
        state: 'error',
        message: 'Yüklü uygulama sürümü okunamadı.',
      }));
    });
    return () => unsubscribe?.();
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateStatus((status) => ({ ...status, state: 'checking', message: undefined }));
    if (!window.znyAPI?.checkForUpdates) {
      setUpdateStatus((status) => ({
        ...status,
        state: 'error',
        message: 'Güncelleme servisine ulaşılamıyor. Uygulamayı yeniden başlatıp tekrar deneyin.',
      }));
      return;
    }

    try {
      const result = await window.znyAPI.checkForUpdates();
      if (!result.ok) {
        setUpdateStatus((status) => ({
          ...status,
          state: 'error',
          message: result.message || 'Güncelleme denetlenemedi.',
        }));
      }
    } catch (error) {
      console.error('Update check request failed:', error);
      setUpdateStatus((status) => ({
        ...status,
        state: 'error',
        message: error instanceof Error ? error.message : 'Güncelleme isteği gönderilemedi.',
      }));
    }
  };

  // Save tabs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
    } catch (e) {
      console.warn('Failed to save tabs:', e);
      reportAppError('Sekmeler kaydedilemedi. Depolama alanını kontrol edip yeniden deneyin.', e);
    }
  }, [tabs, reportAppError]);

  // Save activeSpaceId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SPACE, activeSpaceId);
    } catch (e) {
      console.warn('Failed to save active space:', e);
      reportAppError('Çalışma alanı tercihi kaydedilemedi.', e);
    }
  }, [activeSpaceId, reportAppError]);

  // Save activeTabId to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTabId);
    } catch (e) {
      console.warn('Failed to save active tab:', e);
      reportAppError('Etkin sekme tercihi kaydedilemedi.', e);
    }
  }, [activeTabId, reportAppError]);

  // Save bookmarks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('Failed to save bookmarks:', e);
      reportAppError('Yer imleri kaydedilemedi. Depolama alanını kontrol edip yeniden deneyin.', e);
    }
  }, [bookmarks, reportAppError]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 5000)));
    } catch (error) {
      console.warn('Failed to save browsing history:', error);
      reportAppError('Gezinme geçmişi kaydedilemedi. Depolama alanını kontrol edin.', error);
    }
  }, [history, reportAppError]);

  // Save privacy settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRIVACY, JSON.stringify(privacySettings));
    } catch (e) {
      console.warn('Failed to save privacy settings:', e);
      reportAppError('Gizlilik tercihleri kaydedilemedi.', e);
    }
  }, [privacySettings, reportAppError]);

  // Ensure active tab belongs to active space on startup or if mismatched
  useEffect(() => {
    const currentActive = tabs.find(t => t.id === activeTabId);
    if (!currentActive || currentActive.spaceId !== activeSpaceId) {
      const selected = selectTabForSpace(tabs, activeSpaceId);
      if (selected) {
        setActiveTabId(selected.id);
      } else {
        // Create new tab for this space
        const newTabId = generateTabId();
        const newTab: Tab = {
          id: newTabId,
          spaceId: activeSpaceId,
          title: 'Google',
          url: 'https://www.google.com/',
          isPinned: false,
          isHibernated: false,
          lastAccessed: Date.now(),
          isLoading: false,
          canGoBack: false,
          canGoForward: false,
        };
        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTabId);
      }
    }
  }, [activeSpaceId, tabs, activeTabId]);

  // Periodically fetch real memory metrics from Electron
  useEffect(() => {
    const fetchMemory = async () => {
      if (window.znyAPI?.getMemoryMetrics) {
        try {
          const metrics = await window.znyAPI.getMemoryMetrics();
          if (metrics) {
            setMemoryMetrics((current) =>
              current?.totalMB === metrics.totalMB &&
              current.mainProcessMB === metrics.mainProcessMB &&
              current.processCount === metrics.processCount &&
              current.isUnavailable === metrics.isUnavailable
                ? current
                : metrics
            );
            if (metrics.isUnavailable && !memoryErrorReportedRef.current) {
              memoryErrorReportedRef.current = true;
              reportAppError('Bellek ölçümü şu anda kullanılamıyor.');
            } else if (!metrics.isUnavailable) {
              memoryErrorReportedRef.current = false;
            }
          }
        } catch (error) {
          setMemoryMetrics((current) =>
            current?.isUnavailable &&
            current.totalMB === 0 &&
            current.mainProcessMB === 0 &&
            current.processCount === 0
              ? current
              : { totalMB: 0, mainProcessMB: 0, processCount: 0, isUnavailable: true }
          );
          if (!memoryErrorReportedRef.current) {
            memoryErrorReportedRef.current = true;
            reportAppError('Bellek ölçümü alınamadı. Bir süre sonra yeniden denenecek.', error);
          }
        }
      } else if (!memoryErrorReportedRef.current) {
        memoryErrorReportedRef.current = true;
        reportAppError('Bellek ölçüm servisine ulaşılamıyor.');
      }
    };

    fetchMemory();
    const interval = setInterval(fetchMemory, 10000);
    return () => clearInterval(interval);
  }, [reportAppError]);

  // Refresh security stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      if (window.znyAPI?.getSecurityStats) {
        try {
          const stats = await window.znyAPI.getSecurityStats();
          if (stats) {
            setSecurityStats((current) =>
              current.adsBlocked === stats.adsBlocked &&
              current.trackersBlocked === stats.trackersBlocked &&
              current.blockedPopups === stats.blockedPopups &&
              current.httpsUpgraded === stats.httpsUpgraded &&
              current.isShieldActive === stats.isShieldActive &&
              current.filterListDomains === stats.filterListDomains &&
              current.filterListUpdatedAt === stats.filterListUpdatedAt &&
              current.filterListStatus === stats.filterListStatus &&
              current.filterListError === stats.filterListError &&
              JSON.stringify(current.allowedSites) === JSON.stringify(stats.allowedSites) &&
              JSON.stringify(current.recentBlocked) === JSON.stringify(stats.recentBlocked)
                ? current
                : stats
            );
            securityErrorReportedRef.current = false;
          }
        } catch (error) {
          if (!securityErrorReportedRef.current) {
            securityErrorReportedRef.current = true;
            reportAppError('Güvenlik sayaçları güncellenemedi. Bir süre sonra yeniden denenecek.', error);
          }
        }
      } else if (!securityErrorReportedRef.current) {
        securityErrorReportedRef.current = true;
        reportAppError('Güvenlik ölçüm servisine ulaşılamıyor.');
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [reportAppError]);

  // Safe window.open / popup handling routed to new tabs
  useEffect(() => {
    if (window.znyAPI?.onOpenNewTab) {
      const unsubscribe = window.znyAPI.onOpenNewTab((url: string, isPopup: boolean) => {
        handleNewTabRef.current(url, isPopup);
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  useEffect(() => {
    const IDLE_LIMIT = 3 * 60 * 1000;
    const interval = window.setInterval(() => {
      const now = Date.now();
      setTabs((currentTabs) =>
        hibernateIdleTabs(currentTabs, activeTabId, isSplitView, splitTabId, IDLE_LIMIT, now)
      );
    }, 15000);

    return () => window.clearInterval(interval);
  }, [activeTabId, isSplitView, splitTabId]);

  // Space Switcher: Automatically switches to the last active tab in the selected space
  const handleSelectSpace = (newSpaceId: string) => {
    if (newSpaceId === activeSpaceId) return;

    setActiveSpaceId(newSpaceId);

    const targetTab = selectTabForSpace(tabs, newSpaceId, undefined);
    if (targetTab) {
      setActiveTabId(targetTab.id);
      setTabs(prev =>
        prev.map(tab => {
          if (tab.id === targetTab.id) {
            return { ...tab, isHibernated: false, errorMessage: undefined, lastAccessed: Date.now() };
          }
          if (tab.id === activeTabId) {
            return { ...tab, lastAccessed: Date.now() };
          }
          return tab;
        })
      );
    } else {
      // Create a new default tab for this space
      const newTabId = generateTabId();
      const newTab: Tab = {
        id: newTabId,
        spaceId: newSpaceId,
        title: 'Google',
        url: 'https://www.google.com/',
        isPinned: false,
        isHibernated: false,
        lastAccessed: Date.now(),
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTabId);
    }

    // Reset split view if changing spaces to avoid cross-space clutter
    if (isSplitView) {
      setIsSplitView(false);
      setSplitTabId(null);
    }
  };


  // Tab Operations: Supports selecting tabs across different spaces seamlessly
  const handleSelectTab = (id: string) => {
    const targetTab = tabs.find(t => t.id === id);
    if (targetTab && targetTab.spaceId !== activeSpaceId) {
      setActiveSpaceId(targetTab.spaceId);
    }
    // If split view is active and user clicked the split tab, swap active and split tabs
    if (isSplitView && splitTabId === id) {
      setSplitTabId(activeTabId);
    }
    setActiveTabId(id);
    setTabs(prev =>
      prev.map(tab => {
        if (tab.id === id) {
          return { ...tab, isHibernated: false, errorMessage: undefined, lastAccessed: Date.now() };
        }
        if (tab.id === activeTabId) {
          return { ...tab, lastAccessed: Date.now() };
        }
        return tab;
      })
    );
  };


  const handleNewTab = useCallback((url = 'https://www.google.com/', isPopup = false) => {
    const newTabId = generateTabId();
    const newTab: Tab = {
      id: newTabId,
      spaceId: activeSpaceId,
      title: url.includes('google.com') ? 'Google' : 'Yeni Sekme',
      url: url,
      isPinned: false,
      isHibernated: false,
      lastAccessed: Date.now(),
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    if (isPopup) {
      setPopupTabIds(prev => new Set(prev).add(newTabId));
      const timeout = setTimeout(() => {
        setPopupTabIds(prev => {
          if (!prev.has(newTabId)) return prev;
          const next = new Set(prev);
          next.delete(newTabId);
          return next;
        });
        popupTabTimeoutsRef.current.delete(newTabId);
      }, 60000);
      popupTabTimeoutsRef.current.set(newTabId, timeout);
    }
  }, [activeSpaceId]);
  handleNewTabRef.current = handleNewTab;

  const handleCloseTab = (id: string) => {
    const closedTab = tabs.find(tab => tab.id === id);
    if (!closedTab) return;
    const popupTimeout = popupTabTimeoutsRef.current.get(id);
    if (popupTimeout) clearTimeout(popupTimeout);
    popupTabTimeoutsRef.current.delete(id);
    setPopupTabIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    closedTabsRef.current = [...closedTabsRef.current, closedTab].slice(-20);
    const remaining = tabs.filter(t => t.id !== id);
    const spaceRemaining = remaining.filter(t => t.spaceId === activeSpaceId);

    if (splitTabId === id) {
      setSplitTabId(null);
      setIsSplitView(false);
    }

    if (spaceRemaining.length === 0) {
      const defaultTab: Tab = {
        id: generateTabId(),
        spaceId: activeSpaceId,
        title: 'Google',
        url: 'https://www.google.com/',
        isPinned: false,
        isHibernated: false,
        lastAccessed: Date.now(),
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
      };
      setActiveTabId(defaultTab.id);
      setTabs([...remaining, defaultTab]);
      return;
    }

    if (activeTabId === id) {
      const nextActive = spaceRemaining[spaceRemaining.length - 1];
      setActiveTabId(nextActive.id);
      setTabs(
        remaining.map(t => (t.id === nextActive.id ? { ...t, isHibernated: false, lastAccessed: Date.now() } : t))
      );
    } else {
      setTabs(remaining);
    }
  };

  const handleTogglePinTab = (id: string) => {
    setTabs(prev =>
      prev.map(tab => (tab.id === id ? { ...tab, isPinned: !tab.isPinned } : tab))
    );
  };

  const handleUpdateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(prev =>
      prev.map(tab => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  }, []);

  const handleCloseSplitView = useCallback(() => {
    setIsSplitView(false);
    setSplitTabId(null);
  }, []);

  const handleToggleSplitView = () => {
    if (isSplitView) {
      setIsSplitView(false);
      setSplitTabId(null);
    } else {
      // Find another tab in the same space to split with
      const otherTab = tabs.find(t => t.id !== activeTabId && t.spaceId === activeSpaceId);
      if (otherTab) {
        setSplitTabId(otherTab.id);
        setIsSplitView(true);
      } else {
        // Create new tab for split view in current space
        const newTabId = generateTabId();
        const newTab: Tab = {
          id: newTabId,
          spaceId: activeSpaceId,
          title: 'Google',
          url: 'https://www.google.com/',
          isPinned: false,
          isHibernated: false,
          lastAccessed: Date.now(),
          isLoading: false,
          canGoBack: false,
          canGoForward: false,
        };
        setTabs(prev => [...prev, newTab]);
        setSplitTabId(newTabId);
        setIsSplitView(true);
      }
    }
  };

  // Google Chrome Bookmarks Import Handler: Saves to permanent Bookmarks collection!
  const handleImportSuccess = (importedBookmarks: Bookmark[]) => {
    setBookmarks(prev => deduplicateBookmarks(prev, importedBookmarks));
  };

  const handleImportHistorySuccess = (importedHistory: HistoryItem[]) => {
    setHistory(prev => {
      const seenVisits = new Set(prev.map(item => `${item.url}\u0000${item.visitTime}`));
      const merged = [...prev];
      for (const item of importedHistory) {
        const key = `${item.url}\u0000${item.visitTime}`;
        if (!seenVisits.has(key)) {
          seenVisits.add(key);
          merged.push(item);
        }
      }
      return merged.sort((a, b) => b.visitTime - a.visitTime).slice(0, 5000);
    });
  };

  const handleRecordVisit = useCallback((title: string, url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    const visitTime = Date.now();
    const searchTerm = (() => {
      try {
        const parsed = new URL(url);
        return parsed.searchParams.get('q') || parsed.searchParams.get('query') || undefined;
      } catch {
        return undefined;
      }
    })();

    setHistory(prev => {
      if (prev[0]?.url === url && visitTime - prev[0].visitTime < 2000) return prev;
      const visit: HistoryItem = {
        id: `visit-${visitTime}-${Math.random().toString(36).slice(2, 8)}`,
        title: title || url,
        url,
        visitTime,
        searchTerm,
      };
      return [visit, ...prev].slice(0, 5000);
    });
  }, []);


  // Bookmark Click Handler: opens in active space
  const handleSelectBookmark = (url: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && (activeTab.url === 'https://www.google.com/' || activeTab.url === 'https://www.google.com' || activeTab.url === 'about:blank')) {
      handleUpdateTab(activeTab.id, { url, title: 'Yükleniyor...', isHibernated: false });
    } else {
      handleNewTab(url);
    }
  };

  // Delete bookmark
  const handleDeleteBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  useEffect(() => {
    if (!window.znyAPI?.onBrowserShortcut) return;
    return window.znyAPI.onBrowserShortcut((shortcut) => {
      switch (shortcut) {
        case 'command-palette':
          setIsCommandPaletteOpen(true);
          break;
        case 'new-tab':
          handleNewTab();
          break;
        case 'close-tab':
          handleCloseTab(activeTabId);
          break;
        case 'reopen-closed-tab': {
          const tab = closedTabsRef.current.pop();
          if (tab) {
            const restoredTab = { ...tab, isHibernated: false, isLoading: false, lastAccessed: Date.now() };
            setTabs(currentTabs => [...currentTabs, restoredTab]);
            setActiveSpaceId(restoredTab.spaceId);
            setActiveTabId(restoredTab.id);
          }
          break;
        }
        case 'history':
          setIsHistoryOpen(true);
          break;
        case 'focus-address':
          window.dispatchEvent(new CustomEvent('zny-focus-address'));
          break;
        case 'reload':
          window.dispatchEvent(new CustomEvent('zny-reload-active-tab'));
          break;
        case 'find-in-page':
          window.dispatchEvent(new CustomEvent('zny-open-find'));
          break;
        case 'downloads':
          setIsDownloadsOpen(true);
          break;
      }
    });
  }, [activeTabId, handleNewTab, tabs, activeSpaceId]);

  const handleToggleShield = async () => {
    if (!window.znyAPI?.setShieldActive) {
      reportAppError('Güvenlik kalkanı denetimine ulaşılamıyor.');
      return;
    }
    try {
      const updated = await window.znyAPI.setShieldActive(!securityStats.isShieldActive);
      setSecurityStats(updated);
    } catch (error) {
      reportAppError('Güvenlik kalkanı durumu değiştirilemedi.', error);
    }
  };

  const handleSiteProtectionChange = async (site: string, allowed: boolean) => {
    try {
      if (!window.znyAPI?.setSiteProtection) throw new Error('Site protection bridge is unavailable');
      setSecurityStats(await window.znyAPI.setSiteProtection(site, allowed));
    } catch (error) {
      reportAppError('Bu site için koruma tercihi kaydedilemedi.', error);
    }
  };

  const handleRefreshAdBlockerFilters = async () => {
    try {
      if (!window.znyAPI?.refreshAdBlockerFilters) throw new Error('Filter update bridge is unavailable');
      setSecurityStats(await window.znyAPI.refreshAdBlockerFilters());
    } catch (error) {
      reportAppError('Reklam ve izleyici listesi güncellenemedi.', error);
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      if (!window.znyAPI?.downloadUpdate) throw new Error('Update bridge is unavailable');
      await window.znyAPI.downloadUpdate();
    } catch (error) {
      console.error('Could not request update download:', error);
      setUpdateStatus((status) => ({
        ...status,
        state: 'error',
        message: 'Güncelleme indirilemedi. Bağlantınızı kontrol edip yeniden deneyin.',
      }));
    }
  };

  const handleInstallUpdate = async () => {
    try {
      if (!window.znyAPI?.installUpdate) throw new Error('Update bridge is unavailable');
      await window.znyAPI.installUpdate();
    } catch (error) {
      reportAppError('Güncelleme kurulumu başlatılamadı.', error);
    }
  };

  // Privacy preference toggles
  const handleToggleSearchSuggestions = () => {
    setPrivacySettings(prev => ({
      ...prev,
      searchSuggestionsEnabled: !prev.searchSuggestionsEnabled,
    }));
  };

  const handleToggleSelectionTranslation = () => {
    setPrivacySettings(prev => ({
      ...prev,
      selectionTranslationEnabled: !prev.selectionTranslationEnabled,
    }));
  };

  const activeTab = tabs.find(t => t.id === activeTabId);
  const splitTab = splitTabId ? tabs.find(t => t.id === splitTabId) : undefined;
  const hibernatedTabsCount = tabs.filter(t => t.isHibernated).length;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0e13] text-gray-100 overflow-hidden font-sans">
      {/* 1. Custom Frameless Titlebar */}
      <Titlebar
        onOpenSecurity={() => setIsSecurityOpen(true)}
        onOpenGoogleHub={() => setIsGoogleHubOpen(true)}
        onError={reportAppError}
        securityStats={securityStats}
        totalTabs={tabs.length}
        hibernatedTabs={hibernatedTabsCount}
        memoryMetrics={memoryMetrics}
      />
      {appError && (
        <div
          role="alert"
          className="fixed right-4 top-[52px] z-[100] flex max-w-md items-start gap-3 rounded-lg border border-amber-300/20 bg-[#191c22] px-4 py-3 text-sm text-amber-100 shadow-[0_12px_36px_rgba(0,0,0,0.35)]"
        >
          <span className="flex-1">{appError}</span>
          <button
            type="button"
            onClick={() => setAppError(null)}
            className="rounded px-1 text-amber-200 hover:bg-white/10"
            aria-label="Bildirimi kapat"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Main Body: Sidebar + Multi-View WebViews Container */}
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          onSelectSpace={handleSelectSpace}
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onTogglePinTab={handleTogglePinTab}
          onNewTab={handleNewTab}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          isSplitView={isSplitView}
          onToggleSplitView={handleToggleSplitView}
          onOpenChromeImporter={() => setIsChromeImportOpen(true)}
          onOpenGoogleHub={() => setIsGoogleHubOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          bookmarks={bookmarks}
          onSelectBookmark={handleSelectBookmark}
          onDeleteBookmark={handleDeleteBookmark}
        />

        <DownloadsModal
          isOpen={isDownloadsOpen}
          downloads={downloads}
          onClose={() => setIsDownloadsOpen(false)}
          onAction={handleDownloadAction}
          onOpenFile={handleOpenDownloadedFile}
          onShowInFolder={handleShowDownloadInFolder}
        />

        {/* Multi-View WebViews Container */}
        <WebViewContainer
          tabs={tabs}
          activeTab={activeTab}
          splitTab={splitTab}
          isSplitView={isSplitView}
          selectionTranslationEnabled={privacySettings.selectionTranslationEnabled}
          onUpdateTab={handleUpdateTab}
          onCloseSplitView={handleCloseSplitView}
          onTextSelected={setContextualTranslation}
          onNewTab={handleNewTab}
          popupTabIds={popupTabIds}
          onCloseTab={handleCloseTab}
          onVisit={handleRecordVisit}
          onOpenDownloads={() => setIsDownloadsOpen(true)}
        />
      </div>

      {/* 3. Floating Contextual Translate Tooltip */}
      {privacySettings.selectionTranslationEnabled && (
        <TranslateTooltip
          data={contextualTranslation}
          onClose={() => setContextualTranslation(null)}
        />
      )}

      {/* 4. Modals */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(url) => {
          if (activeTab) {
            handleUpdateTab(activeTab.id, { url, isHibernated: false });
          } else {
            handleNewTab(url);
          }
        }}
        onNewTab={handleNewTab}
        tabs={tabs}
        onSelectTab={handleSelectTab}
        spaces={spaces}
        onSelectSpace={handleSelectSpace}
        searchSuggestionsEnabled={privacySettings.searchSuggestionsEnabled}
        onToggleSearchSuggestions={handleToggleSearchSuggestions}
      />

      <GoogleHubModal
        isOpen={isGoogleHubOpen}
        onClose={() => setIsGoogleHubOpen(false)}
        onOpenUrl={(url) => handleNewTab(url)}
      />

      <ChromeImportModal
        isOpen={isChromeImportOpen}
        onClose={() => setIsChromeImportOpen(false)}
        onImportSuccess={handleImportSuccess}
        onImportHistorySuccess={handleImportHistorySuccess}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        history={history}
        onClose={() => setIsHistoryOpen(false)}
        onSelect={(url) => {
          setIsHistoryOpen(false);
          const active = tabs.find(tab => tab.id === activeTabId);
          if (active) handleUpdateTab(active.id, { url, isHibernated: false, errorMessage: undefined });
          else handleNewTab(url);
        }}
        onDelete={(id) => setHistory(prev => prev.filter(item => item.id !== id))}
        onClear={() => setHistory([])}
      />

      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        stats={securityStats}
        onToggleShield={handleToggleShield}
        activeUrl={activeTab?.url}
        onSetSiteProtection={handleSiteProtectionChange}
        onRefreshFilters={handleRefreshAdBlockerFilters}
        searchSuggestionsEnabled={privacySettings.searchSuggestionsEnabled}
        onToggleSearchSuggestions={handleToggleSearchSuggestions}
        selectionTranslationEnabled={privacySettings.selectionTranslationEnabled}
        onToggleSelectionTranslation={handleToggleSelectionTranslation}
        memoryMetrics={memoryMetrics}
        totalTabs={tabs.length}
        hibernatedTabs={hibernatedTabsCount}
        updateStatus={updateStatus}
        onCheckForUpdates={handleCheckForUpdates}
        onDownloadUpdate={handleDownloadUpdate}
        onInstallUpdate={handleInstallUpdate}
      />
    </div>
  );
};
