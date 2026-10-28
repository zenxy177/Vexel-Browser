import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { 
  ArrowLeft, ArrowRight, RotateCw, Lock, Unlock,
  Languages, Moon, X, Globe, AlertTriangle, Search, Download
} from 'lucide-react';
import { Tab, ContextualTranslation } from '../types';
import { getNavigationErrorMessage, isNavigationAborted, normalizeUrlOrSearch } from '../utils/browser-logic';

const getFailureDetails = (error: unknown): { code?: string; errno?: number; message?: string } => {
  if (typeof error !== 'object' || error === null) return {};
  const details = error as Record<string, unknown>;
  return {
    code: typeof details.code === 'string' ? details.code : undefined,
    errno: typeof details.errno === 'number' ? details.errno : undefined,
    message: error instanceof Error
      ? error.message
      : typeof details.message === 'string' ? details.message : undefined,
  };
};

interface WebviewTabItemProps {
  tab: Tab;
  isActive: boolean;
  preloadPath: string;
  selectionTranslationEnabled?: boolean;
  onUpdateTab: (tabId: string, updates: Partial<Tab>) => void;
  onTextSelected: (data: ContextualTranslation | null) => void;
  onVisit: (title: string, url: string) => void;
  refCallback: (tabId: string, el: any) => void;
}

const WebviewTabItem = memo(function WebviewTabItem({
  tab,
  isActive,
  preloadPath,
  selectionTranslationEnabled = true,
  onUpdateTab,
  onTextSelected,
  onVisit,
  refCallback,
}: WebviewTabItemProps) {
  const webviewRef = useRef<any>(null);
  const initialUrlRef = useRef<string>(tab.url);
  const loadedUrlRef = useRef<string>(tab.url);
  const titleRef = useRef(tab.title);
  const prevHibernatedRef = useRef<boolean>(tab.isHibernated);
  titleRef.current = tab.title;

  const reportLoadError = (errorCode?: number, errorDescription?: string) => {
    if (isNavigationAborted(errorCode, errorDescription)) return;
    console.warn('Webview failed to load:', errorCode, errorDescription);
    onUpdateTab(tab.id, {
      isLoading: false,
      errorMessage: getNavigationErrorMessage(errorCode, errorDescription),
    });
  };

  // When tab is hibernated or transitioning from hibernated -> active,
  // ensure initialUrlRef and loadedUrlRef are immediately synced to tab.url
  // before the <webview> is mounted in the DOM. This ensures the newly mounted
  // webview receives the correct URL on mount without triggering redundant loadURL calls.
  if (tab.isHibernated || (prevHibernatedRef.current && !tab.isHibernated)) {
    initialUrlRef.current = tab.url;
    loadedUrlRef.current = tab.url;
  }
  prevHibernatedRef.current = tab.isHibernated;

  // Sync external URL changes (e.g. address bar navigation)
  useEffect(() => {
    if (tab.isHibernated) return;
    if (tab.url && tab.url !== loadedUrlRef.current) {
      loadedUrlRef.current = tab.url;
      const webview = webviewRef.current;
      if (webview) {
        try {
          const p = webview.loadURL(tab.url);
          if (p && typeof p.catch === 'function') {
            p.catch((err: unknown) => {
              const failure = getFailureDetails(err);
              if (failure.code !== 'ERR_ABORTED') {
                reportLoadError(failure.errno, failure.message || failure.code);
              }
            });
          }
        } catch (err: unknown) {
          const failure = getFailureDetails(err);
          if (failure.code !== 'ERR_ABORTED') {
            reportLoadError(failure.errno, failure.message || failure.code);
          }
        }
      }
    }
  }, [tab.url, tab.isHibernated]);

  // Attach event listeners to this tab's webview
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview || tab.isHibernated) return;

    const handleTitle = (e: any) => {
      onUpdateTab(tab.id, { title: e.title });
    };

    const handleFavicon = (e: any) => {
      if (e.favicons && e.favicons.length > 0) {
        onUpdateTab(tab.id, { favicon: e.favicons[0] });
      }
    };

    const handleStartLoading = () => {
      onUpdateTab(tab.id, { isLoading: true, errorMessage: undefined });
    };

    const handleStopLoading = () => {
      onUpdateTab(tab.id, { 
        isLoading: false,
        canGoBack: webview.canGoBack ? webview.canGoBack() : false,
        canGoForward: webview.canGoForward ? webview.canGoForward() : false,
      });
    };

    const handleNavigate = (e: any, isMainNavigation: boolean) => {
      if (!e.url) return;
      const urlChanged = e.url !== loadedUrlRef.current;
      if (isMainNavigation) onVisit(titleRef.current, e.url);
      if (!urlChanged) return;

      loadedUrlRef.current = e.url;
      onUpdateTab(tab.id, { 
        url: e.url,
        errorMessage: undefined,
        canGoBack: webview.canGoBack ? webview.canGoBack() : false,
        canGoForward: webview.canGoForward ? webview.canGoForward() : false,
      });
    };
    const handleMainNavigate = (e: any) => handleNavigate(e, true);
    const handleInPageNavigate = (e: any) => handleNavigate(e, false);

    const handleFailLoad = (e: any) => {
      if (e.isMainFrame === false) return;
      reportLoadError(e.errorCode, e.errorDescription);
    };

    const handleIpcMessage = async (e: any) => {
      if (!selectionTranslationEnabled) return;
      if (e.channel === 'text-selected') {
        const { text, clientX, clientY } = e.args[0];
        if (text && window.znyAPI?.translateText) {
          try {
            const res = await window.znyAPI.translateText(text, 'tr');
            if (res && res.success && res.translatedText) {
              onTextSelected({
                text: res.originalText,
                translation: res.translatedText,
                sourceLang: res.sourceLang || 'auto',
                targetLang: res.targetLang || 'tr',
                x: clientX,
                y: clientY,
                isError: false,
              });
            } else {
              onTextSelected({
                text: text,
                translation: '',
                sourceLang: 'auto',
                targetLang: 'tr',
                x: clientX,
                y: clientY,
                isError: true,
                errorMessage: res?.error || 'Çeviri servisi yanıt vermedi.',
              });
            }
          } catch (err: any) {
            onTextSelected({
              text: text,
              translation: '',
              sourceLang: 'auto',
              targetLang: 'tr',
              x: clientX,
              y: clientY,
              isError: true,
              errorMessage: err?.message || 'Çeviri isteği başarısız oldu.',
            });
          }
        }
      } else if (e.channel === 'text-selection-cleared') {
        onTextSelected(null);
      }
    };
    const handleFoundInPage = (e: any) => {
      window.dispatchEvent(new CustomEvent('zny-found-in-page', {
        detail: { tabId: tab.id, activeMatchOrdinal: e.result?.activeMatchOrdinal ?? 0, matches: e.result?.matches ?? 0 },
      }));
    };

    webview.addEventListener('page-title-updated', handleTitle);
    webview.addEventListener('page-favicon-updated', handleFavicon);
    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-navigate', handleMainNavigate);
    webview.addEventListener('did-navigate-in-page', handleInPageNavigate);
    webview.addEventListener('did-fail-load', handleFailLoad);
    webview.addEventListener('did-fail-provisional-load', handleFailLoad);
    webview.addEventListener('ipc-message', handleIpcMessage);
    webview.addEventListener('found-in-page', handleFoundInPage);

    return () => {
      webview.removeEventListener('page-title-updated', handleTitle);
      webview.removeEventListener('page-favicon-updated', handleFavicon);
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-navigate', handleMainNavigate);
      webview.removeEventListener('did-navigate-in-page', handleInPageNavigate);
      webview.removeEventListener('did-fail-load', handleFailLoad);
      webview.removeEventListener('did-fail-provisional-load', handleFailLoad);
      webview.removeEventListener('ipc-message', handleIpcMessage);
      webview.removeEventListener('found-in-page', handleFoundInPage);
    };
  }, [tab.id, tab.isHibernated, selectionTranslationEnabled, onVisit]);

  if (tab.isHibernated) {
    if (!isActive) return null;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0e13] text-gray-400 gap-3 select-none p-6">
        <div className="p-4 rounded-2xl bg-[#1a2230] border border-white/[0.06]">
          <Moon className="w-8 h-8 text-[#afc8f1]" />
        </div>
        <div className="text-center px-4">
          <div className="text-sm font-semibold text-gray-200">Sekme Askıya Alındı</div>
          <div className="text-xs text-gray-400 mt-1 max-w-sm truncate">
            {tab.title}
          </div>
          <div className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
            Sabitlenmemiş sekme 3 dakikadan uzun süre kullanılmadığı için askıya alındı.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onUpdateTab(tab.id, { isHibernated: false, errorMessage: undefined, lastAccessed: Date.now() })}
          className="px-5 py-2.5 rounded-lg bg-[#dce8ff] hover:bg-white text-[#17243a] text-xs font-semibold shadow-sm transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
        >
          Sekmeyi Uyandır
        </button>
      </div>
    );
  }

  if (tab.errorMessage) {
    if (!isActive) return null;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0b0e13] text-gray-400 gap-3 select-none p-6">
        <div className="p-4 rounded-2xl bg-[#27221a] border border-amber-200/10">
          <AlertTriangle className="w-8 h-8 text-amber-200/80" />
        </div>
        <div className="text-center px-4">
          <div className="text-sm font-semibold text-gray-200">Sayfa Yüklenemedi</div>
          <div className="text-[13px] text-amber-100/80 mt-1 max-w-md break-words">
            {tab.errorMessage}
          </div>
          <div className="text-xs text-gray-500 mt-1 max-w-sm truncate">
            {tab.url}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onUpdateTab(tab.id, { errorMessage: undefined, isLoading: true });
            const webview = webviewRef.current;
            try {
              if (webview?.reload) {
                webview.reload();
              } else if (webview?.loadURL) {
                webview.loadURL(tab.url).catch((error: unknown) => {
                  const failure = getFailureDetails(error);
                  reportLoadError(failure.errno, failure.message || failure.code);
                });
              }
            } catch (error) {
              const failure = getFailureDetails(error);
              reportLoadError(failure.errno, failure.message || failure.code);
            }
          }}
          className="px-5 py-2.5 rounded-lg bg-[#dce8ff] hover:bg-white text-[#17243a] text-xs font-semibold shadow-sm transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
        >
          Yeniden Dene
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full"
      style={{ display: isActive ? 'block' : 'none' }}
    >
      {React.createElement('webview', {
        ref: (el: any) => {
          webviewRef.current = el;
          refCallback(tab.id, el);
        },
        src: initialUrlRef.current,
        preload: preloadPath || undefined,
        className: 'w-full h-full',
        allowpopups: 'true',
      })}
    </div>
  );
});


interface WebViewContainerProps {
  tabs: Tab[];
  activeTab: Tab | undefined;
  splitTab?: Tab | undefined;
  isSplitView: boolean;
  selectionTranslationEnabled?: boolean;
  onUpdateTab: (tabId: string, updates: Partial<Tab>) => void;
  onCloseSplitView: () => void;
  onTextSelected: (data: ContextualTranslation | null) => void;
  onNewTab: (url?: string) => void;
  popupTabIds: Set<string>;
  onCloseTab: (tabId: string) => void;
  onVisit: (title: string, url: string) => void;
  onOpenDownloads: () => void;
}

export const WebViewContainer = memo(function WebViewContainer({
  tabs,
  activeTab,
  splitTab,
  isSplitView,
  selectionTranslationEnabled = true,
  onUpdateTab,
  onCloseSplitView,
  onTextSelected,
  onNewTab,
  popupTabIds,
  onCloseTab,
  onVisit,
  onOpenDownloads,
}: WebViewContainerProps) {
  const webviewMapRef = useRef<{ [tabId: string]: any }>({});
  const popupTabIdsRef = useRef(popupTabIds);
  const onCloseTabRef = useRef(onCloseTab);
  const pendingBlockedPopupIdsRef = useRef<Map<number, number>>(new Map());
  const blockedPopupRetryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  popupTabIdsRef.current = popupTabIds;
  onCloseTabRef.current = onCloseTab;

  const reconcileBlockedPopup = () => {
    const now = Date.now();
    for (const [webContentsId, expiresAt] of pendingBlockedPopupIdsRef.current) {
      if (expiresAt <= now) {
        pendingBlockedPopupIdsRef.current.delete(webContentsId);
        continue;
      }

      for (const [tabId, webview] of Object.entries(webviewMapRef.current)) {
        if (!popupTabIdsRef.current.has(tabId) || typeof webview?.getWebContentsId !== 'function') continue;
        try {
          if (webview.getWebContentsId() === webContentsId) {
            pendingBlockedPopupIdsRef.current.delete(webContentsId);
            onCloseTabRef.current(tabId);
            break;
          }
        } catch (error) {
          console.warn('Could not identify blocked popup tab:', error);
        }
      }
    }

    if (pendingBlockedPopupIdsRef.current.size === 0 && blockedPopupRetryTimerRef.current) {
      clearInterval(blockedPopupRetryTimerRef.current);
      blockedPopupRetryTimerRef.current = null;
    }
  };
  const reconcileBlockedPopupRef = useRef(reconcileBlockedPopup);
  reconcileBlockedPopupRef.current = reconcileBlockedPopup;

  useEffect(() => {
    if (!window.znyAPI?.onBlockedMainFrameNavigation) return;
    return window.znyAPI.onBlockedMainFrameNavigation((webContentsId) => {
      if (!Number.isInteger(webContentsId)) return;
      pendingBlockedPopupIdsRef.current.set(webContentsId, Date.now() + 60000);
      reconcileBlockedPopupRef.current();
      if (!blockedPopupRetryTimerRef.current) {
        blockedPopupRetryTimerRef.current = setInterval(() => {
          reconcileBlockedPopupRef.current();
        }, 100);
      }
    });
  }, []);

  const [preloadPath, setPreloadPath] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.znyAPI?.getWebviewPreloadPathSync) {
      try {
        return window.znyAPI.getWebviewPreloadPathSync();
      } catch (err) {
        console.warn('Failed to get preload path synchronously:', err);
        return '';
      }
    }
    return '';
  });

  const [urlInput, setUrlInput] = useState<string>('');
  const [isEditingUrl, setIsEditingUrl] = useState<boolean>(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState(0);
  const [activeFindMatch, setActiveFindMatch] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingUrl) {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    }
  }, [isEditingUrl]);

  // Asynchronous preload path fallback
  useEffect(() => {
    if (!preloadPath && window.znyAPI?.getWebviewPreloadPath) {
      window.znyAPI.getWebviewPreloadPath().then((path) => {
        if (path) {
          setPreloadPath(path);
        } else {
          console.error('Webview preload path was not provided by the main process.');
        }
      }).catch((error: unknown) => {
        console.error('Could not load webview preload path:', error);
      });
    }
  }, [preloadPath]);

  // Sync address bar text when active tab changes
  useEffect(() => {
    if (activeTab && !isEditingUrl) {
      setUrlInput(activeTab.url);
    }
  }, [activeTab?.id, activeTab?.url, isEditingUrl]);

  const handleRefCallback = useCallback((tabId: string, el: any) => {
    if (el) {
      webviewMapRef.current[tabId] = el;
      reconcileBlockedPopupRef.current();
    } else {
      delete webviewMapRef.current[tabId];
    }
  }, []);

  useEffect(() => () => {
    if (blockedPopupRetryTimerRef.current) {
      clearInterval(blockedPopupRetryTimerRef.current);
      blockedPopupRetryTimerRef.current = null;
    }
    pendingBlockedPopupIdsRef.current.clear();
  }, []);

  const getActiveWebview = () => {
    if (!activeTab) return null;
    return webviewMapRef.current[activeTab.id] || null;
  };

  const handleGoBack = () => {
    const webview = getActiveWebview();
    if (webview?.canGoBack?.()) {
      webview.goBack();
    }
  };

  const handleGoForward = () => {
    const webview = getActiveWebview();
    if (webview?.canGoForward?.()) {
      webview.goForward();
    }
  };

  const handleReload = () => {
    const webview = getActiveWebview();
    if (webview?.reload) {
      webview.reload();
    }
  };

  const closeFind = useCallback(() => {
    const webview = getActiveWebview();
    webview?.stopFindInPage?.('clearSelection');
    setIsFindOpen(false);
    setFindQuery('');
    setFindMatches(0);
    setActiveFindMatch(0);
  }, [activeTab?.id]);

  const openFind = useCallback(() => {
    setIsFindOpen(true);
    window.setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 0);
  }, []);

  const moveFindMatch = (forward: boolean) => {
    const webview = getActiveWebview();
    if (findQuery.trim()) webview?.findInPage?.(findQuery, { forward, findNext: true });
  };

  useEffect(() => {
    const focusAddress = () => setIsEditingUrl(true);
    const reloadActiveTab = () => handleReload();
    const openFindInPage = () => openFind();
    const handleFindResult = (event: Event) => {
      const { tabId, activeMatchOrdinal, matches } = (event as CustomEvent<{
        tabId: string;
        activeMatchOrdinal: number;
        matches: number;
      }>).detail;
      if (tabId !== activeTab?.id) return;
      setFindMatches(matches);
      setActiveFindMatch(activeMatchOrdinal);
    };
    window.addEventListener('zny-focus-address', focusAddress);
    window.addEventListener('zny-reload-active-tab', reloadActiveTab);
    window.addEventListener('zny-open-find', openFindInPage);
    window.addEventListener('zny-found-in-page', handleFindResult);
    return () => {
      window.removeEventListener('zny-focus-address', focusAddress);
      window.removeEventListener('zny-reload-active-tab', reloadActiveTab);
      window.removeEventListener('zny-open-find', openFindInPage);
      window.removeEventListener('zny-found-in-page', handleFindResult);
    };
  }, [activeTab?.id, openFind]);

  useEffect(() => {
    if (!isFindOpen) return;
    const webview = getActiveWebview();
    if (!findQuery.trim()) {
      webview?.stopFindInPage?.('clearSelection');
      setFindMatches(0);
      setActiveFindMatch(0);
      return;
    }
    const timeout = window.setTimeout(() => {
      webview?.findInPage?.(findQuery, { matchCase: false });
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [activeTab?.id, findQuery, isFindOpen]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingUrl(false);
    if (!urlInput.trim() || !activeTab) return;

    const dest = normalizeUrlOrSearch(urlInput);

    if (activeTab.isHibernated || activeTab.url !== dest || activeTab.errorMessage) {
      onUpdateTab(activeTab.id, { url: dest, isHibernated: false, errorMessage: undefined, lastAccessed: Date.now() });
    } else {
      const webview = getActiveWebview();
      if (webview?.loadURL) {
        try {
          webview.loadURL(dest).catch((error: unknown) => {
            const failure = getFailureDetails(error);
            if (failure.code !== 'ERR_ABORTED' && !isNavigationAborted(failure.errno, failure.message)) {
              onUpdateTab(activeTab.id, {
                isLoading: false,
                errorMessage: getNavigationErrorMessage(failure.errno, failure.message || failure.code),
              });
            }
          });
        } catch (error) {
          const failure = getFailureDetails(error);
          onUpdateTab(activeTab.id, {
            isLoading: false,
            errorMessage: getNavigationErrorMessage(failure.errno, failure.message || failure.code),
          });
        }
      }
    }
  };

  const handleTranslatePage = () => {
    const webview = getActiveWebview();
    if (webview) {
      webview.send('translate-page-to-tr');
    }
  };

  // Determine security status for active tab URL
  const renderSecurityIcon = () => {
    if (!activeTab) return null;
    if (activeTab.errorMessage) {
      return (
        <span 
          className="text-amber-400 flex items-center flex-shrink-0" 
          title={`Bağlantı Hatası: ${activeTab.errorMessage}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        </span>
      );
    }
    const url = activeTab.url || '';
    if (url.startsWith('https://')) {
      return (
        <span 
          className="text-emerald-400 flex items-center flex-shrink-0" 
          title="HTTPS (Şifreli Bağlantı)"
        >
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
        </span>
      );
    }
    if (url.startsWith('http://')) {
      return (
        <span 
          className="text-amber-400 flex items-center flex-shrink-0" 
          title="HTTP (Şifrelenmemiş Bağlantı)"
        >
          <Unlock className="w-3.5 h-3.5 flex-shrink-0" />
        </span>
      );
    }
    return (
      <span className="text-gray-400 flex items-center flex-shrink-0" title="Dahili veya Yerel Adres">
        <Globe className="w-3.5 h-3.5 flex-shrink-0" />
      </span>
    );
  };


  if (!activeTab) {
    return (
      <div className="flex-1 bg-[#0F1117] flex flex-col items-center justify-center text-gray-400 select-none">
        <Moon className="w-12 h-12 mb-3 text-gray-600" />
        <span className="text-sm font-medium">Açık sekme bulunmuyor. Başlamak için yeni sekme açın.</span>
        <button
          type="button"
          onClick={() => onNewTab()}
          className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
        >
          Yeni Sekme Aç
        </button>
      </div>
    );
  }

  // Filter tabs for main pane (tabs that are not the dedicated splitTab)
  const mainPaneTabs = isSplitView && splitTab 
    ? tabs.filter(t => t.id !== splitTab.id)
    : tabs;

  return (
    <div className="flex-1 flex flex-col bg-[#0b0e13] overflow-hidden relative">
      {/* Top Navigation Bar / Arc Pill Bar */}
      <div className="h-[54px] bg-[#0e1218] border-b border-white/[0.055] flex items-center justify-between px-4 gap-3 select-none min-w-0 relative">
        {/* Navigation Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenDownloads}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-200 flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="İndirilenler (Ctrl+J)"
            aria-label="İndirilenler"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleGoBack}
            disabled={!activeTab.canGoBack}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 disabled:hover:bg-transparent text-gray-500 hover:text-gray-200 flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="Geri"
            aria-label="Geri"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleGoForward}
            disabled={!activeTab.canGoForward}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] disabled:opacity-25 disabled:hover:bg-transparent text-gray-500 hover:text-gray-200 flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="İleri"
            aria-label="İleri"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleReload}
            className={`w-8 h-8 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-200 flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300 ${
              activeTab.isLoading ? 'animate-spin text-blue-200' : ''
            }`}
            title={activeTab.isLoading ? 'Yükleniyor...' : 'Yenile'}
            aria-label="Yenile"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Address Field: Calm surface, thin border, occupies majority of row */}
        <div className="flex-1 min-w-0 mx-1">
          {isEditingUrl ? (
            <form onSubmit={handleUrlSubmit} className="w-full h-10 flex items-center gap-2.5 px-3.5 rounded-xl bg-[#171c24] border border-[#91b4ec]/50 shadow-[0_0_0_3px_rgba(134,170,230,0.06)]">
              <span className="text-[#afc8f1] flex items-center flex-shrink-0">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              </span>
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsEditingUrl(false);
                    setUrlInput(activeTab.url);
                  }
                }}
                onBlur={() => setIsEditingUrl(false)}
                className="w-full text-[13px] bg-transparent text-white focus:outline-none select-text"
                placeholder="Google'da ara veya URL yaz..."
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingUrl(true)}
              className="w-full h-10 flex items-center gap-2.5 px-3.5 rounded-xl bg-[#171c24] hover:bg-[#1a202a] border border-white/[0.055] hover:border-white/[0.09] cursor-text transition text-[13px] text-gray-300 text-left min-w-0 focus-visible:ring-1 focus-visible:ring-blue-300"
            >
              {renderSecurityIcon()}
              <span className="truncate font-normal text-gray-200 select-text flex-1 min-w-0">{activeTab.url}</span>
              {activeTab.isLoading && (
                <span className="text-[10px] text-blue-400 font-medium px-1.5 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
                  Yükleniyor
                </span>
              )}
            </button>
          )}
        </div>

        {/* Action Controls: Compact translate & split view buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleTranslatePage}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-[#b5cafa] flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="Sayfayı Türkçeye Çevir (Google Translate)"
            aria-label="Sayfayı Çevir"
          >
            <Languages className="w-3.5 h-3.5" />
          </button>

          {isSplitView && (
            <button
              type="button"
              onClick={onCloseSplitView}
              className="w-8 h-8 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-white flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
              title="Bölünmüş Ekranı Kapat"
              aria-label="Bölünmüş Ekranı Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Subtle Loading Progress Bar at bottom of nav bar */}
        {activeTab.isLoading && (
          <div className="absolute bottom-0 left-0 right-0 h-px bg-blue-200/15 overflow-hidden pointer-events-none">
            <div className="h-full bg-[#a9c5f3] w-1/3 animate-pulse rounded-r" />
          </div>
        )}
      </div>

      {isFindOpen && (
        <div className="absolute right-4 top-[62px] z-40 flex w-[min(420px,calc(100%-2rem))] items-center gap-2 rounded-xl border border-white/10 bg-[#141a23] p-2 shadow-2xl">
          <Search className="ml-1 h-4 w-4 shrink-0 text-gray-500" />
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={event => setFindQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeFind();
              } else if (event.key === 'Enter') {
                event.preventDefault();
                moveFindMatch(!event.shiftKey);
              }
            }}
            placeholder="Sayfada bul"
            aria-label="Sayfada bul"
            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-gray-100 outline-none placeholder:text-gray-500"
          />
          <span className="min-w-[42px] text-center text-[11px] tabular-nums text-gray-500" aria-live="polite">
            {findQuery ? `${activeFindMatch}/${findMatches}` : '—'}
          </span>
          <button type="button" onClick={() => moveFindMatch(false)} disabled={!findMatches} className="rounded-md px-2 py-1 text-gray-400 hover:bg-white/5 disabled:opacity-30" aria-label="Önceki eşleşme">↑</button>
          <button type="button" onClick={() => moveFindMatch(true)} disabled={!findMatches} className="rounded-md px-2 py-1 text-gray-400 hover:bg-white/5 disabled:opacity-30" aria-label="Sonraki eşleşme">↓</button>
          <button type="button" onClick={closeFind} className="rounded-md p-1.5 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Sayfada bul penceresini kapat">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Multi-View Pool Area (Single or Split View) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Pane: Contains all open tabs in multi-view pool */}
        <div className={`h-full relative overflow-hidden ${isSplitView && splitTab ? 'w-1/2 border-r border-white/10' : 'w-full'}`}>
          {mainPaneTabs.map(tab => (
            <WebviewTabItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTab.id}
              preloadPath={preloadPath}
              selectionTranslationEnabled={selectionTranslationEnabled}
              onUpdateTab={onUpdateTab}
              onTextSelected={onTextSelected}
              onVisit={onVisit}
              refCallback={handleRefCallback}
            />
          ))}
        </div>

        {/* Split Tab Pane (When Split View is active) */}
        {isSplitView && splitTab && (
          <div className="w-1/2 h-full relative overflow-hidden">
            <WebviewTabItem
              key={splitTab.id}
              tab={splitTab}
              isActive={true}
              preloadPath={preloadPath}
              selectionTranslationEnabled={selectionTranslationEnabled}
              onUpdateTab={onUpdateTab}
              onTextSelected={onTextSelected}
              onVisit={onVisit}
              refCallback={handleRefCallback}
            />
          </div>
        )}
      </div>
    </div>
  );
});
