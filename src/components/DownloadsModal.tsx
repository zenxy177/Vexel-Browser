import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Download, ExternalLink, FileWarning, FolderOpen, Pause, Play, Trash2, X } from 'lucide-react';
import { BrowserDownload } from '../types';

interface DownloadsModalProps {
  isOpen: boolean;
  downloads: BrowserDownload[];
  onClose: () => void;
  onAction: (id: string, action: 'pause' | 'resume' | 'cancel' | 'remove') => void;
  onOpenFile: (id: string) => void;
  onShowInFolder: (id: string) => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
};

const getSourceLabel = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Web';
  }
};

const getStateLabel = (state: BrowserDownload['state']): string => ({
  progressing: 'İndiriliyor',
  paused: 'Duraklatıldı',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
  interrupted: 'Kesildi',
})[state];

export const DownloadsModal: React.FC<DownloadsModalProps> = ({
  isOpen,
  downloads,
  onClose,
  onAction,
  onOpenFile,
  onShowInFolder,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = closeButtonRef.current?.closest('[role="dialog"]')
        ?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center bg-black/65 p-4 pt-[8vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="downloads-modal-title"
    >
      <div className="absolute inset-0 cursor-default" onClick={onClose} aria-hidden="true" />
      <section className="relative flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121720] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#202a38] text-[#a9c5f3]">
              <Download className="h-4 w-4" />
            </span>
            <div>
              <h2 id="downloads-modal-title" className="text-sm font-semibold text-gray-100">İndirilenler</h2>
              <p className="text-xs text-gray-400">{downloads.length} dosya</p>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {downloads.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">Henüz indirme yok.</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {downloads.map(item => {
                const isActive = item.state === 'progressing' || item.state === 'paused' || (item.state === 'interrupted' && item.canResume);
                const progress = item.totalBytes > 0
                  ? Math.min(100, Math.round(item.receivedBytes / item.totalBytes * 100))
                  : 0;
                return (
                  <li key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-gray-500">
                        {item.state === 'completed'
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          : item.state === 'interrupted'
                            ? <FileWarning className="h-4 w-4 text-amber-400" />
                            : <Download className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-200" title={item.filename}>{item.filename}</div>
                        <div className="mt-1 truncate text-xs text-gray-500">{getSourceLabel(item.url)}</div>
                        {isActive && (
                          <>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                              <div className={`h-full rounded-full bg-[#9bbcff] transition-[width] ${item.totalBytes ? '' : 'w-1/3 animate-pulse'}`} style={item.totalBytes ? { width: `${progress}%` } : undefined} />
                            </div>
                            <div className="mt-1 flex justify-between text-[11px] text-gray-500">
                              <span>{item.state === 'paused' ? 'Duraklatıldı' : `${progress}%`}</span>
                              <span>{formatBytes(item.receivedBytes)}{item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : ''}</span>
                            </div>
                          </>
                        )}
                        {!isActive && (
                          <div className={`mt-1 text-[11px] ${item.state === 'interrupted' ? 'text-amber-300' : 'text-gray-500'}`}>
                            {item.error || getStateLabel(item.state)}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.state === 'completed' && (
                          <>
                            <button type="button" onClick={() => onOpenFile(item.id)} className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white" title="Dosyayı aç" aria-label={`${item.filename} dosyasını aç`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => onShowInFolder(item.id)} className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white" title="Klasörde göster" aria-label="Klasörde göster">
                              <FolderOpen className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {item.state === 'progressing' && (
                          <button type="button" onClick={() => onAction(item.id, 'pause')} className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white" title="Duraklat" aria-label="İndirmeyi duraklat">
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(item.state === 'paused' || (item.state === 'interrupted' && item.canResume)) && (
                          <button type="button" onClick={() => onAction(item.id, 'resume')} className="rounded-lg p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white" title="Devam et" aria-label="İndirmeye devam et">
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isActive ? (
                          <button type="button" onClick={() => onAction(item.id, 'cancel')} className="rounded-lg p-2 text-gray-300 hover:bg-[#2a2024] hover:text-red-100" title="İptal et" aria-label="İndirmeyi iptal et">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button type="button" onClick={() => onAction(item.id, 'remove')} className="rounded-lg p-2 text-gray-300 hover:bg-[#2a2024] hover:text-red-100" title="Listeden kaldır" aria-label="Listeden kaldır">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
