import { useEffect, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface NavbarProps {
  currentRoute: RoutePath;
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

const DESKTOP_NAV_ITEMS: Array<{ label: string; route: RoutePath }> = [
  { label: 'Explore', route: '/explore' },
  { label: 'Text to Video', route: '/text-to-video' },
  { label: 'Image to Video', route: '/image-to-video' },
  { label: 'How It Works', route: '/how-it-works' },
  { label: 'FAQ', route: '/faq' },
];

const MOBILE_NAV_ITEMS: Array<{ label: string; route: RoutePath }> = [
  { label: 'Home', route: '/' },
  { label: 'AI Studio', route: '/studio' },
  { label: 'Explore', route: '/explore' },
  { label: 'Text to Video', route: '/text-to-video' },
  { label: 'Image to Video', route: '/image-to-video' },
  { label: 'How It Works', route: '/how-it-works' },
  { label: 'FAQ', route: '/faq' },
  { label: 'Contact', route: '/contact' },
];

export function Navbar({ currentRoute, onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentRoute]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0B0D12]/90 backdrop-blur-md">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#D5FF3F] focus:text-[#0B0D12] focus:font-semibold focus:rounded-lg"
      >
        Skip to main content
      </a>

      {/* Strict 3-Zone Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-6 lg:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          aria-label="VidNova AI Home"
          className="whitespace-nowrap shrink-0 rounded-lg"
        >
          <BrandLogo size="sm" />
        </a>

        {/* Zone 2: 5 Clean Single-Line Text Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-7 text-sm font-medium"
        >
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = currentRoute === item.route;
            return (
              <a
                key={item.route}
                href={item.route}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.route);
                }}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 ${
                  active
                    ? 'text-[#F5F3EC] after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-[2px] after:bg-[#D5FF3F]'
                    : 'text-[#9298A6] hover:text-[#F5F3EC]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/studio')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-transform duration-150 active:scale-[0.98] cursor-pointer ${
              currentRoute === '/studio'
                ? 'bg-[#F5F3EC] text-[#0B0D12] hover:bg-white'
                : 'bg-[#D5FF3F] text-[#0B0D12] hover:bg-[#E2FF70]'
            }`}
          >
            <span className="hidden min-[375px]:inline">
              {currentRoute === '/studio' ? 'Studio Active' : 'Start Creating'}
            </span>
            <span className="inline min-[375px]:hidden">
              {currentRoute === '/studio' ? 'Studio' : 'Create'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="vidnova-mobile-menu"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-white/15 bg-[#151820] text-[#F5F3EC] hover:border-[#D5FF3F]/60 transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          id="vidnova-mobile-menu"
          className="lg:hidden border-t border-white/[0.08] bg-[#151820] px-4 sm:px-6 py-5"
        >
          <nav aria-label="Mobile navigation" className="grid grid-cols-1 gap-1">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = currentRoute === item.route;
              return (
                <a
                  key={item.route}
                  href={item.route}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.route);
                    setMobileOpen(false);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#0B0D12] text-[#D5FF3F] border border-[#D5FF3F]/30'
                      : 'text-[#F5F3EC] hover:bg-[#0B0D12]/60'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.route === '/studio' && (
                    <span className="text-xs text-[#9298A6]">Open Workspace</span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
