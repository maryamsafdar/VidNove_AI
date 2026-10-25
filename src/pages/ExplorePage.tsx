import { useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { InspirationGallery } from '../components/InspirationGallery';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface ExplorePageProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

export function ExplorePage({ onNavigate }: ExplorePageProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end pb-10 border-b border-white/[0.08]">
        <div className="lg:col-span-7 space-y-4">
          <p className="text-xs font-semibold text-[#FF6B65]">
            Editorial Concept Archive · Illustrative Stills
          </p>
          <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
            Explore Cinematography Directions
          </h1>
          <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed max-w-2xl">
            Study camera lenses, lighting setups, and motion prompts across six visual genres. All visuals below are illustrative reference stills—never passed off as pre-rendered video. Select any concept to load its shooting script into AI Studio.
          </p>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <label htmlFor="explore-search" className="block text-xs font-medium text-[#9298A6]">
            Filter by keyword, genre, or Roman Urdu hint (e.g. barish, samandar, anime)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-[#9298A6] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="explore-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scenes, lenses, lighting..."
              className="w-full rounded-full bg-[#151820] border border-white/15 pl-11 pr-10 py-3 text-sm text-[#F5F3EC] placeholder-[#9298A6]/60 focus:border-[#D5FF3F] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9298A6] hover:text-[#F5F3EC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <InspirationGallery
        searchQuery={searchQuery}
        onTryInStudio={(payload) => onNavigate('/studio', payload)}
      />

      <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="text-xl font-display font-bold text-[#F5F3EC]">
            Have an Original Scene in Mind?
          </h2>
          <p className="text-sm text-[#9298A6]">
            Write your own prompt from scratch or build one step-by-step in AI Studio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/studio')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Open Blank Studio</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
