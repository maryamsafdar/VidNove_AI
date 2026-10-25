import { ArrowRight, Film, Wand2 } from 'lucide-react';
import {
  ASPECT_RATIO_CONFIGS,
  SHOWCASE_ITEMS,
  STUDIO_PROMPT_EXAMPLES,
  VISUAL_STYLES,
} from '../data/showcaseData';
import { ResilientImage } from '../components/ResilientImage';
import { PromptAssistantInteractive } from '../components/PromptAssistantInteractive';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface TextToVideoPageProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

export function TextToVideoPage({ onNavigate }: TextToVideoPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-20">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch pb-14 border-b border-white/[0.08]">
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-[#9298A6]">
              <Film className="w-4 h-4 text-[#D5FF3F]" />
              <span className="text-[#D5FF3F] font-semibold">Creation Mode 01</span>
              <span aria-hidden="true">·</span>
              <span>Lightricks LTX-Video Distilled (ZeroGPU)</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
              Describe a Scene. Watch Your Imagination Come Alive.
            </h1>

            <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
              VidNova AI’s Text-to-Video workflow pairs a zero-cost bilingual cinematography builder with open-weight Diffusion Transformer (DiT) video synthesis on Hugging Face ZeroGPU.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/studio', { mode: 'text-to-video' })}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Launch Text to Video</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/how-it-works')}
              className="px-5 py-3.5 rounded-full border border-white/15 bg-[#151820] text-sm font-medium text-[#F5F3EC] hover:border-white/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              How ZeroGPU Quotas Work
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#151820] h-full min-h-[300px]">
            <ResilientImage
              src={SHOWCASE_ITEMS[4].imageSrc}
              alt="Illustrative anime coastal express concept frame"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/35 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 space-y-1.5">
              <p className="text-xs text-[#FF6B65] font-medium">
                Illustrative Style Reference · Theatrical Anime Preset
              </p>
              <p className="text-xs sm:text-sm text-[#F5F3EC] line-clamp-2">
                “{SHOWCASE_ITEMS[4].prompt}”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Prompt Anatomy Section */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-[#FF6B65]">
            01. Cinematography Prompt Structure
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EC]">
            Why Specific Camera &amp; Lighting Prompts Matter
          </h2>
          <p className="text-sm text-[#9298A6] leading-relaxed">
            Short one-word prompts leave temporal motion ambiguous. Specifying subject action, camera trajectory, and light direction produces cleaner, more coherent 2–4 second shots.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#151820] p-6 space-y-3">
            <p className="text-xs font-semibold text-[#9298A6]">
              Basic Unstructured Input
            </p>
            <p className="text-base font-medium text-[#F5F3EC]">
              “A train going over water at sunset”
            </p>
            <p className="text-xs text-[#9298A6] leading-relaxed">
              Leaves lens focal length, camera movement, lighting contrast, and visual medium undecided.
            </p>
          </div>

          <div className="rounded-2xl border border-[#D5FF3F]/35 bg-[#151820] p-6 space-y-3">
            <p className="text-xs font-semibold text-[#D5FF3F] flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              Structured VidNova Director Prompt
            </p>
            <p className="text-sm text-[#F5F3EC] leading-relaxed">
              “Hand-painted theatrical anime cinema shot of a vintage express train crossing a sunlit ocean viaduct at sunset, billowing steam trailing in the wind beneath towering coral clouds, smooth lateral tracking shot.”
            </p>
            <button
              type="button"
              onClick={() =>
                onNavigate('/studio', {
                  mode: 'text-to-video',
                  prompt: SHOWCASE_ITEMS[4].prompt,
                  style: 'anime',
                  aspectRatio: '16:9',
                })
              }
              className="text-xs font-semibold text-[#D5FF3F] hover:underline cursor-pointer"
            >
              Test This Prompt in AI Studio →
            </button>
          </div>
        </div>
      </section>

      {/* Bilingual Clickable Starters + Output Specs */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.09] bg-[#151820] p-6 sm:p-8 space-y-5">
          <h2 className="text-xl font-display font-bold text-[#F5F3EC]">
            Ready-to-Run English &amp; Roman Urdu Prompts
          </h2>
          <div className="divide-y divide-white/[0.08]">
            {STUDIO_PROMPT_EXAMPLES.map((item) => (
              <div
                key={item.label}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#9298A6]">
                    <span className="text-[#F5F3EC] font-semibold">{item.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.language}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.aspectRatio}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#9298A6]">{item.prompt}</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('/studio', {
                      mode: 'text-to-video',
                      prompt: item.prompt,
                      style: item.style,
                      aspectRatio: item.aspectRatio,
                    })
                  }
                  className="px-4 py-2 rounded-full bg-[#0B0D12] border border-white/15 text-xs font-semibold text-[#D5FF3F] hover:border-[#D5FF3F] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center cursor-pointer"
                >
                  Open in Studio
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/[0.09] bg-[#151820] p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-display font-bold text-[#F5F3EC]">
            Supported Frame Geometries
          </h2>
          <div className="divide-y divide-white/[0.08]">
            {ASPECT_RATIO_CONFIGS.map((ar) => (
              <div key={ar.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono font-semibold text-[#F5F3EC] tabular-nums">
                    {ar.label}
                  </span>
                  <span className="text-[#9298A6] ml-2.5 text-xs">{ar.usage}</span>
                </div>
                <span className="font-mono text-xs text-[#9298A6] tabular-nums">
                  {ar.resolution}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/[0.08] space-y-2">
            <h3 className="text-sm font-semibold text-[#F5F3EC]">
              6 Optical Style Modifiers
            </h3>
            <p className="text-xs text-[#9298A6] leading-relaxed">
              {VISUAL_STYLES.map((s) => s.name).join(' · ')}
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Assistant */}
      <PromptAssistantInteractive
        onApplyPrompt={(enhanced) =>
          onNavigate('/studio', {
            mode: 'text-to-video',
            prompt: enhanced,
          })
        }
      />
    </div>
  );
}
