import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderDown, X, AlertCircle, Bookmark as BookmarkIcon,
  CheckCircle2, Folder, UserRound
} from 'lucide-react';
import { Bookmark, ChromeProfile, HistoryItem, ChromeHistoryImportResult } from '../types';

interface ChromeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (bookmarks: Bookmark[]) => void;
  onImportHistorySuccess: (items: HistoryItem[]) => void;
}

export const ChromeImportModal: React.FC<ChromeImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onImportHistorySuccess,
}) => {
  const [importStatus, setImportStatus] = useState<'loading' | 'no_profile' | 'no_bookmarks' | 'read_error' | 'success'>('loading');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [profiles, setProfiles] = useState<ChromeProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSelectingProfile, setIsSelectingProfile] = useState(false);
  const [historyImportStatus, setHistoryImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [historyImportMessage, setHistoryImportMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Escape key handler, focus trap & focus return
  useEffect(() => {
    if (!isOpen) {
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus?.();
        previouslyFocusedElementRef.current = null;
      }
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setImported(false);
      setImportStatus('loading');
      setErrorMessage(null);
      setProfiles([]);
      setSelectedProfileId(null);
      setHistoryImportStatus('idle');
      setHistoryImportMessage(null);

      const loadProfiles = async () => {
        try {
          if (window.znyAPI?.getChromeProfiles) {
            const availableProfiles = await window.znyAPI.getChromeProfiles();
            setProfiles(availableProfiles);
            const initialProfile = availableProfiles.find(profile => profile.hasBookmarks) ?? availableProfiles[0];
            if (initialProfile && window.znyAPI.importChromeBookmarksForProfile) {
              setSelectedProfileId(initialProfile.id);
              const result = await window.znyAPI.importChromeBookmarksForProfile(initialProfile.id);
              setImportStatus(result.status);
              setBookmarks(result.bookmarks || []);
              setErrorMessage(result.errorMessage ?? null);
              return;
            }
          }
          if (window.znyAPI?.importChromeBookmarks) {
            const result = await window.znyAPI.importChromeBookmarks();
            if (result && result.status) {
              setImportStatus(result.status);
              setBookmarks(result.bookmarks || []);
              if (result.errorMessage) {
                setErrorMessage(result.errorMessage);
              }
            } else {
              setImportStatus('no_bookmarks');
              setBookmarks([]);
            }
          } else {
            setImportStatus('no_profile');
          }
        } catch (err) {
          console.error('Error discovering Chrome profiles:', err);
          setImportStatus('read_error');
          setErrorMessage(err instanceof Error ? err.message : 'Chrome profilleri okunurken bir hata oluştu.');
        }
      };
      void loadProfiles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = () => {
    if (bookmarks.length === 0) return;
    onImportSuccess(bookmarks);
    setImported(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleSelectProfile = async () => {
    if (!window.znyAPI?.selectChromeProfile) {
      setImportStatus('read_error');
      setErrorMessage('Chrome klasörü seçme özelliği kullanılamıyor. Uygulamayı güncelleyip yeniden deneyin.');
      return;
    }

    setIsSelectingProfile(true);
    try {
      const result = await window.znyAPI.selectChromeProfile();
      if (!result) return;
      setImportStatus(result.status);
      setBookmarks(result.bookmarks);
      setErrorMessage(result.errorMessage ?? null);
    } catch (error) {
      console.error('Could not scan the selected Chrome profile:', error);
      setImportStatus('read_error');
      setErrorMessage(error instanceof Error ? error.message : 'Seçilen Chrome klasörü taranamadı.');
    } finally {
      setIsSelectingProfile(false);
    }
  };

  const handleChooseChromeProfile = async (profile: ChromeProfile) => {
    if (!window.znyAPI?.importChromeBookmarksForProfile) return;
    setSelectedProfileId(profile.id);
    setIsSelectingProfile(true);
    setImportStatus('loading');
    setErrorMessage(null);
    setImported(false);
    setHistoryImportStatus('idle');
    setHistoryImportMessage(null);
    try {
      const result = await window.znyAPI.importChromeBookmarksForProfile(profile.id);
      setImportStatus(result.status);
      setBookmarks(result.bookmarks);
      setErrorMessage(result.errorMessage ?? null);
    } catch (error) {
      console.error('Could not import bookmarks from the selected Chrome profile:', error);
      setImportStatus('read_error');
      setErrorMessage(error instanceof Error ? error.message : 'Seçilen Chrome profili okunamadı.');
    } finally {
      setIsSelectingProfile(false);
    }
  };

  const importHistoryResult = (result: ChromeHistoryImportResult | null) => {
    if (!result) return;
    if (result.status === 'success') {
      onImportHistorySuccess(result.items);
      setHistoryImportStatus('success');
      setHistoryImportMessage(`${result.items.length} Chrome geçmiş kaydı içe aktarıldı.`);
      return;
    }
    setHistoryImportStatus('error');
    setHistoryImportMessage(result.errorMessage || 'Chrome geçmişi içe aktarılamadı.');
  };

  const handleImportHistory = async (selectProfile = false) => {
    if (
      (!selectedProfileId && !window.znyAPI?.importChromeHistory) ||
      (selectedProfileId && !window.znyAPI?.importChromeHistoryForProfile) ||
      (selectProfile && !window.znyAPI?.selectChromeHistoryProfile)
    ) {
      setHistoryImportStatus('error');
      setHistoryImportMessage('Chrome geçmişi aktarım özelliği bulunamadı. Uygulamayı güncelleyin.');
      return;
    }
    setHistoryImportStatus('loading');
    setHistoryImportMessage(null);
    try {
      const result = selectProfile
        ? await window.znyAPI?.selectChromeHistoryProfile?.()
        : selectedProfileId
          ? await window.znyAPI?.importChromeHistoryForProfile?.(selectedProfileId)
          : await window.znyAPI?.importChromeHistory?.();
      if (!result) {
        setHistoryImportStatus('idle');
        return;
      }
      importHistoryResult(result);
    } catch (error) {
      console.error('Could not import Chrome browsing history:', error);
      setHistoryImportStatus('error');
      setHistoryImportMessage(error instanceof Error ? error.message : 'Chrome geçmişi okunamadı.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chrome-import-title"
    >
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      <div 
        ref={modalRef}
        className="w-full max-w-xl bg-[#141722] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h2 id="chrome-import-title" className="text-sm font-semibold text-white">Google Chrome Aktarıcısı</h2>
              <p className="text-xs text-gray-400">
                Yer imlerinizi ve gezinme geçmişinizi ZNY Browser'a aktarın
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/[0.08] text-gray-400 hover:text-white flex items-center justify-center transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {profiles.length > 0 && (
            <section aria-label="Chrome profili seçin">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-200">Chrome profili seçin</span>
                <span className="text-[11px] text-gray-500">{profiles.length} profil</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {profiles.map(profile => {
                  const isSelected = profile.id === selectedProfileId;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => void handleChooseChromeProfile(profile)}
                      disabled={isSelectingProfile}
                      aria-pressed={isSelected}
                      className={`flex min-h-24 flex-col items-start justify-between rounded-xl border p-3 text-left transition disabled:opacity-60 ${
                        isSelected
                          ? 'border-blue-400/70 bg-blue-500/10 ring-1 ring-blue-400/25'
                          : 'border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        isSelected ? 'bg-blue-500/20 text-blue-300' : 'bg-white/[0.07] text-gray-400'
                      }`}>
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span className="mt-2 block w-full truncate text-xs font-semibold text-gray-100" title={profile.name}>
                        {profile.name}
                      </span>
                      <span className="mt-1 flex gap-2 text-[10px] text-gray-500">
                        <span className={profile.hasBookmarks ? 'text-emerald-300' : ''}>Yer imleri</span>
                        <span className={profile.hasHistory ? 'text-emerald-300' : ''}>Geçmiş</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {importStatus === 'loading' ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-gray-400" aria-live="polite">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Seçilen profil taranıyor...</span>
            </div>
          ) : importStatus === 'read_error' ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-semibold block mb-0.5">Yer İmleri Dosyası Okunamadı</span>
                {errorMessage || 'Chrome yer imi dosyası bozuk veya erişilemez durumda.'}
                <button
                  type="button"
                  onClick={handleSelectProfile}
                  disabled={isSelectingProfile}
                  className="mt-2 block rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 disabled:opacity-50"
                >
                  {isSelectingProfile ? 'Taranıyor...' : 'Başka klasör seç'}
                </button>
              </div>
            </div>
          ) : importStatus === 'no_profile' ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5">Google Chrome profili otomatik bulunamadı</span>
                Chrome'un kullanıcı verisi klasörü farklı bir konumdaysa elle seçebilirsiniz. Chrome'un `User Data` klasörünü veya profil klasörünü (`Default`, `Profile 1` gibi) seçin.
              </div>
              <button
                type="button"
                onClick={handleSelectProfile}
                disabled={isSelectingProfile}
                className="shrink-0 rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-400/25 disabled:opacity-50"
              >
                {isSelectingProfile ? 'Taranıyor...' : 'Klasör seç'}
              </button>
            </div>
          ) : importStatus === 'no_bookmarks' ? (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-blue-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-400" />
              <div className="flex-1 text-xs leading-relaxed">
                <span className="font-semibold block mb-0.5 text-white">Bu profilde yer imi dosyası yok</span>
                Seçili Chrome profilinde okunabilir bir yer imi dosyası bulunamadı. Başka bir profil seçin veya farklı bir klasör seçin.
              </div>
              <button
                type="button"
                onClick={handleSelectProfile}
                disabled={isSelectingProfile}
                className="shrink-0 rounded-lg bg-blue-400/15 px-3 py-2 text-xs font-medium text-blue-100 hover:bg-blue-400/25 disabled:opacity-50"
              >
                {isSelectingProfile ? 'Taranıyor...' : 'Klasör seç'}
              </button>
            </div>
          ) : (

            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400">
                    <BookmarkIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {bookmarks.length} Adet Yer İmi Tespit Edildi
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Seçili profilin yer imleri kitaplığınıza aktarılmaya hazır
                    </div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                  Hazır
                </span>
              </div>

              {/* Preview List */}
              {bookmarks.length > 0 && (
                <div className="max-h-52 overflow-y-auto rounded-xl bg-black/25 p-2 border border-white/[0.06] flex flex-col gap-1 text-xs">
                  {bookmarks.slice(0, 15).map(bm => (
                    <div key={bm.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] text-gray-300">
                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                        <BookmarkIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                        <span className="truncate text-xs">{bm.title}</span>
                      </div>
                      <span className="text-[11px] text-gray-500 font-mono ml-2 truncate max-w-[140px] flex items-center gap-1">
                        <Folder className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        {bm.folder || 'Genel'}
                      </span>
                    </div>
                  ))}
                  {bookmarks.length > 15 && (
                    <div className="text-center py-1.5 text-xs text-gray-500">
                      ...ve {bookmarks.length - 15} adet daha
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
            <div className="min-w-0 text-xs text-gray-400" aria-live="polite">
              {historyImportMessage || (selectedProfileId
                ? 'Seçili profilin ziyaret ve arama geçmişini de aktarabilirsiniz.'
                : 'Chrome ziyaret ve arama geçmişini de aktarabilirsiniz.')}
            </div>
            <button
              type="button"
              onClick={() => handleImportHistory(historyImportStatus === 'error')}
              disabled={historyImportStatus === 'loading' || historyImportStatus === 'success'}
              className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-gray-200 hover:bg-white/[0.08] disabled:opacity-50"
            >
              {historyImportStatus === 'loading'
                ? 'Geçmiş aktarılıyor...'
                : historyImportStatus === 'success'
                  ? 'Geçmiş aktarıldı'
                  : historyImportStatus === 'error'
                    ? selectedProfileId ? 'Tekrar dene' : 'Başka klasör seç'
                    : 'Geçmişi içe aktar'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] flex items-center justify-between bg-black/10">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg hover:bg-white/[0.06] text-gray-400 hover:text-white text-xs font-medium transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            İptal
          </button>

          <button
            type="button"
            onClick={handleImport}
            disabled={importStatus !== 'success' || bookmarks.length === 0 || imported}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
            aria-live="polite"
          >
            {imported ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Kitaplığa Kaydedildi!</span>
              </>
            ) : (
              <>
                <FolderDown className="w-4 h-4" />
                <span>Kitaplığa Aktar ({bookmarks.length})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
