import React, { useMemo, useState } from 'react';
import { Clock3, Search, Trash2, X } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  history: HistoryItem[];
  onClose: () => void;
  onSelect: (url: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const formatVisitTime = (timestamp: number) => new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(timestamp);

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  history,
  onClose,
  onSelect,
  onDelete,
  onClear,
}) => {
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
    if (!normalizedQuery) return history;
    return history.filter(item =>
      item.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery) ||
      item.url.toLocaleLowerCase('tr-TR').includes(normalizedQuery) ||
      item.searchTerm?.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
    );
  }, [history, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-sm flex items-start justify-center p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Geçmiş penceresini kapat" />
      <section className="relative flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121720] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#202a38] text-[#a9c5f3]">
              <Clock3 className="h-4 w-4" />
            </span>
            <div>
              <h2 id="history-modal-title" className="text-sm font-semibold text-gray-100">Geçmiş</h2>
              <p className="text-xs text-gray-400">{history.length} ziyaret kaydı</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              confirmClear ? (
                <>
                  <button type="button" onClick={() => setConfirmClear(false)} className="rounded-lg px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/5">Vazgeç</button>
                  <button type="button" onClick={() => { onClear(); setConfirmClear(false); }} className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/25">Tümünü sil</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmClear(true)} className="rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:bg-white/5 hover:text-red-300">Geçmişi temizle</button>
              )
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white" aria-label="Kapat">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <label className="mx-5 my-3 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-gray-500" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Geçmişte ara"
            aria-label="Geçmişte ara"
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder:text-gray-500"
          />
          <kbd className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-gray-500">Ctrl+H</kbd>
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {filteredHistory.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              {history.length === 0 ? 'Henüz ziyaret geçmişi yok.' : 'Aramanızla eşleşen kayıt bulunamadı.'}
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {filteredHistory.map(item => (
                <li key={item.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.045]">
                  <Clock3 className="h-4 w-4 shrink-0 text-gray-500" />
                  <button type="button" onClick={() => onSelect(item.url)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm text-gray-200">{item.title}</span>
                    <span className="block truncate text-xs text-gray-500">{item.url}</span>
                    {item.searchTerm && (
                      <span className="mt-1 block truncate text-xs text-[#a9c5f3]">Arama: {item.searchTerm}</span>
                    )}
                  </button>
                  <time className="shrink-0 text-[11px] text-gray-500">{formatVisitTime(item.visitTime)}</time>
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="rounded-lg p-2 text-gray-500 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`${item.title} geçmiş kaydını sil`}
                    title="Kaydı sil"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
