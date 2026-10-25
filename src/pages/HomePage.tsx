import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Download,
  Film,
  Image as ImageIcon,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  HERO_ARTWORK,
  SAMPLE_REFERENCE_IMAGE,
  SHOWCASE_ITEMS,
} from '../data/showcaseData';
import { ResilientImage } from '../components/ResilientImage';
import { InspirationGallery } from '../components/InspirationGallery';
import { PromptAssistantInteractive } from '../components/PromptAssistantInteractive';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface HomePageProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [inspectHeroRecipe, setInspectHeroRecipe] = useState(false);

  return (
    <div className="space-y-24 sm:space-y-32 pb-20">
      {/* B. Cinematic Hero Section */}
      <section className="relative pt-8 sm:pt-12 lg:pt-16 cinema-grid-bg border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Column: Editorial Proposition */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#9298A6]">
                  <span className="text-[#FF6B65] font-semibold">
                    Open-Weight AI Filmmaking Studio
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Zero-Cost Creative Pipeline</span>
                </div>

                <h1 className="font-display font-bold tracking-tight text-[#F5F3EC] text-[clamp(2.4rem,4.6vw,4.15rem)] leading-[1.05]">
                  Your Imagination.{' '}
                  <span className="text-[#D5FF3F]">Now in Motion.</span>
                </h1>

                <p className="text-base sm:text-lg text-[#9298A6] leading-relaxed max-w-xl">
                  Transform your ideas and images into extraordinary videos with the power of AI. Craft structured cinematography scripts in English or Roman Urdu, animate photography, and synthesize real motion on open-weight GPU infrastructure.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('/studio')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-semibold hover:bg-[#E2FF70] transition-transform duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Start Creating</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('/explore')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 bg-[#151820] text-[#F5F3EC] text-sm font-semibold hover:border-[#F5F3EC]/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Explore the Studio</span>
                    <ArrowUpRight className="w-4 h-4 text-[#9298A6] shrink-0" />
                  </button>
                </div>
              </div>

              {/* Quick Launch Scene Starters */}
              <div className="pt-6 border-t border-white/[0.08] space-y-3">
                <p className="text-xs font-medium text-[#9298A6]">
                  Launch AI Studio with a ready-to-shoot scene prompt:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      label: 'Highland Glacial Aerial',
                      prompt: SHOWCASE_ITEMS[0].prompt,
                    },
                    {
                      label: 'Rain-Slicked Monorail',
                      prompt: SHOWCASE_ITEMS[1].prompt,
                    },
                    {
                      label: 'Coastal Anime Express',
                      prompt: SHOWCASE_ITEMS[4].prompt,
                    },
                  ].map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() =>
                        onNavigate('/studio', {
                          mode: 'text-to-video',
                          prompt: starter.prompt,
                        })
                      }
                      className="px-3.5 py-1.5 rounded-full bg-[#151820] border border-white/10 text-xs font-medium text-[#F5F3EC] hover:border-[#D5FF3F]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {starter.label} →
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Cinematic Anamorphic Visual Showcase */}
            <div className="lg:col-span-6 flex">
              <div className="relative w-full rounded-2xl overflow-hidden border border-white/[0.12] bg-[#151820] min-h-[340px] sm:min-h-[420px] lg:h-full flex flex-col justify-between">
                <ResilientImage
                  src={HERO_ARTWORK.src}
                  alt={HERO_ARTWORK.alt}
                  priority
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/30 to-[#0B0D12]/25" />

                {/* Top Anamorphic Frame Bar */}
                <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between gap-4">
                  <span className="text-xs font-mono tabular-nums text-[#F5F3EC]/85 bg-[#0B0D12]/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                    ANAMORPHIC 2.39:1 · ILLUSTRATIVE STILL
                  </span>

                  <button
                    type="button"
                    onClick={() => setInspectHeroRecipe((v) => !v)}
                    className="px-3.5 py-1.5 rounded-full bg-[#0B0D12]/80 backdrop-blur-md border border-white/15 text-xs font-medium text-[#F5F3EC] hover:border-[#D5FF3F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {inspectHeroRecipe ? 'Hide Camera Notes' : 'View Prompt Recipe'}
                  </button>
                </div>

                {/* Bottom Floating Story Card */}
                <div className="relative z-10 p-5 sm:p-6 space-y-3">
                  {inspectHeroRecipe ? (
                    <div className="rounded-xl bg-[#0B0D12]/90 backdrop-blur-md border border-white/15 p-4 space-y-2.5">
                      <p className="text-xs text-[#D5FF3F] font-semibold">
                        Scene Prompt Loaded Into LTX-Video Pipeline
                      </p>
                      <p className="text-xs sm:text-sm text-[#F5F3EC] leading-relaxed">
                        “{HERO_ARTWORK.prompt}”
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-[#9298A6]">
                          Optics: 65mm Prime · Chiaroscuro Twilight
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate('/studio', {
                              mode: 'text-to-video',
                              prompt: HERO_ARTWORK.prompt,
                              style: 'anamorphic',
                              aspectRatio: '16:9',
                            })
                          }
                          className="text-xs font-semibold text-[#D5FF3F] hover:underline cursor-pointer"
                        >
                          Run in Studio →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                      <div>
                        <p className="text-xs text-[#FF6B65] font-medium mb-1">
                          Editorial Concept Frame · Ridge Twilight
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[#F5F3EC]">
                          65mm Cinema Composition · Ready to Test in Studio
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate('/studio', {
                            mode: 'text-to-video',
                            prompt: HERO_ARTWORK.prompt,
                            style: 'anamorphic',
                            aspectRatio: '16:9',
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F5F3EC] text-[#0B0D12] text-xs font-semibold hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Shoot Similar Scene</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Specification Row Below Hero Split */}
          <div className="mt-12 pt-8 border-t border-white/[0.08] grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <div>
              <p className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EC] tabular-nums">
                LTX-Video DiT
              </p>
              <p className="text-xs sm:text-sm text-[#9298A6] mt-1">
                Open-weight Text &amp; Image-to-Video via Hugging Face ZeroGPU
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EC] tabular-nums">
                EN + Roman Urdu
              </p>
              <p className="text-xs sm:text-sm text-[#9298A6] mt-1">
                Offline local cinematography prompt builder with zero API cost
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EC] tabular-nums">
                30 FPS Canvas
              </p>
              <p className="text-xs sm:text-sm text-[#9298A6] mt-1">
                Instant local Photo Motion camera animation with zero cloud upload
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-display font-bold text-[#D5FF3F] tabular-nums">
                Rs. 0 / $0.00
              </p>
              <p className="text-xs sm:text-sm text-[#9298A6] mt-1">
                No paid subscriptions, no credit cards, and honest queue status
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* D. Two Main Creation Modes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12 space-y-3">
          <p className="text-xs font-semibold text-[#FF6B65]">
            01. Dual Production Workflows
          </p>
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EC]">
            Two Distinct Ways to Direct Motion
          </h2>
          <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
            Start from a blank script with open-weight Text-to-Video synthesis, or bring your own still photography into motion.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Mode 1: Text to Video */}
          <div className="lg:col-span-6 rounded-2xl border border-white/[0.09] bg-[#151820] overflow-hidden flex flex-col justify-between">
            <div className="relative h-60 sm:h-64 overflow-hidden border-b border-white/[0.08]">
              <ResilientImage
                src={SHOWCASE_ITEMS[0].imageSrc}
                alt="Illustrative landscape concept for Text to Video"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#151820] via-[#151820]/30 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-[#F5F3EC]/90">
                <span>Prompt-Driven DiT Synthesis</span>
                <span className="font-mono tabular-nums text-[#D5FF3F]">16:9 · 9:16 · 1:1 · 4:3</span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-[#9298A6]">
                  <Film className="w-4 h-4 text-[#D5FF3F]" />
                  <span>Mode 01 · Generative AI Synthesis</span>
                </div>
                <h3 className="text-2xl font-display font-bold text-[#F5F3EC]">
                  Text to Video
                </h3>
                <p className="text-base text-[#F5F3EC]/90 font-medium">
                  Describe a scene. Watch your imagination come alive.
                </p>
                <p className="text-sm text-[#9298A6] leading-relaxed">
                  Write a natural prompt in English or Roman Urdu, enrich camera movement and lighting with our local Prompt Assistant, and synthesize real MP4 clips via Lightricks LTX-Video on Hugging Face ZeroGPU.
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/studio', { mode: 'text-to-video' })}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs sm:text-sm font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Open Text to Video</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/text-to-video')}
                  className="text-xs sm:text-sm font-medium text-[#9298A6] hover:text-[#F5F3EC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Text Workflow →
                </button>
              </div>
            </div>
          </div>

          {/* Mode 2: Image to Video */}
          <div className="lg:col-span-6 rounded-2xl border border-white/[0.09] bg-[#151820] overflow-hidden flex flex-col justify-between">
            <div className="relative h-60 sm:h-64 overflow-hidden border-b border-white/[0.08]">
              <ResilientImage
                src={SAMPLE_REFERENCE_IMAGE.src}
                alt="Illustrative product still for Image to Video"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#151820] via-[#151820]/30 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-xs text-[#F5F3EC]/90">
                <span>JPG · PNG · WebP (Up to 8 MB)</span>
                <span className="text-[#FF6B65] font-medium">ZeroGPU AI + Browser Photo Motion</span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-[#9298A6]">
                  <ImageIcon className="w-4 h-4 text-[#FF6B65]" />
                  <span>Mode 02 · Still Frame Animation</span>
                </div>
                <h3 className="text-2xl font-display font-bold text-[#F5F3EC]">
                  Image to Video
                </h3>
                <p className="text-base text-[#F5F3EC]/90 font-medium">
                  Give your favorite images a whole new dimension.
                </p>
                <p className="text-sm text-[#9298A6] leading-relaxed">
                  Upload product shots, landscapes, or artwork to synthesize neural motion via LTX-Video ZeroGPU—or use our built-in non-generative <strong className="text-[#F5F3EC]">Photo Motion</strong> camera rig for instant, private browser animation.
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('/studio', {
                      mode: 'image-to-video',
                      preloadSampleImage: true,
                    })
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5F3EC] text-[#0B0D12] text-xs sm:text-sm font-semibold hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Animate an Image</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/image-to-video')}
                  className="text-xs sm:text-sm font-medium text-[#9298A6] hover:text-[#F5F3EC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Image Workflow →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. Creative Inspiration Gallery */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold text-[#FF6B65]">
              02. Editorial Inspiration Archive
            </p>
            <h2 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EC]">
              Visual Directions &amp; Shooting Concepts
            </h2>
            <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
              Explore curated art-direction concepts across six genres. All gallery frames below are illustrative concept stills—click any frame to load its exact cinematography prompt into the live AI Studio.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/explore')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-[#151820] text-xs sm:text-sm font-medium text-[#F5F3EC] hover:border-[#D5FF3F]/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start md:self-auto"
          >
            <span>Open Full Concept Archive</span>
            <ArrowUpRight className="w-4 h-4 text-[#D5FF3F]" />
          </button>
        </div>

        <InspirationGallery
          onTryInStudio={(payload) => onNavigate('/studio', payload)}
        />
      </section>

      {/* E. How It Works — Three-Step Visual Journey */}
      <section className="border-y border-white/[0.08] bg-[#151820]/55 py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold text-[#D5FF3F]">
                03. Production Pipeline
              </p>
              <h2 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EC]">
                From Raw Concept to Motion in Three Steps
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/how-it-works')}
              className="text-sm font-medium text-[#9298A6] hover:text-[#F5F3EC] transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start md:self-auto"
            >
              Read Full Technical Architecture →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0B0D12] p-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-[#D5FF3F] tabular-nums">
                  01. Imagine
                </span>
                <Wand2 className="w-5 h-5 text-[#9298A6]" />
              </div>
              <h3 className="text-xl font-bold text-[#F5F3EC]">
                Write a Prompt or Upload an Image
              </h3>
              <p className="text-sm text-[#9298A6] leading-relaxed">
                Draft a scene description in English or Roman Urdu—or drop a validated JPG, PNG, or WebP still frame. Use our offline Prompt Assistant to layer camera optics and lighting.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0B0D12] p-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-[#FF6B65] tabular-nums">
                  02. Create
                </span>
                <Sliders className="w-5 h-5 text-[#9298A6]" />
              </div>
              <h3 className="text-xl font-bold text-[#F5F3EC]">
                Synthesize via Open-Weight AI
              </h3>
              <p className="text-sm text-[#9298A6] leading-relaxed">
                Select aspect ratio, visual style, and clip duration. Execute real DiT video generation on free Hugging Face ZeroGPU—or choose local Photo Motion for instant browser camera pans.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#0B0D12] p-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-[#F5F3EC] tabular-nums">
                  03. Share
                </span>
                <Download className="w-5 h-5 text-[#9298A6]" />
              </div>
              <h3 className="text-xl font-bold text-[#F5F3EC]">
                Preview &amp; Download Your Creation
              </h3>
              <p className="text-sm text-[#9298A6] leading-relaxed">
                Inspect your completed video directly inside the cinema monitor, review exact generation seed and frame resolution, and save your MP4 creation with one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* F. AI Prompt Assistant Interactive Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10 space-y-3">
          <p className="text-xs font-semibold text-[#FF6B65]">
            04. Bilingual Director’s Assistant
          </p>
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EC]">
            Turn One Sentence Into Cinema Direction
          </h2>
          <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
            Open-weight video models respond dramatically better when camera movement, lens focal length, and lighting contrast are explicit. Try our zero-cost local prompt builder right here.
          </p>
        </div>

        <PromptAssistantInteractive
          onApplyPrompt={(enhancedPrompt) =>
            onNavigate('/studio', {
              mode: 'text-to-video',
              prompt: enhancedPrompt,
            })
          }
        />
      </section>

      {/* G. Honest Features & Capability Matrix */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12 space-y-3">
          <p className="text-xs font-semibold text-[#D5FF3F]">
            05. Verified Capabilities &amp; Transparency
          </p>
          <h2 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EC]">
            Built for Creative Control, Honest About Limits
          </h2>
          <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
            Every feature listed as active runs today at zero cost. Capabilities constrained by free community GPU hardware are labeled transparently.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 rounded-2xl border border-white/[0.09] bg-[#151820] p-6 sm:p-8">
            <h3 className="text-lg font-bold text-[#F5F3EC] pb-4 border-b border-white/[0.08]">
              Available Today in VidNova AI Studio
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
              <div>
                <p className="text-sm font-semibold text-[#F5F3EC]">
                  Text to Video (ZeroGPU)
                </p>
                <p className="text-xs text-[#9298A6] mt-1 leading-relaxed">
                  Real 2–4 second MP4 video synthesis powered by Lightricks LTX-Video Distilled when free Hugging Face ZeroGPU queue slots are open.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F5F3EC]">
                  Image to Video + Photo Motion
                </p>
                <p className="text-xs text-[#9298A6] mt-1 leading-relaxed">
                  Validate JPG, PNG, and WebP stills for ZeroGPU neural animation, plus instant local HTML5 Canvas camera movement export.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F5F3EC]">
                  6 Curated Cinematography Styles
                </p>
                <p className="text-xs text-[#9298A6] mt-1 leading-relaxed">
                  Anamorphic 65mm, Editorial 35mm, Architectural Noir, Theatrical Anime, Macro Commercial, and Pure Daylight presets.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F5F3EC]">
                  Local Prompt Enhancement
                </p>
                <p className="text-xs text-[#9298A6] mt-1 leading-relaxed">
                  Structured cinematography builder supporting English and Roman Urdu vocabulary with zero paid LLM API dependencies.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F5F3EC]">
                  Cinema Monitor &amp; Direct Download
                </p>
                <p className="text-xs text-[#9298A6] mt-1 leading-relaxed">
                  Native video preview with frame resolution, seed inspection, session history, and one-click MP4 download for completed AI videos.
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#F5F3EC]">
                  Responsive Mobile Studio
                </p>
                <p className="text-xs text-[#9298A6] mt-1 leading-relaxed">
                  Touch-friendly controls, accessible keyboard focus states, and full functionality from 320px phones to 1440px+ desktop displays.
                </p>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 rounded-2xl border border-white/[0.09] bg-[#151820] p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#FF6B65] font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>Roadmap &amp; Free-Tier Constraints</span>
              </div>
              <h3 className="text-lg font-bold text-[#F5F3EC]">
                What Is Not Active Yet
              </h3>
              <ul className="space-y-3 text-xs text-[#9298A6] leading-relaxed">
                <li className="pb-3 border-b border-white/[0.06]">
                  <strong className="text-[#F5F3EC]">4K / 60-Second Clips (Unavailable):</strong>{' '}
                  Free community ZeroGPU slices cap single-pass generation to compact resolutions (up to 768px) and 2–4 second clips.
                </li>
                <li className="pb-3 border-b border-white/[0.06]">
                  <strong className="text-[#F5F3EC]">Synchronized AI Foley Audio (Planned):</strong>{' '}
                  Current open-weight LTX-Video outputs silent motion picture streams.
                </li>
                <li>
                  <strong className="text-[#F5F3EC]">Cloud Project Storage (Intentional):</strong>{' '}
                  Creations stay private in your current browser session; download clips you wish to keep.
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('/faq')}
              className="text-xs font-semibold text-[#D5FF3F] hover:underline self-start cursor-pointer"
            >
              Read Quota &amp; Privacy FAQ →
            </button>
          </div>
        </div>
      </section>

      {/* H. Final CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl border border-white/[0.12] bg-[#151820] px-6 py-16 sm:px-14 sm:py-20 overflow-hidden text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[220px] rounded-full bg-[#D5FF3F]/10 blur-3xl"
          />
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <p className="text-xs font-semibold text-[#D5FF3F]">
              Zero Cost · No Account Required · Ready Now
            </p>
            <h2 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
              Every Great Story Starts With an Idea.
            </h2>
            <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
              Step into the VidNova AI Studio to craft a cinematic prompt, animate still photography, or synthesize open-weight AI motion.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/studio')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm sm:text-base font-bold hover:bg-[#E2FF70] transition-transform duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Open AI Studio</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
