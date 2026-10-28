import React, { useState, useEffect } from 'react';
import { Languages, Copy, Check, X, AlertTriangle, RotateCw } from 'lucide-react';
import { ContextualTranslation } from '../types';

interface TranslateTooltipProps {
  data: ContextualTranslation | null;
  onClose: () => void;
}

export const TranslateTooltip: React.FC<TranslateTooltipProps> = ({ data, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeData, setActiveData] = useState<ContextualTranslation | null>(data);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    setActiveData(data);
    setCopied(false);
    setIsRetrying(false);
    setCopyError(null);
  }, [data]);

  useEffect(() => {
    if (!activeData) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeData, onClose]);

  if (!activeData) return null;

  const handleCopy = async () => {
    if (!activeData.translation || activeData.isError) return;
    try {
      await navigator.clipboard.writeText(activeData.translation);
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Could not copy translation to clipboard:', error);
      setCopyError('Çeviri panoya kopyalanamadı.');
    }
  };

  const handleRetry = async () => {
    if (!window.znyAPI?.translateText || isRetrying) return;
    setIsRetrying(true);
    try {
      const res = await window.znyAPI.translateText(activeData.text, activeData.targetLang || 'tr');
      if (res && res.success && res.translatedText) {
        setActiveData({
          ...activeData,
          translation: res.translatedText,
          sourceLang: res.sourceLang || 'auto',
          targetLang: res.targetLang || 'tr',
          isError: false,
          errorMessage: undefined,
        });
      } else {
        setActiveData({
          ...activeData,
          isError: true,
          errorMessage: res?.error || 'Çeviri servisi yanıt vermedi.',
        });
      }
    } catch (err: any) {
      setActiveData({
        ...activeData,
        isError: true,
        errorMessage: err?.message || 'Çeviri isteği başarısız oldu.',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  // Adjust coordinates so it doesn't overflow screen boundaries
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(Math.max(activeData.x - 140, 280), window.innerWidth - 320),
    top: Math.min(activeData.y + 45, window.innerHeight - 180),
    zIndex: 9999,
  };

  return (
    <div
      style={style}
      role="region"
      aria-label="Bağlamsal Çeviri"
      className="w-80 bg-[#141722] border border-white/[0.1] rounded-xl p-3 shadow-2xl animate-fade-in text-xs text-gray-200 select-text"
    >
      <div aria-live="polite" className="sr-only">
        {copied ? 'Çeviri panoya kopyalandı' : ''}
        {activeData.isError ? 'Çeviri hatası oluştu' : ''}
      </div>
      {copyError && <div role="alert" className="mb-2 text-xs text-amber-300">{copyError}</div>}

      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 select-none">
        <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
          <Languages className="w-4 h-4" />
          <span>Bağlamsal Çeviri</span>
        </div>
        <div className="flex items-center gap-1">
          {!activeData.isError && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
              title="Çeviriyi Kopyala"
              aria-label="Çeviriyi Kopyala"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
            title="Kapat"
            aria-label="Kapat"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Original text snippet */}
      <div className="text-xs text-gray-400 italic mb-1 line-clamp-2">
        "{activeData.text}"
      </div>

      {/* Translated text or Error state */}
      {activeData.isError ? (
        <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl text-red-200 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              {activeData.errorMessage || 'Çeviri servisine ulaşılamadı. Lütfen bağlantınızı kontrol edin.'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="self-end inline-flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-white text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Yeniden Dene</span>
          </button>
        </div>
      ) : (
        <div className="font-medium text-white text-sm bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
          {activeData.translation}
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 select-none">
        <span>Google Translate Motoru</span>
        <span className="uppercase">{activeData.sourceLang} → {activeData.targetLang}</span>
      </div>
    </div>
  );
};
