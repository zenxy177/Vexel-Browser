import { Tab, Bookmark } from '../types';

/**
 * Normalizes user input from the address or search bar into a valid URL or a search query.
 */
export function normalizeUrlOrSearch(rawInput: string, searchEngineBase = 'https://www.google.com/search?q='): string {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return '';
  }

  // Only allow explicitly safe web protocols (http, https) and internal about:blank
  if (/^https?:\/\//i.test(trimmed) || /^about:blank$/i.test(trimmed)) {
    return trimmed;
  }

  // Explicitly block untrusted protocols (javascript:, file:, data:, etc.) from direct navigation;
  // convert them to safe web searches instead of allowing execution or local filesystem exposure.
  if (/^(javascript|file|data|vbscript|blob):/i.test(trimmed)) {
    return `${searchEngineBase}${encodeURIComponent(trimmed)}`;
  }

  // Localhost or IP address with optional port
  if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed) || /^127\.0\.0\.1(:\d+)?(\/.*)?$/.test(trimmed) || /^192\.168\.\d+\.\d+(:\d+)?(\/.*)?$/.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Basic domain name check (e.g. example.com, sub.example.co.uk/path)
  const domainRegex = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/;
  if (domainRegex.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Otherwise, treat as a search query
  return `${searchEngineBase}${encodeURIComponent(trimmed)}`;
}

/**
 * Selects the most suitable active tab for a given space.
 * Prioritizes the active tab in that space, or the most recently accessed tab.
 */
export function selectTabForSpace(tabs: Tab[], spaceId: string, currentActiveTabId?: string): Tab | null {
  if (!Array.isArray(tabs) || tabs.length === 0) {
    return null;
  }
  const spaceTabs = tabs.filter(t => t.spaceId === spaceId);
  if (spaceTabs.length === 0) {
    return null;
  }

  // If current active tab already belongs to this space, keep it
  if (currentActiveTabId) {
    const current = spaceTabs.find(t => t.id === currentActiveTabId);
    if (current) return current;
  }

  // If a tab is already marked active in this space, return it
  const activeInSpace = spaceTabs.find(t => t.isActive);
  if (activeInSpace) return activeInSpace;

  // Otherwise pick the most recently accessed tab, with fallback to first tab
  return [...spaceTabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || spaceTabs[0];
}

/**
 * Evaluates whether a tab qualifies for hibernation.
 * 
 * Safety invariants:
 * 1. Active tab NEVER hibernates.
 * 2. Dedicated split tab (when split view is active) NEVER hibernates.
 * 3. Pinned tabs NEVER hibernate.
 * 4. Already hibernated tabs do not hibernate again (return false).
 * 5. Tabs without valid lastAccessed timestamp never hibernate.
 * 6. Only unpinned background tabs exceeding the idle duration are hibernated.
 */
export function shouldTabHibernate(
  tab: Tab,
  activeTabId: string,
  isSplitView: boolean,
  splitTabId: string | null,
  idleLimitMs: number,
  currentTimeMs: number
): boolean {
  if (!tab || tab.isHibernated) {
    return false;
  }

  // Guard 1: Active tab never hibernates
  if (tab.id === activeTabId || tab.isActive) {
    return false;
  }

  // Guard 2: Split view secondary tab never hibernates
  if (isSplitView && splitTabId && tab.id === splitTabId) {
    return false;
  }

  // Guard 3: Pinned tabs never hibernate
  if (tab.isPinned) {
    return false;
  }

  // Guard 4: Must have a valid lastAccessed timestamp
  if (!tab.lastAccessed || typeof tab.lastAccessed !== 'number') {
    return false;
  }

  // Guard 5: Idle threshold check
  const idleTime = currentTimeMs - tab.lastAccessed;
  return idleTime > idleLimitMs;
}

export function hibernateIdleTabs(
  tabs: Tab[],
  activeTabId: string,
  isSplitView: boolean,
  splitTabId: string | null,
  idleLimitMs: number,
  currentTimeMs: number,
): Tab[] {
  let changed = false;
  const updatedTabs = tabs.map((tab) => {
    if (!shouldTabHibernate(tab, activeTabId, isSplitView, splitTabId, idleLimitMs, currentTimeMs)) {
      return tab;
    }
    changed = true;
    return { ...tab, isHibernated: true };
  });
  return changed ? updatedTabs : tabs;
}

/**
 * Deduplicates bookmarks by normalized URL.
 * Supports passing a single list or merging two lists.
 */
export function deduplicateBookmarks(firstList: Bookmark[], secondList: Bookmark[] = []): Bookmark[] {
  const combined = [...(firstList || []), ...(secondList || [])];
  const seen = new Set<string>();
  const result: Bookmark[] = [];

  for (const item of combined) {
    if (!item || !item.url) continue;
    const norm = item.url.trim().toLowerCase().replace(/\/+$/, '');
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(item);
    }
  }

  return result;
}

/**
 * Recursively parses Chrome bookmark roots into a flat list of Bookmark items,
 * preserving full hierarchical folder paths (e.g. "Yer İmleri Çubuğu / İş / Projeler").
 */
export function parseChromeBookmarkTree(roots: any): Bookmark[] {
  if (!roots || typeof roots !== 'object') return [];

  const results: Bookmark[] = [];
  const seenUrls = new Set<string>();

  const traverse = (node: any, currentPath: string, isRoot = false) => {
    if (!node) return;

    if (node.url) {
      const normalizedUrl = String(node.url).trim().toLowerCase().replace(/\/+$/, '');
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        results.push({
          id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          title: node.name || node.url,
          url: node.url,
          dateAdded: node.date_added ? parseInt(node.date_added, 10) : Date.now(),
          folder: currentPath || 'Genel',
        });
      }
    } else if (Array.isArray(node.children)) {
      const folderName = node.name || 'Klasör';
      const nextPath = isRoot ? currentPath : (currentPath ? `${currentPath} / ${folderName}` : folderName);
      for (const child of node.children) {
        traverse(child, nextPath, false);
      }
    }
  };

  const rootsObj = roots.roots || roots;
  if (rootsObj.bookmark_bar) traverse(rootsObj.bookmark_bar, 'Yer İmleri Çubuğu', true);
  if (rootsObj.other) traverse(rootsObj.other, 'Diğer Yer İmleri', true);
  if (rootsObj.synced) traverse(rootsObj.synced, 'Mobil Yer İmleri', true);

  return results;
}

/**
 * Validates whether Google search suggestions should be queried
 * based on user privacy preference and query length.
 */
export function shouldFetchSearchSuggestions(enabled: boolean, query: string): boolean {
  if (!enabled) return false;
  const trimmed = (query || '').trim();
  return trimmed.length > 0 && trimmed.length <= 300;
}

/**
 * Validates whether contextual text translation should be triggered
 * based on user privacy preference and selection length.
 */
export function shouldPerformTranslation(enabled: boolean, text: string): boolean {
  if (!enabled) return false;
  const trimmed = (text || '').trim();
  return trimmed.length > 1 && trimmed.length <= 4000;
}

export function isNavigationAborted(errorCode?: number, errorDescription?: string): boolean {
  return errorCode === -3 || errorDescription?.includes('ERR_ABORTED') === true;
}

export function getNavigationErrorMessage(errorCode?: number, errorDescription?: string): string {
  const error = errorDescription?.toUpperCase() ?? '';
  if (errorCode === -106 || error.includes('ERR_INTERNET_DISCONNECTED')) {
    return 'İnternet bağlantınız kesilmiş görünüyor. Bağlantınızı kontrol edip yeniden deneyin.';
  }
  if (errorCode === -105 || error.includes('ERR_NAME_NOT_RESOLVED')) {
    return 'Bu site adresi bulunamadı. Adresi kontrol edip yeniden deneyin.';
  }
  if (errorCode === -102 || error.includes('ERR_CONNECTION_REFUSED')) {
    return 'Site bağlantıyı reddetti. Bir süre sonra yeniden deneyin.';
  }
  if (errorCode === -7 || error.includes('ERR_TIMED_OUT')) {
    return 'Site yanıt vermedi. Bağlantınızı kontrol edip yeniden deneyin.';
  }
  if (errorCode === -200 || errorCode === -201 || errorCode === -202 || error.startsWith('ERR_CERT_')) {
    return 'Güvenli bağlantı kurulamadı. Sertifika veya site güvenlik ayarlarını kontrol edin.';
  }
  return 'Sayfa yüklenemedi. İnternet bağlantınızı ve adresi kontrol edip yeniden deneyin.';
}

/**
 * Merges bookmarks from multiple Chrome profiles into a single deduplicated list.
 */
export function mergeChromeBookmarkProfiles(profileTrees: any[]): Bookmark[] {
  if (!Array.isArray(profileTrees) || profileTrees.length === 0) return [];
  const allParsed = profileTrees.flatMap(tree => parseChromeBookmarkTree(tree));
  return deduplicateBookmarks(allParsed);
}
