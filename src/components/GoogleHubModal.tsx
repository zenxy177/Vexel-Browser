import React, { useEffect, useRef } from 'react';
import { 
  X, Sparkles, ExternalLink, Mail, HardDrive, 
  MapPin, Calendar, Languages, CheckSquare, Image, 
  Video, Newspaper, UserCheck, ShieldCheck
} from 'lucide-react';

interface GoogleHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUrl: (url: string) => void;
}

export const GoogleHubModal: React.FC<GoogleHubModalProps> = ({
  isOpen,
  onClose,
  onOpenUrl,
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

  const services = [
    {
      name: 'Google Gemini AI',
      domain: 'gemini.google.com',
      url: 'https://gemini.google.com/app',
      icon: <Sparkles className="w-4 h-4 text-purple-400" />,
    },
    {
      name: 'Google Arama',
      domain: 'google.com',
      url: 'https://www.google.com/',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
      ),
    },
    {
      name: 'Gmail',
      domain: 'mail.google.com',
      url: 'https://mail.google.com',
      icon: <Mail className="w-4 h-4 text-red-400" />,
    },
    {
      name: 'Google Drive',
      domain: 'drive.google.com',
      url: 'https://drive.google.com',
      icon: <HardDrive className="w-4 h-4 text-yellow-400" />,
    },
    {
      name: 'YouTube',
      domain: 'youtube.com',
      url: 'https://youtube.com',
      icon: <Video className="w-4 h-4 text-red-500" />,
    },
    {
      name: 'Google Haritalar',
      domain: 'maps.google.com',
      url: 'https://maps.google.com',
      icon: <MapPin className="w-4 h-4 text-emerald-400" />,
    },
    {
      name: 'Google Takvim',
      domain: 'calendar.google.com',
      url: 'https://calendar.google.com',
      icon: <Calendar className="w-4 h-4 text-blue-400" />,
    },
    {
      name: 'Google Çeviri',
      domain: 'translate.google.com',
      url: 'https://translate.google.com',
      icon: <Languages className="w-4 h-4 text-sky-400" />,
    },
    {
      name: 'Google Keep',
      domain: 'keep.google.com',
      url: 'https://keep.google.com',
      icon: <CheckSquare className="w-4 h-4 text-amber-400" />,
    },
    {
      name: 'Google Fotoğraflar',
      domain: 'photos.google.com',
      url: 'https://photos.google.com',
      icon: <Image className="w-4 h-4 text-rose-400" />,
    },
    {
      name: 'Google Haberler',
      domain: 'news.google.com',
      url: 'https://news.google.com',
      icon: <Newspaper className="w-4 h-4 text-indigo-400" />,
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-hub-title"
    >
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      <div 
        ref={modalRef}
        className="w-full max-w-2xl bg-[#141722] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </div>
            <div>
              <h2 id="google-hub-title" className="text-sm font-semibold text-white">Google Ekosistemi</h2>
              <p className="text-xs text-gray-400">Entegre Google servisleri ve hızlı kısayollar</p>
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

        {/* Quick Connect Account */}
        <div className="px-6 py-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-300">
              Google Hesabınızla tek tıkla oturum açın
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onOpenUrl('https://accounts.google.com');
              onClose();
            }}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-sm cursor-pointer focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            Google Oturumu Aç
          </button>
        </div>

        {/* Services Grid (Calm, scannable) */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1">
          {services.map((service, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onOpenUrl(service.url);
                onClose();
              }}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.12] cursor-pointer transition text-left w-full focus-visible:ring-1 focus-visible:ring-blue-500 group"
              aria-label={`${service.name} (${service.domain})`}
            >
              <div className="p-2 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.08] transition flex-shrink-0">
                {service.icon}
              </div>
              <div className="flex-1 min-w-0">
                <span className="block font-medium text-xs text-gray-200 group-hover:text-blue-400 transition truncate">
                  {service.name}
                </span>
                <span className="block text-[11px] text-gray-500 truncate font-mono">
                  {service.domain}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
