import React, { useEffect, useState } from 'react';
import { 
  Search, Plus, Columns, Globe, 
  X, Moon, FolderDown, ChevronLeft, ChevronRight,
  Pin, Compass, Briefcase, User, GraduationCap,
  Bookmark as BookmarkIcon, Folder, Trash2, Clock3
} from 'lucide-react';
import { Tab, Space, Bookmark } from '../types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  bookmarksViewRequest: number;
  spaces: Space[];
  activeSpaceId: string;
  onSelectSpace: (id: string) => void;
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onTogglePinTab: (id: string) => void;
  onNewTab: (url?: string) => void;
  onOpenCommandPalette: () => void;
  isSplitView: boolean;
  onToggleSplitView: () => void;
  onOpenChromeImporter: () => void;
  onOpenGoogleHub: () => void;
  onOpenHistory: () => void;
  bookmarks: Bookmark[];
  onSelectBookmark: (url: string) => void;
  onDeleteBookmark?: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  bookmarksViewRequest,
  spaces,
  activeSpaceId,
  onSelectSpace,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onTogglePinTab,
  onNewTab,
  onOpenCommandPalette,
  isSplitView,
  onToggleSplitView,
  onOpenChromeImporter,
  onOpenGoogleHub,
  onOpenHistory,
  bookmarks,
  onSelectBookmark,
  onDeleteBookmark,
}) => {
  const [activeView, setActiveView] = useState<'tabs' | 'bookmarks'>('tabs');
  const [bookmarkSearch, setBookmarkSearch] = useState('');

  useEffect(() => {
    if (bookmarksViewRequest > 0) setActiveView('bookmarks');
  }, [bookmarksViewRequest]);

  const handleTabAuxClick = (event: React.MouseEvent, tabId: string) => {
    if (event.button !== 1) return;
    event.preventDefault();
    onCloseTab(tabId);
  };

  const currentSpaceTabs = tabs.filter(t => t.spaceId === activeSpaceId);
  const pinnedTabs = currentSpaceTabs.filter(t => t.isPinned);
  const unpinnedTabs = currentSpaceTabs.filter(t => !t.isPinned);

  const getSpaceIcon = (iconName: string) => {
    switch (iconName) {
      case 'Briefcase': return <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'GraduationCap': return <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />;
      case 'Compass': return <Compass className="w-3.5 h-3.5 flex-shrink-0" />;
      default: return <User className="w-3.5 h-3.5 flex-shrink-0" />;
    }
  };

  const filteredBookmarks = bookmarks.filter(b => 
    b.title.toLowerCase().includes(bookmarkSearch.toLowerCase()) || 
    b.url.toLowerCase().includes(bookmarkSearch.toLowerCase()) ||
    (b.folder && b.folder.toLowerCase().includes(bookmarkSearch.toLowerCase()))
  );

  if (isCollapsed) {
    return (
      <aside className="w-16 bg-[#131620] border-r border-white/[0.06] flex flex-col items-center py-3 select-none justify-between z-40 transition-all duration-200">
        <div className="flex flex-col items-center gap-2 w-full">
          {/* Expand Button */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
            title="Kenar Çubuğunu Aç"
            aria-label="Kenar Çubuğunu Aç"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Search Button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 hover:text-blue-400 flex items-center justify-center transition cursor-pointer"
            title="Ara veya URL Aç (Ctrl+K)"
            aria-label="Ara veya URL Aç"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* New Tab */}
          <button
            type="button"
            onClick={() => onNewTab()}
            className="w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            title="Yeni Sekme (Ctrl+T)"
            aria-label="Yeni Sekme"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="w-8 h-px bg-white/[0.06] my-0.5" />

          {/* Pinned Tab Icons */}
          {pinnedTabs.length > 0 && (
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-36 px-1 w-full items-center">
              {pinnedTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onAuxClick={event => handleTabAuxClick(event, tab.id)}
                  onClick={() => onSelectTab(tab.id)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition relative cursor-pointer border focus-visible:ring-1 focus-visible:ring-blue-500 ${
                    tab.id === activeTabId 
                      ? 'bg-blue-600/30 border-blue-500/50 text-white shadow-sm' 
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] text-gray-400'
                  }`}
                  title={`Sabitlenmiş: ${tab.title}`}
                  aria-label={tab.title}
                >
                  {tab.favicon ? (
                    <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm" />
                  ) : (
                    <Globe className="w-4 h-4" />
                  )}
                  {tab.isHibernated && (
                    <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400 ring-1 ring-[#131620]" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Divider between pinned and unpinned in collapsed view */}
          {pinnedTabs.length > 0 && unpinnedTabs.length > 0 && (
            <div className="w-6 h-px bg-white/[0.06] my-0.5" />
          )}

          {/* Unpinned Open Tab Icons */}
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-56 px-1 w-full items-center">
            {unpinnedTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onAuxClick={event => handleTabAuxClick(event, tab.id)}
                onClick={() => onSelectTab(tab.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition relative cursor-pointer border focus-visible:ring-1 focus-visible:ring-blue-500 ${
                  tab.id === activeTabId 
                    ? 'bg-blue-600/30 border-blue-500/50 text-white shadow-sm' 
                    : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] text-gray-400'
                }`}
                title={tab.title}
                aria-label={tab.title}
              >
                {tab.favicon ? (
                  <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                {tab.isHibernated && (
                  <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-400 ring-1 ring-[#131620]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Actions & Space Switcher */}
        <div className="flex flex-col gap-2 items-center w-full">
          {/* Secondary Action Icons */}
          <div className="flex flex-col gap-1.5 items-center w-full">
            <button
              type="button"
              onClick={() => {
                onToggleCollapse();
                setActiveView('bookmarks');
              }}
              className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-amber-400 flex items-center justify-center transition cursor-pointer"
              title={`Yer İmleri (${bookmarks.length})`}
              aria-label="Yer İmleri"
            >
              <BookmarkIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleSplitView}
              className={`w-9 h-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center transition cursor-pointer ${
                isSplitView ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/[0.08] text-gray-400 hover:text-white'
              }`}
              title="Bölünmüş Ekran (Split View)"
              aria-label="Bölünmüş Ekran"
            >
              <Columns className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenHistory}
              className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-blue-300 flex items-center justify-center transition cursor-pointer"
              title="Geçmiş (Ctrl+H)"
              aria-label="Geçmiş"
            >
              <Clock3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenChromeImporter}
              className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-emerald-400 flex items-center justify-center transition cursor-pointer"
              title="Chrome'dan İçe Aktar"
              aria-label="Chrome'dan İçe Aktar"
            >
              <FolderDown className="w-4 h-4 text-emerald-400" />
            </button>
            <button
              type="button"
              onClick={onOpenGoogleHub}
              className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition cursor-pointer"
              title="Google Hub"
              aria-label="Google Hub"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </button>
          </div>

          <div className="w-8 h-px bg-white/[0.06] my-0.5" />

          {/* Spaces Switcher */}
          <div className="flex flex-col gap-1.5 items-center w-full">
            {spaces.map(space => (
              <button
                key={space.id}
                type="button"
                onClick={() => onSelectSpace(space.id)}
                className={`w-9 h-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center transition cursor-pointer border ${
                  space.id === activeSpaceId
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] border-transparent'
                }`}
                title={`${space.name} Çalışma Alanı`}
                aria-label={space.name}
              >
                {getSpaceIcon(space.icon)}
              </button>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] shrink-0 bg-[#10141b] border-r border-white/[0.055] flex flex-col justify-between py-3 px-3 select-none z-40 transition-all duration-200">
      <div className="flex flex-col gap-2.5 flex-1 overflow-hidden">
        {/* 1. Top Header: Active Space Name & Collapse Control */}
        <div className="flex items-center justify-between gap-1 px-1 min-h-[38px]">
          <div className="flex items-center gap-2.5 truncate min-w-0" title={`${spaces.find(s => s.id === activeSpaceId)?.name || 'Çalışma Alanı'} Çalışma Alanı`}>
            <span className="w-7 h-7 rounded-lg bg-[#1a2230] text-[#aac4ef] flex items-center justify-center flex-shrink-0">
              {getSpaceIcon(spaces.find(s => s.id === activeSpaceId)?.icon || 'User')}
            </span>
            <span className="text-[13px] font-semibold text-[#e3e8f0] tracking-[0.01em] truncate">
              {spaces.find(s => s.id === activeSpaceId)?.name || 'Çalışma Alanı'}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-8 h-8 min-h-[36px] min-w-[36px] rounded-md hover:bg-white/[0.06] text-gray-500 hover:text-white flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="Kenar Çubuğunu Daralt"
            aria-label="Kenar Çubuğunu Daralt"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Arc-Style Omnibar / Search & URL Bar Button (Ctrl+K) */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full min-h-[40px] flex items-center gap-2.5 px-3 py-2 rounded-[10px] bg-[#171c24] hover:bg-[#1b222c] border border-white/[0.055] text-gray-300 hover:text-white transition text-left group cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
          aria-label="Google'da ara veya URL yaz"
        >
          <Search className="w-3.5 h-3.5 text-[#8792a3] group-hover:text-[#b5cafa] flex-shrink-0 transition" />
          <span className="text-[12px] truncate flex-1 font-normal text-[#bbc3d0]">Ara veya URL yaz...</span>
          <kbd className="text-[10px] bg-black/20 text-gray-500 px-1.5 py-0.5 rounded-md border border-white/[0.055] font-mono">
            Ctrl+K
          </kbd>
        </button>

        {/* 3. Sabitlenmiş Sekmeler ve Açık Sekmeler Listesi (veya Yer İmleri Görünümü) */}
        {activeView === 'tabs' ? (
          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            {/* Pinned Tabs (if any) */}
            {pinnedTabs.length > 0 && (
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <div className="flex items-center justify-between px-1 text-xs text-gray-400 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-amber-400/80 rotate-45" /> Sabitlenenler
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">{pinnedTabs.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-1" role="list" aria-label="Sabitlenmiş Sekmeler">
                  {pinnedTabs.map(tab => (
                    <div
                      key={tab.id}
                      role="listitem"
                      onAuxClick={event => handleTabAuxClick(event, tab.id)}
                      className={`group relative flex items-center justify-between min-h-[34px] rounded-md text-xs transition ${
                        tab.id === activeTabId
                          ? 'bg-[#202a38] text-white font-medium'
                          : 'text-gray-400 hover:bg-white/[0.045] hover:text-gray-200'
                      }`}
                      title={tab.title}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectTab(tab.id)}
                        className="flex items-center gap-2 px-2.5 py-2 truncate flex-1 min-w-0 text-left cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 rounded-l-lg"
                        aria-label={`Sabitlenmiş: ${tab.title}${tab.isHibernated ? ' (Askıya alındı)' : ''}`}
                      >
                        {tab.favicon ? (
                          <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
                        ) : (
                          <Globe className="w-4 h-4 flex-shrink-0 text-gray-400" />
                        )}
                        <span className="truncate flex-1 text-xs">{tab.title}</span>
                        {tab.isHibernated && (
                          <span title="Sekme uykuda (bellek tasarrufu)">
                            <Moon className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-0.5 pr-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onTogglePinTab(tab.id)}
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:text-amber-400 text-gray-400 transition p-1 cursor-pointer rounded focus-visible:ring-1 focus-visible:ring-blue-500"
                          title="Sabitlemeyi Kaldır"
                          aria-label="Sabitlemeyi Kaldır"
                        >
                          <Pin className="w-3 h-3 rotate-45" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCloseTab(tab.id)}
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:text-red-400 text-gray-400 transition p-1 cursor-pointer rounded focus-visible:ring-1 focus-visible:ring-blue-500"
                          title="Sekmeyi Kapat"
                          aria-label="Sekmeyi Kapat"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unpinned Tabs Header */}
            <div className="flex items-center justify-between px-1 pt-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-400">Sekmeler</span>
                <span className="text-[11px] text-gray-500 font-mono">({unpinnedTabs.length})</span>
              </div>
              <button
                type="button"
                onClick={() => onNewTab()}
                className="p-1 rounded-md hover:bg-white/[0.08] text-gray-400 hover:text-white transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
                title="Yeni Sekme Aç (Ctrl+T)"
                aria-label="Yeni Sekme Aç"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tabs List */}
            <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1" role="list" aria-label="Açık Sekmeler">
              {unpinnedTabs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs">
                  Bu alanda açık sekme yok.
                </div>
              ) : (
                unpinnedTabs.map(tab => (
                  <div
                    key={tab.id}
                    role="listitem"
                    onAuxClick={event => handleTabAuxClick(event, tab.id)}
                    className={`group flex items-center justify-between min-h-[36px] rounded-md text-xs transition ${
                      tab.id === activeTabId
                      ? 'bg-[#202a38] text-[#edf2fa] font-medium shadow-[inset_2px_0_0_#a9c5f3]'
                      : 'bg-transparent text-[#aab3c1] hover:bg-white/[0.04] hover:text-gray-100'
                    }`}
                    title={tab.title}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTab(tab.id)}
                      className="flex items-center gap-2 px-2.5 py-2 truncate flex-1 min-w-0 text-left cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 rounded-l-lg"
                      aria-label={`Sekme: ${tab.title}${tab.isHibernated ? ' (Askıya alındı)' : ''}`}
                    >
                      {tab.favicon ? (
                        <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" />
                      ) : (
                        <Globe className="w-4 h-4 flex-shrink-0 text-gray-400" />
                      )}
                      <span className="truncate text-xs flex-1">{tab.title}</span>
                      {tab.isHibernated && (
                        <span 
                          className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 ml-1.5 flex-shrink-0"
                          title="Sekme bellek tasarrufu için askıya alındı. Tıklayınca anında uyanır."
                        >
                          <Moon className="w-2.5 h-2.5" /> Uyku
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-0.5 pr-1.5 flex-shrink-0">
                      {/* Pin button */}
                      <button
                        type="button"
                        onClick={() => onTogglePinTab(tab.id)}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:text-amber-400 text-gray-400 transition p-1 rounded cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
                        title="Sekmeyi Sabitle"
                        aria-label="Sekmeyi Sabitle"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>

                      {/* Close button */}
                      <button
                        type="button"
                        onClick={() => onCloseTab(tab.id)}
                        className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:text-red-400 text-gray-400 transition p-1 rounded cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
                        title="Sekmeyi Kapat"
                        aria-label="Sekmeyi Kapat"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        ) : (
          /* Bookmarks View */
          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setActiveView('tabs')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition cursor-pointer"
              >
                ← Sekmelere Dön
              </button>
              <button
                type="button"
                onClick={onOpenChromeImporter}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition cursor-pointer"
                title="Chrome'dan İçe Aktar"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>Aktar</span>
              </button>
            </div>

            {/* Bookmark search input */}
            <input
              type="text"
              id="bookmark-search-input"
              aria-label="Yer imlerinde ara"
              value={bookmarkSearch}
              onChange={(e) => setBookmarkSearch(e.target.value)}
              placeholder="Yer imlerinde ara..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-black/20 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 select-text"
            />

            {/* Bookmarks List */}
            <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1" role="list" aria-label="Kayıtlı Yer İmleri">
              {filteredBookmarks.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs px-2">
                  {bookmarks.length === 0 
                    ? 'Henüz yer imi kaydedilmedi. Chrome Veri Aktarıcısı ile tek tıkla aktarabilirsiniz.' 
                    : 'Aramanızla eşleşen yer imi bulunamadı.'}
                </div>
              ) : (
                filteredBookmarks.map(bm => (
                  <div
                    key={bm.id}
                    role="listitem"
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] group transition"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectBookmark(bm.url)}
                      className="flex items-center gap-2 truncate flex-1 min-w-0 text-left cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                      title={`${bm.title}\n${bm.url}`}
                      aria-label={`${bm.title} - ${bm.url}`}
                    >
                      <BookmarkIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <div className="truncate min-w-0">
                        <div className="text-xs font-medium text-gray-200 truncate">{bm.title}</div>
                        <div className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                          {bm.folder && (
                            <span className="flex items-center gap-0.5 text-gray-400">
                              <Folder className="w-2.5 h-2.5" /> {bm.folder} ·
                            </span>
                          )}
                          <span>{bm.url}</span>
                        </div>
                      </div>
                    </button>

                    {onDeleteBookmark && (
                      <button
                        type="button"
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-500 p-1 rounded transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
                        title="Yer İmini Kaldır"
                        aria-label="Yer İmini Kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Area: 4. Spaces Switcher + 5. Secondary Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-white/[0.06]">
        {/* 4. Çalışma Alanları (Spaces) */}
        <div className="grid grid-cols-3 gap-1 bg-black/25 p-1 rounded-lg border border-white/[0.05]" role="radiogroup" aria-label="Çalışma Alanları">
          {spaces.map(space => (
            <button
              key={space.id}
              type="button"
              role="radio"
              aria-checked={space.id === activeSpaceId}
              onClick={() => {
                onSelectSpace(space.id);
                setActiveView('tabs');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 min-h-[36px] rounded-md text-xs transition font-medium cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300 ${
                space.id === activeSpaceId
                  ? 'bg-[#202a38] text-[#c5d7f5] border border-[#7895bf]/20 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] border border-transparent'
              }`}
              title={`${space.name} Çalışma Alanı`}
              aria-label={`${space.name} Çalışma Alanı`}
            >
              {getSpaceIcon(space.icon)}
              <span className="text-xs truncate">{space.name}</span>
            </button>
          ))}
        </div>

        {/* 5. İkincil Eylemler (Secondary Actions Toolbar) */}
        <div className="grid grid-cols-2 gap-x-1 gap-y-0.5" role="toolbar" aria-label="Tarayıcı Araçları">
          {/* Yer İmleri Toggle */}
          <button
            type="button"
            onClick={() => setActiveView(prev => prev === 'bookmarks' ? 'tabs' : 'bookmarks')}
            className={`flex items-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs transition border cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 ${
              activeView === 'bookmarks'
                ? 'bg-[#202a38] border-white/[0.07] text-white font-medium'
                : 'bg-transparent border-transparent hover:bg-white/[0.045] text-[#aab3c1]'
            }`}
            title={activeView === 'bookmarks' ? 'Sekmelere Dön' : `Yer İmleri Koleksiyonu (${bookmarks.length})`}
            aria-label={activeView === 'bookmarks' ? 'Sekmelere Dön' : 'Yer İmleri'}
          >
            <BookmarkIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate flex-1 text-left text-xs">Yer İmleri</span>
            {bookmarks.length > 0 && (
              <span className="text-[10px] text-gray-400 font-mono">{bookmarks.length}</span>
            )}
          </button>

          {/* Split View Toggle */}
          <button
            type="button"
            onClick={onToggleSplitView}
            className={`flex items-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs transition border cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 ${
              isSplitView
                ? 'bg-[#202a38] border-[#7895bf]/20 text-[#c5d7f5] font-medium'
                : 'bg-transparent border-transparent hover:bg-white/[0.045] text-[#aab3c1]'
            }`}
            title="Bölünmüş Ekran (Split View)"
            aria-label="Bölünmüş Ekran"
          >
            <Columns className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1 text-left text-xs">{isSplitView ? 'Bölünmüş Açık' : 'Bölünmüş'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs bg-transparent hover:bg-white/[0.045] border border-transparent text-[#aab3c1] hover:text-white transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="Geçmiş (Ctrl+H)"
            aria-label="Geçmiş"
          >
            <Clock3 className="w-3.5 h-3.5 text-[#a9c5f3] flex-shrink-0" />
            <span className="truncate flex-1 text-left text-xs">Geçmiş</span>
          </button>

          {/* Chrome Import */}
          <button
            type="button"
            onClick={onOpenChromeImporter}
            className="flex items-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs bg-transparent hover:bg-white/[0.045] border border-transparent text-[#aab3c1] hover:text-white transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="Chrome'dan Yer İmlerini İçe Aktar"
            aria-label="Chrome'dan İçe Aktar"
          >
            <FolderDown className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate flex-1 text-left text-xs">Chrome Aktar</span>
          </button>

          {/* Google Hub */}
          <button
            type="button"
            onClick={onOpenGoogleHub}
            className="flex items-center gap-1.5 px-2.5 py-2 min-h-[36px] rounded-lg text-xs bg-transparent hover:bg-white/[0.045] border border-transparent text-[#aab3c1] hover:text-white transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
            title="Google Servisleri ve Kısayollar"
            aria-label="Google Hub"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span className="truncate flex-1 text-left text-xs">Google Hub</span>
          </button>
        </div>
      </div>

    </aside>
  );
};
