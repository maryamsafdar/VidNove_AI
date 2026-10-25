import { useState } from 'react';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { FAQ_ITEMS } from '../data/showcaseData';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface FaqPageProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

const CATEGORIES = [
  'All Questions',
  'Pricing & Quotas',
  'AI Models',
  'Prompting',
  'Privacy & Uploads',
] as const;

export function FaqPage({ onNavigate }: FaqPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All Questions');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filtered = FAQ_ITEMS.filter(
    (item) => selectedCategory === 'All Questions' || item.category === selectedCategory
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      <div className="space-y-4 pb-8 border-b border-white/[0.08]">
        <p className="text-xs font-semibold text-[#D5FF3F]">
          Transparent Documentation &amp; Support
        </p>
        <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
          Frequently Asked Questions
        </h1>
        <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
          Clear, candid answers about zero-cost ZeroGPU video generation, quotas, Roman Urdu prompt enhancement, and upload privacy.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setOpenIndex(0);
              }}
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

      {/* Accessible Accordion List */}
      <div className="space-y-4">
        {filtered.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={item.question}
              className="rounded-2xl border border-white/[0.09] bg-[#151820] overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="space-y-1">
                  <span className="block text-xs text-[#FF6B65] font-medium">
                    {item.category}
                  </span>
                  <span className="block text-base sm:text-lg font-bold text-[#F5F3EC]">
                    {item.question}
                  </span>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-[#D5FF3F] shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#9298A6] shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="px-6 pb-6 pt-1 text-sm text-[#9298A6] leading-relaxed border-t border-white/[0.06]">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#F5F3EC]">
            Still have a question or feedback?
          </h2>
          <p className="text-xs sm:text-sm text-[#9298A6] mt-1">
            Reach out via our studio contact form or jump straight into AI Studio.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigate('/contact')}
            className="px-5 py-2.5 rounded-full border border-white/15 bg-[#0B0D12] text-xs font-semibold text-[#F5F3EC] hover:border-white/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Contact Studio
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/studio')}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Open AI Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
