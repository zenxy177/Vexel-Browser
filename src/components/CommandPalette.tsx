import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Globe, ArrowRight, X, Sparkles, ExternalLink
} from 'lucide-react';
import { Tab, Space } from '../types';
import { normalizeUrlOrSearch, shouldFetchSearchSuggestions } from '../utils/browser-logic';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
  onNewTab: (url?: string) => void;
  tabs: Tab[];
  onSelectTab: (id: string) => void;
  spaces: Space[];
  onSelectSpace: (id: string) => void;
  searchSuggestionsEnabled?: boolean;
  onToggleSearchSuggestions?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onNewTab,
  tabs,
  onSelectTab,
  spaces,
  onSelectSpace,
  searchSuggestionsEnabled = true,
  onToggleSearchSuggestions,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState('');
  const [suggestionRetryCount, setSuggestionRetryCount] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setSuggestions([]);
      setSuggestionsError('');
      setIsLoadingSuggestions(false);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus?.();
        previouslyFocusedElementRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyNav = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [isOpen, onClose]);

  // Fetch live Google suggestions as user types (only if enabled, with strict cancellation)
  useEffect(() => {
    if (!shouldFetchSearchSuggestions(searchSuggestionsEnabled, query)) {
      setSuggestions([]);
      setSuggestionsError('');
      setIsLoadingSuggestions(false);
      return;
    }

    let isCancelled = false;
    const currentQuery = query.trim();

    setSuggestions([]);
    setSuggestionsError('');
    setIsLoadingSuggestions(true);
    const timer = setTimeout(async () => {
      if (window.znyAPI?.getGoogleSuggestions) {
        try {
          const results = await window.znyAPI.getGoogleSuggestions(currentQuery);
          if (!isCancelled && searchSuggestionsEnabled) {
            setSuggestions(results || []);
          }
        } catch (error) {
          console.warn('Could not fetch Google search suggestions:', error);
          if (!isCancelled) {
            setSuggestions([]);
            setSuggestionsError('Google önerileri şu anda alınamıyor.');
          }
        } finally {
          if (!isCancelled) {
            setIsLoadingSuggestions(false);
          }
        }
      } else {
        if (!isCancelled) {
          setSuggestionsError('Arama önerileri bu oturumda kullanılamıyor.');
          setIsLoadingSuggestions(false);
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, searchSuggestionsEnabled, suggestionRetryCount]);

  if (!isOpen) return null;

  // Filter open tabs matching query
  const matchingTabs = tabs.filter(t => 
    t.title.toLowerCase().includes(query.toLowerCase()) || 
    t.url.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = query.trim() ? 1 + suggestions.length + matchingTabs.length : 0;

  const handleSubmit = (targetUrl?: string) => {
    const finalQuery = targetUrl || query;
    if (!finalQuery.trim()) return;

    const destination = normalizeUrlOrSearch(finalQuery);
    onNavigate(destination);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (selectedIndex === 0) {
        handleSubmit();
      } else if (selectedIndex > 0 && selectedIndex <= suggestions.length) {
        handleSubmit(suggestions[selectedIndex - 1]);
      } else if (selectedIndex > suggestions.length && selectedIndex <= suggestions.length + matchingTabs.length) {
        const tab = matchingTabs[selectedIndex - 1 - suggestions.length];
        if (tab) {
          onSelectTab(tab.id);
          onClose();
        }
      } else {
        handleSubmit();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalItems > 0) {
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalItems > 0) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
    >
      {/* Click outside to close */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      <div ref={dialogRef} className="w-full max-w-2xl bg-[#141722] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <h2 id="command-palette-title" className="sr-only">Hızlı Arama ve Komut Paleti</h2>
        {/* Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            aria-label="Google araması veya web adresi"
            placeholder="Google'da ara veya bir web adresi yazın... (Esc ile çık)"
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-400 text-sm focus:outline-none select-text"
          />

          {isLoadingSuggestions && (
            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}

          {query && (
            <button 
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              className="text-gray-400 hover:text-white p-1 rounded-md cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
              aria-label="Aramayı Temizle"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/5">Enter</kbd>
            <span>ile git</span>
          </div>
        </div>

        {/* Suggestions & Open Tabs Results */}
        <div className="max-h-96 overflow-y-auto p-2 flex flex-col gap-1 text-xs">
          {/* Primary Action */}
          {query.trim() && (
            <button
              type="button"
              onClick={() => handleSubmit()}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition text-left focus-visible:ring-1 focus-visible:ring-blue-500 ${
                selectedIndex === 0 
                  ? 'bg-blue-600 text-white font-medium shadow-sm' 
                  : 'hover:bg-white/5 text-gray-200'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="truncate">
                  Google'da Ara: <strong className="text-white">"{query}"</strong>
                </span>
              </div>
              <ArrowRight className="w-4 h-4 opacity-70 flex-shrink-0 ml-2" />
            </button>
          )}

          {/* Live Google Suggestions */}
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSubmit(suggestion)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition text-left focus-visible:ring-1 focus-visible:ring-blue-500 ${
                selectedIndex === idx + 1
                  ? 'bg-blue-600/30 text-white font-medium border border-blue-500/40'
                  : 'hover:bg-white/5 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="truncate">{suggestion}</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono ml-2">Google Önerisi</span>
            </button>
          ))}

          {suggestionsError && (
            <div role="status" className="flex items-center justify-between gap-3 px-3 py-2 text-gray-400">
              <span>{suggestionsError}</span>
              <button
                type="button"
                onClick={() => setSuggestionRetryCount((count) => count + 1)}
                className="flex-shrink-0 text-blue-300 hover:text-blue-200 focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              >
                Yeniden Dene
              </button>
            </div>
          )}

          {/* Matching Open Tabs */}
          {query.trim() && matchingTabs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <div className="px-3 py-1 text-xs font-semibold text-gray-400">
                Açık Sekmeler
              </div>
              {matchingTabs.map((tab, idx) => {
                const itemIndex = 1 + suggestions.length + idx;
                const isSelected = selectedIndex === itemIndex;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(tab.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition text-left focus-visible:ring-1 focus-visible:ring-blue-500 ${
                      isSelected
                        ? 'bg-blue-600/30 text-white font-medium border border-blue-500/40'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      {tab.favicon ? (
                        <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm flex-shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      )}
                      <span className="truncate font-medium">{tab.title}</span>
                    </div>
                    <span className="text-xs text-blue-400 font-mono ml-2">Sekmeye Geç</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty State / Shortcuts */}
          {!query.trim() && (
            <div className="p-3 flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-400">Hızlı Kısayollar</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit('https://www.google.com/')}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 transition text-left cursor-pointer"
                >
                  <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-medium text-xs text-white">Google Ana Sayfa</div>
                    <div className="text-[11px] text-gray-400 truncate">google.com</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('https://gemini.google.com/app')}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 transition text-left cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-medium text-xs text-white">Google Gemini AI</div>
                    <div className="text-[11px] text-gray-400 truncate">gemini.google.com</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('https://youtube.com')}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 transition text-left cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-medium text-xs text-white">YouTube</div>
                    <div className="text-[11px] text-gray-400 truncate">youtube.com</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('https://mail.google.com')}
                  className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 transition text-left cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-medium text-xs text-white">Gmail</div>
                    <div className="text-[11px] text-gray-400 truncate">mail.google.com</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Search Suggestions Preference Toggle & Keyboard hints */}
        <div className="px-4 py-2.5 bg-black/30 border-t border-white/5 flex items-center justify-between text-xs text-gray-400 select-none">
          <div className="flex items-center gap-2">
            <span className="text-xs">Google Canlı Öneriler:</span>
            {onToggleSearchSuggestions && (
              <button
                type="button"
                onClick={onToggleSearchSuggestions}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
                  searchSuggestionsEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/10 text-gray-400 border border-white/10'
                }`}
                title="Google'a arama sorgusu ileterek canlı tamamlama önerileri sunar"
              >
                {searchSuggestionsEnabled ? 'Açık' : 'Kapalı'}
              </button>
            )}
            <span className="text-xs text-gray-500 hidden md:inline">· Google API</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-gray-500 hidden sm:flex">
            <span>↑↓ Gezin</span>
            <span>↵ Git</span>
            <span>Esc Kapat</span>
          </div>
        </div>
      </div>
    </div>
  );
};
