import { useEffect, useState } from 'react';
import { ArrowUpRight, Maximize2, X } from 'lucide-react';
import { SHOWCASE_ITEMS } from '../data/showcaseData';
import { ResilientImage } from './ResilientImage';
import type { ShowcaseItem, StudioLaunchPayload } from '../types/studio';

const CATEGORIES = [
  'All Concepts',
  'Landscapes',
  'Futuristic Cities',
  'Dreamlike Nature',
  'Commercials',
  'Anime Cinema',
  'Portraits',
] as const;

interface InspirationGalleryProps {
  onTryInStudio: (payload: StudioLaunchPayload) => void;
  searchQuery?: string;
}

export function InspirationGallery({
  onTryInStudio,
  searchQuery = '',
}: InspirationGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All Concepts');
  const [activeLightbox, setActiveLightbox] = useState<ShowcaseItem | null>(null);

  useEffect(() => {
    if (!activeLightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveLightbox(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeLightbox]);

  const filteredItems = SHOWCASE_ITEMS.filter((item) => {
    const matchesCat =
      selectedCategory === 'All Concepts' || item.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.prompt.toLowerCase().includes(q) ||
      (item.romanUrduHint && item.romanUrduHint.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div>
      {/* Interactive Category Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div
          role="tablist"
          aria-label="Filter creative concepts"
          className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0"
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#D5FF3F] text-[#0B0D12] font-semibold'
                    : 'bg-[#151820] text-[#9298A6] hover:text-[#F5F3EC] border border-white/[0.08]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#9298A6]">
          Illustrative Art-Direction Stills · Click any concept to inspect prompt or run in AI Studio
        </p>
      </div>

      {/* Asymmetric Editorial Bento Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#151820] p-12 text-center">
          <p className="text-base font-medium text-[#F5F3EC] mb-2">
            No creative concepts matched your filter.
          </p>
          <button
            type="button"
            onClick={() => setSelectedCategory('All Concepts')}
            className="mt-2 px-4 py-2 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold cursor-pointer"
          >
            Reset Concept Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {filteredItems.map((item, idx) => {
            // Create asymmetric editorial rhythm across rows
            const colSpanClass =
              filteredItems.length === 1
                ? 'md:col-span-12'
                : idx % 4 === 0 || idx % 4 === 3
                ? 'md:col-span-7'
                : 'md:col-span-5';

            return (
              <article
                key={item.id}
                className={`${colSpanClass} group relative rounded-2xl overflow-hidden border border-white/[0.09] bg-[#151820] flex flex-col justify-between min-h-[340px] sm:min-h-[390px]`}
              >
                <div className="relative flex-1 overflow-hidden">
                  <ResilientImage
                    src={item.imageSrc}
                    alt={`${item.title} — Illustrative cinematography concept`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    fallbackLabel={item.title}
                  />
                  {/* Measured Contrast Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/45 to-transparent" />

                  <button
                    type="button"
                    onClick={() => setActiveLightbox(item)}
                    aria-label={`Inspect ${item.title}`}
                    className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0B0D12]/80 backdrop-blur-md border border-white/15 text-xs font-medium text-[#F5F3EC] hover:border-[#D5FF3F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#D5FF3F]" />
                    <span>Inspect Concept</span>
                  </button>

                  <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 space-y-2.5">
                    {/* Unboxed inline metadata per Zero-Pill Discipline */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#9298A6]">
                      <span className="text-[#FF6B65] font-medium">{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Illustrative Concept</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.aspectRatio}</span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-[#F5F3EC]">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-[#F5F3EC]/85 line-clamp-2 max-w-2xl">
                      {item.prompt}
                    </p>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-[#9298A6]">{item.cameraNote}</span>

                      <button
                        type="button"
                        onClick={() =>
                          onTryInStudio({
                            mode: 'text-to-video',
                            prompt: item.prompt,
                            style: item.style,
                            aspectRatio: item.aspectRatio,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Load Prompt in Studio</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox Concept Inspector Modal */}
      {activeLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-concept-title"
          className="fixed inset-0 z-50 bg-[#0B0D12]/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveLightbox(null)}
        >
          <div
            className="max-w-4xl w-full rounded-2xl border border-white/15 bg-[#151820] overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9298A6]">
                <span className="text-[#FF6B65] font-medium">{activeLightbox.category}</span>
                <span aria-hidden="true">·</span>
                <span>Illustrative Art-Direction Reference (Not Pre-Recorded Platform Video)</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveLightbox(null)}
                aria-label="Close inspector"
                className="w-9 h-9 rounded-full bg-[#0B0D12] border border-white/15 flex items-center justify-center text-[#F5F3EC] hover:border-[#D5FF3F] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-7 bg-[#0B0D12] flex items-center justify-center">
                <ResilientImage
                  src={activeLightbox.imageSrc}
                  alt={activeLightbox.title}
                  className="w-full max-h-[460px] object-cover"
                />
              </div>

              <div className="lg:col-span-5 p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <h3
                    id="lightbox-concept-title"
                    className="text-2xl font-bold text-[#F5F3EC]"
                  >
                    {activeLightbox.title}
                  </h3>

                  <div className="space-y-2 text-xs text-[#9298A6] border-y border-white/[0.08] py-3">
                    <p>
                      <span className="text-[#F5F3EC] font-medium">Camera Rig:</span>{' '}
                      {activeLightbox.cameraNote}
                    </p>
                    <p>
                      <span className="text-[#F5F3EC] font-medium">Lighting:</span>{' '}
                      {activeLightbox.lightingNote}
                    </p>
                    <p>
                      <span className="text-[#F5F3EC] font-medium">Target Frame:</span>{' '}
                      <span className="font-mono tabular-nums">{activeLightbox.aspectRatio}</span>
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-[#D5FF3F] mb-1.5">
                      Director’s Motion Prompt
                    </p>
                    <p className="text-sm text-[#F5F3EC] leading-relaxed">
                      {activeLightbox.prompt}
                    </p>
                  </div>

                  {activeLightbox.romanUrduHint && (
                    <div>
                      <p className="text-xs font-semibold text-[#9298A6] mb-1">
                        Roman Urdu Starter Equivalent
                      </p>
                      <p className="text-xs text-[#F5F3EC]/80 italic">
                        “{activeLightbox.romanUrduHint}”
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const item = activeLightbox;
                    setActiveLightbox(null);
                    onTryInStudio({
                      mode: 'text-to-video',
                      prompt: item.prompt,
                      style: item.style,
                      aspectRatio: item.aspectRatio,
                    });
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-semibold hover:bg-[#E2FF70] transition-colors cursor-pointer"
                >
                  <span>Generate From This Prompt in AI Studio</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
