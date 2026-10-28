import React, { useEffect, useRef } from 'react';
import { 
  Shield, X, Ban, EyeOff, Lock, CheckCircle2,
  Sliders, Search, Languages, Info, Cpu, RefreshCw, Download, ListFilter
} from 'lucide-react';
import { SecurityStats, MemoryMetrics, UpdateStatus } from '../types';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SecurityStats;
  onToggleShield: () => void;
  activeUrl?: string;
  onSetSiteProtection: (site: string, allowed: boolean) => void | Promise<void>;
  onRefreshFilters: () => void | Promise<void>;
  searchSuggestionsEnabled?: boolean;
  onToggleSearchSuggestions?: () => void;
  selectionTranslationEnabled?: boolean;
  onToggleSelectionTranslation?: () => void;
  memoryMetrics?: MemoryMetrics;
  totalTabs?: number;
  hibernatedTabs?: number;
  updateStatus: UpdateStatus;
  onCheckForUpdates: () => void | Promise<void>;
  onDownloadUpdate: () => void | Promise<void>;
  onInstallUpdate: () => void | Promise<void>;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  stats,
  onToggleShield,
  activeUrl = '',
  onSetSiteProtection,
  onRefreshFilters,
  searchSuggestionsEnabled = true,
  onToggleSearchSuggestions,
  selectionTranslationEnabled = true,
  onToggleSelectionTranslation,
  memoryMetrics,
  totalTabs,
  hibernatedTabs,
  updateStatus,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Close on Escape key, Focus Trap & Focus Return
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

  if (!isOpen) return null;

  let activeSite = '';
  try {
    const url = new URL(activeUrl);
    if (url.protocol === 'https:' || url.protocol === 'http:') activeSite = url.hostname.toLowerCase();
  } catch {
    activeSite = '';
  }
  const isCurrentSiteAllowed = activeSite !== '' && stats.allowedSites.includes(activeSite);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-modal-title"
    >
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      <div 
        ref={modalRef}
        className="w-full max-w-xl bg-[#141722] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              stats.isShieldActive 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="security-modal-title" className="text-sm font-semibold text-white">
                ZNY Güvenlik & Ağ Filtresi Paneli
              </h2>
              <p className="text-xs text-gray-400">
                Bilinen reklam ve takipçi alan adları için temel ağ filtresi ve Chromium bellek durumu
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

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Shield Toggle Banner */}
          <div className="px-6 py-3.5 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${stats.isShieldActive ? 'bg-emerald-400' : 'bg-gray-500'}`} />
              <div>
                <div className="text-xs font-medium text-white">
                  Kalkan Durumu: {stats.isShieldActive ? 'Ağ Koruması Aktif' : 'Devre Dışı'}
                </div>
                <div className="text-[11px] text-gray-400">
                  {stats.isShieldActive ? 'Reklam ve izleyici istekleri engellenir' : 'Ağ filtresi kapalı'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleShield}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500 ${
                stats.isShieldActive
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              }`}
            >
              {stats.isShieldActive ? 'Kalkanı Durdur' : 'Kalkanı Başlat'}
            </button>
          </div>

          <div className="px-6 pt-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-white">Bu alan adı için koruma</div>
                <div className="mt-1 truncate text-xs text-gray-400">
                  {activeSite || 'Açık bir web sitesi yok'}
                  {isCurrentSiteAllowed ? ' · istisna listesinde' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => activeSite && void onSetSiteProtection(activeSite, !isCurrentSiteAllowed)}
                disabled={!activeSite}
                className={`flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition focus-visible:ring-1 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 ${
                  isCurrentSiteAllowed
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                    : 'border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]'
                }`}
              >
                {isCurrentSiteAllowed ? 'Bu sitede kalkanı etkinleştir' : 'Bu sitede kalkanı durdur'}
              </button>
            </div>
          </div>

          <div className="px-6 pt-4">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <ListFilter className="h-4 w-4 flex-shrink-0 text-blue-300" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">Açık kaynaklı reklam ve izleyici motoru</div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    Ghostery · {stats.filterListDomains.toLocaleString('tr-TR')} filtre kuralı
                    {stats.filterListUpdatedAt ? ` · ${new Date(stats.filterListUpdatedAt).toLocaleDateString('tr-TR')} güncellendi` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onRefreshFilters()}
                disabled={stats.filterListStatus === 'updating'}
                className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 focus-visible:ring-1 focus-visible:ring-blue-300 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${stats.filterListStatus === 'updating' ? 'animate-spin' : ''}`} />
                {stats.filterListStatus === 'updating' ? 'Güncelleniyor' : 'Şimdi güncelle'}
              </button>
            </div>
            <div className="mt-2 text-[11px] text-gray-400" role="status" aria-live="polite">
              {stats.filterListStatus === 'bundled' && 'Yerleşik temel kurallar etkin; açık kaynaklı filtreler ilk fırsatta alınacak.'}
              {stats.filterListStatus === 'ready' && 'Açık kaynaklı filtreler hazır. Güncellemeler 24 saatte bir denetlenir.'}
              {stats.filterListStatus === 'updating' && 'Ghostery filtreleri güvenli bağlantı üzerinden alınıyor; kayıtlı kurallar çalışmaya devam ediyor.'}
              {stats.filterListStatus === 'error' && (stats.filterListError || 'Filtreler güncellenemedi; kayıtlı kurallar kullanılmaya devam ediyor.')}
            </div>
          </div>

          <div className="px-6 pt-5">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <div className="text-xs font-semibold text-white">Son engellemeler</div>
              <div className="text-[11px] text-gray-400">Son 60 kayıt bellekte tutulur</div>
            </div>
            {stats.recentBlocked.length === 0 ? (
              <div className="rounded-lg border border-white/[0.06] px-3 py-4 text-center text-xs text-gray-400">
                Henüz engellenen bir istek yok.
              </div>
            ) : (
              <ul className="max-h-40 divide-y divide-white/[0.06] overflow-y-auto rounded-lg border border-white/[0.06]">
                {stats.recentBlocked.slice(0, 12).map((request, index) => (
                  <li key={`${request.timestamp}-${request.domain}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs text-gray-200">{request.domain}</div>
                      <div className="mt-0.5 truncate text-[11px] text-gray-400">
                            {request.site} · {request.resourceType === 'popup' ? 'açılır reklam' : request.category === 'tracker' ? 'izleyici' : 'reklam'} · {request.resourceType}
                      </div>
                    </div>
                    <time className="flex-shrink-0 text-[10px] text-gray-400">
                      {new Date(request.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
            {stats.allowedSites.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-gray-200">İzin verilen siteler</div>
                <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/[0.06]">
                  {stats.allowedSites.map(site => (
                    <li key={site} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate text-xs text-gray-300">{site}</span>
                      <button
                        type="button"
                        onClick={() => void onSetSiteProtection(site, false)}
                        className="flex-shrink-0 rounded-md px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:ring-1 focus-visible:ring-blue-500"
                      >
                        Korumayı aç
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Live Counters */}
          <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Ads Blocked */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400 mb-2">
                <Ban className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-white">{stats.adsBlocked}</span>
              <span className="text-xs text-gray-400 mt-0.5">Reklam Engellendi</span>
            </div>

            {/* Trackers Blocked */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 mb-2">
                <EyeOff className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-white">{stats.trackersBlocked}</span>
              <span className="text-xs text-gray-400 mt-0.5">İzleyici Engellendi</span>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-300 mb-2">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-white">{stats.blockedPopups}</span>
              <span className="text-xs text-gray-400 mt-0.5">Reklam Sekmesi Engellendi</span>
            </div>

            {/* HTTPS Upgrades */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col items-center text-center">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mb-2">
                <Lock className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black text-white">{stats.httpsUpgraded}</span>
              <span className="text-xs text-gray-400 mt-0.5">HTTPS Yükseltmesi</span>
            </div>
          </div>

          {/* Real Chromium Process Memory Breakdown */}
          {memoryMetrics && memoryMetrics.totalMB > 0 && (
            <div className="px-6 pb-5">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Chromium Bellek Durumu</div>
                    <div className="text-[11px] text-gray-400">
                      {memoryMetrics.processCount} aktif süreç · Ana süreç: {memoryMetrics.mainProcessMB} MB
                      {totalTabs !== undefined ? ` · ${totalTabs} açık sekme (${hibernatedTabs || 0} uyutuldu)` : ''}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-200 font-mono">
                  {memoryMetrics.totalMB} MB
                </span>
              </div>
            </div>
          )}
          {memoryMetrics?.isUnavailable && (
            <div role="status" className="px-6 pb-5 text-xs text-amber-300">
              Chromium bellek ölçümü şu anda kullanılamıyor; ölçüm otomatik olarak yeniden denenecek.
            </div>
          )}

          {/* Privacy & Data Transmission Settings */}
          <div className="px-6 pb-5 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Gizlilik ve Veri İletimi Tercihleri</span>
            </div>

            {/* Information Banner */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Arama önerileri ve bağlamsal çeviri özellikleri harici Google API uç noktalarına veri iletir. Gizliliğinizi korumak amacıyla bu servisleri tek tıkla açıp kapatabilirsiniz.
              </div>
            </div>

            {/* Toggle 1: Search Suggestions */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs font-medium text-white">Google Canlı Arama Önerileri</div>
                  <div className="text-xs text-gray-400">
                    Arama çubuğuna yazılan sorguları Google'a ileterek öneriler sunar
                  </div>
                </div>
              </div>
              {onToggleSearchSuggestions && (
                <button
                  type="button"
                  onClick={onToggleSearchSuggestions}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    searchSuggestionsEnabled
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {searchSuggestionsEnabled ? 'Açık' : 'Kapalı'}
                </button>
              )}
            </div>

            {/* Toggle 2: Selection Translation */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3">
                <Languages className="w-4 h-4 text-gray-400" />
                <div>
                  <div className="text-xs font-medium text-white">Seçili Metin Otomatik Çevirisi</div>
                  <div className="text-xs text-gray-400">
                    Web sayfasında fareyle seçilen metinleri Google Translate motoruna iletir
                  </div>
                </div>
              </div>
              {onToggleSelectionTranslation && (
                <button
                  type="button"
                  onClick={onToggleSelectionTranslation}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectionTranslationEnabled
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {selectionTranslationEnabled ? 'Açık' : 'Kapalı'}
                </button>
              )}
            </div>
          </div>

          <div className="px-6 pb-5">
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-white">Uygulama Güncellemesi</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    Yüklü sürüm: {updateStatus.currentVersion || '...'}
                    {updateStatus.version ? ` · Yeni sürüm: ${updateStatus.version}` : ''}
                  </div>
                </div>
                {updateStatus.state === 'checking' || updateStatus.state === 'downloading' ? (
                  <RefreshCw className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => void onCheckForUpdates()}
                    disabled={updateStatus.state === 'available' || updateStatus.state === 'downloaded'}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-white/70 text-white transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    Güncellemeleri denetle
                  </button>
                )}
              </div>

              <div className="text-xs text-gray-300" role="status" aria-live="polite">
                {updateStatus.state === 'idle' && 'Güncellemeleri istediğiniz zaman buradan denetleyebilirsiniz.'}
                {updateStatus.state === 'checking' && 'Yeni sürüm denetleniyor…'}
                {updateStatus.state === 'up-to-date' && 'Uygulamanız güncel.'}
                {updateStatus.state === 'available' && 'Yeni sürüm bulundu. İndirmeyi başlatabilirsiniz.'}
                {updateStatus.state === 'downloading' && `Güncelleme indiriliyor: %${Math.floor(updateStatus.percent ?? 0)}`}
                {updateStatus.state === 'downloaded' && 'Güncelleme hazır. Kurmak için uygulamayı yeniden başlatın.'}
                {updateStatus.state === 'error' && (updateStatus.message || 'Güncelleme denetlenemedi. Daha sonra yeniden deneyin.')}
              </div>

              {updateStatus.state === 'downloading' && (
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" aria-label={`İndirme yüzde ${Math.floor(updateStatus.percent ?? 0)}`}>
                  <div
                    className="h-full bg-blue-500 transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, updateStatus.percent ?? 0))}%` }}
                  />
                </div>
              )}

              {updateStatus.state === 'available' && (
                <button
                  type="button"
                  onClick={() => void onDownloadUpdate()}
                  className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Güncellemeyi indir
                </button>
              )}
              {updateStatus.state === 'downloaded' && (
                <button
                  type="button"
                  onClick={() => void onInstallUpdate()}
                  className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer"
                >
                  Yeniden başlat ve yükle
                </button>
              )}
            </div>
          </div>

          {/* Genuine Architectural Standards */}
          <div className="px-6 pb-6 flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-300 mb-1">Dahili Güvenlik Mimarisi</span>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Chromium Site İzolasyonu</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Ağ İstek Seviyesinde Filtre</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Otomatik HTTPS Yükseltme</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-gray-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Güvenli Multi-View Sekme Havuzu</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
