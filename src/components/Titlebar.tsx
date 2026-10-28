import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Shield, ShieldAlert, Cpu } from 'lucide-react';
import { SecurityStats, MemoryMetrics } from '../types';

interface TitlebarProps {
  onOpenSecurity: () => void;
  onOpenGoogleHub: () => void;
  onError: (message: string, error?: unknown) => void;
  securityStats: SecurityStats;
  totalTabs: number;
  hibernatedTabs: number;
  memoryMetrics?: MemoryMetrics;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  onOpenSecurity,
  onOpenGoogleHub,
  onError,
  securityStats,
  totalTabs,
  hibernatedTabs,
  memoryMetrics,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.znyAPI) {
      window.znyAPI.isMaximized().then(setIsMaximized).catch((error: unknown) => {
        onError('Pencere durumu okunamadı.', error);
      });
    }
  }, [onError]);

  const handleMinimize = async () => {
    try {
      if (!window.znyAPI?.minimize) throw new Error('Window controls are unavailable');
      await window.znyAPI.minimize();
    } catch (error) {
      onError('Pencere küçültülemedi.', error);
    }
  };
  const handleMaximize = async () => {
    try {
      if (!window.znyAPI?.maximize) throw new Error('Window controls are unavailable');
      const res = await window.znyAPI.maximize();
      setIsMaximized(res);
    } catch (error) {
      onError('Pencere boyutu değiştirilemedi.', error);
    }
  };
  const handleClose = async () => {
    try {
      if (!window.znyAPI?.close) throw new Error('Window controls are unavailable');
      await window.znyAPI.close();
    } catch (error) {
      onError('Pencere kapatılamadı.', error);
    }
  };

  return (
    <header className="h-11 bg-[#0e1218] border-b border-white/[0.055] flex items-center justify-between px-4 drag-region select-none text-xs text-gray-300 z-50 min-w-0">
      {/* Left: Brand & Arc Logo */}
      <div className="flex items-center gap-2.5 no-drag flex-shrink-0">
        <img
          src="./zny-mark.svg"
          alt=""
          aria-hidden="true"
          className="w-[22px] h-[22px] rounded-[7px] shadow-[0_2px_12px_rgba(135,170,235,0.18)]"
        />
        <span className="font-semibold text-[#e4e9f2] tracking-[0.025em] text-[12px] whitespace-nowrap">
          ZNY <span className="text-[#8f99a9] font-normal">Browser</span>
        </span>
      </div>

      {/* Middle: Clean Draggable Area */}
      <div className="flex-1 h-full drag-region min-w-[20px]" />

      {/* Right: Quick Action Icons & Window Controls */}
      <div className="flex items-center gap-1.5 no-drag flex-shrink-0">
        {/* Real RAM Indicator (Calm, Responsive & Consistent Icon Button) */}
        <button
          type="button"
          onClick={onOpenSecurity}
          className="h-7 px-2 rounded-md hover:bg-white/[0.055] flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
          title={
            memoryMetrics && !memoryMetrics.isUnavailable && memoryMetrics.totalMB > 0
              ? `Chromium RAM Kullanımı: ${memoryMetrics.totalMB} MB (${memoryMetrics.processCount} süreç)\n${totalTabs} açık sekme (${hibernatedTabs} askıda)\nDetaylar için tıklayın.`
              : 'Chromium süreç bellek ölçümü hazır değil veya kullanılamıyor.'
          }
          aria-label="Chromium Bellek Durumu"
        >
          <Cpu className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-300">
            {memoryMetrics && !memoryMetrics.isUnavailable && memoryMetrics.totalMB > 0 ? `${memoryMetrics.totalMB} MB` : 'RAM'}
          </span>
        </button>

        {/* Security Shield Icon Button */}
        <button
          type="button"
          onClick={onOpenSecurity}
          className="w-7 h-7 rounded-md hover:bg-white/[0.055] flex items-center justify-center text-gray-400 hover:text-blue-200 transition cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-300"
          title={
            securityStats.isShieldActive
              ? 'ZNY Güvenlik Kalkanı: Aktif (Ağ seviyesinde filtreleme)'
              : 'ZNY Güvenlik Kalkanı: Devre Dışı'
          }
          aria-label="Güvenlik Kalkanı"
        >
          {securityStats.isShieldActive ? (
            <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-3.5 bg-white/10 mx-0.5" />


        {/* Window Controls */}
        <button
          type="button"
          onClick={handleMinimize}
          className="w-8 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.07] text-gray-400 hover:text-white transition cursor-pointer"
          title="Simge Durumuna Küçült"
          aria-label="Simge Durumuna Küçült"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          className="w-8 h-7 flex items-center justify-center rounded-md hover:bg-white/[0.07] text-gray-400 hover:text-white transition cursor-pointer"
          title="Ekranı Kapla"
          aria-label="Ekranı Kapla"
        >
          {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="w-8 h-7 flex items-center justify-center rounded-md hover:bg-[#b94750] text-gray-400 hover:text-white transition cursor-pointer"
          title="Kapat"
          aria-label="Kapat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
