import { BrandLogo } from './BrandLogo';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface FooterProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const linkItem = (label: string, route: RoutePath, payload?: StudioLaunchPayload) => (
    <li>
      <a
        href={route}
        onClick={(e) => {
          e.preventDefault();
          onNavigate(route, payload);
        }}
        className="text-sm text-[#9298A6] hover:text-[#F5F3EC] transition-colors duration-150"
      >
        {label}
      </a>
    </li>
  );

  return (
    <footer className="border-t border-white/[0.08] bg-[#0B0D12] pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/[0.08]">
          <div className="md:col-span-5 space-y-4">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/');
              }}
              aria-label="VidNova AI Home"
              className="inline-block"
            >
              <BrandLogo size="md" />
            </a>
            <p className="text-sm text-[#F5F3EC] font-medium">
              Turn Your Imagination Into Motion.
            </p>
            <p className="text-sm text-[#9298A6] max-w-sm leading-relaxed">
              An open-architecture AI filmmaking &amp; motion studio combining local cinematography prompt direction, client-side Photo Motion, and free Hugging Face ZeroGPU synthesis.
            </p>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h2 className="text-xs font-semibold text-[#F5F3EC] tracking-wide">
              Creation
            </h2>
            <ul className="space-y-2.5">
              {linkItem('AI Studio', '/studio')}
              {linkItem('Text to Video', '/text-to-video')}
              {linkItem('Image to Video', '/image-to-video')}
              {linkItem('Explore Concepts', '/explore')}
            </ul>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h2 className="text-xs font-semibold text-[#F5F3EC] tracking-wide">
              Platform
            </h2>
            <ul className="space-y-2.5">
              {linkItem('How It Works', '/how-it-works')}
              {linkItem('FAQ', '/faq')}
              {linkItem('Contact', '/contact')}
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h2 className="text-xs font-semibold text-[#F5F3EC] tracking-wide">
              Legal &amp; Transparency
            </h2>
            <ul className="space-y-2.5">
              {linkItem('Privacy Policy', '/privacy')}
              {linkItem('Terms of Service', '/terms')}
            </ul>
            <p className="text-xs text-[#9298A6] pt-2 leading-relaxed">
              Zero paid APIs active · Open-weight LTX-Video inference via Hugging Face ZeroGPU.
            </p>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9298A6]">
          <p>© {new Date().getFullYear()} VidNova AI. Crafted for zero-cost creative filmmaking.</p>
          <p className="flex flex-wrap items-center gap-2">
            <span>Illustrative gallery stills are clearly labeled</span>
            <span aria-hidden="true">·</span>
            <span>No personal uploads retained</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
