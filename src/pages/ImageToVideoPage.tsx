import { ArrowRight, Image as ImageIcon, Layers, ShieldCheck } from 'lucide-react';
import { SAMPLE_REFERENCE_IMAGE } from '../data/showcaseData';
import { ResilientImage } from '../components/ResilientImage';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface ImageToVideoPageProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

export function ImageToVideoPage({ onNavigate }: ImageToVideoPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-20">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch pb-14 border-b border-white/[0.08]">
        <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-[#9298A6]">
              <ImageIcon className="w-4 h-4 text-[#FF6B65]" />
              <span className="text-[#FF6B65] font-semibold">Creation Mode 02</span>
              <span aria-hidden="true">·</span>
              <span>JPG, PNG &amp; WebP Still Animation</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
              Give Your Favorite Images a Whole New Dimension.
            </h1>

            <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
              Bring product photography, landscapes, illustrations, and editorial frames into motion. Choose between neural open-weight Image-to-Video synthesis on ZeroGPU or instant, zero-upload browser <strong className="text-[#F5F3EC]">Photo Motion</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() =>
                onNavigate('/studio', {
                  mode: 'image-to-video',
                  preloadSampleImage: true,
                })
              }
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Try AI Image-to-Video</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigate('/studio', {
                  mode: 'photo-motion',
                  preloadSampleImage: true,
                })
              }
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 bg-[#151820] text-sm font-semibold text-[#F5F3EC] hover:border-white/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Try Local Photo Motion</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative rounded-2xl overflow-hidden border border-white/12 bg-[#151820] h-full min-h-[300px]">
            <ResilientImage
              src={SAMPLE_REFERENCE_IMAGE.src}
              alt="Titanium Chronograph sample reference still"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D12] via-[#0B0D12]/35 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 space-y-1.5">
              <p className="text-xs text-[#D5FF3F] font-medium">
                Sample Reference Frame · Available for 1-Click Test in Studio
              </p>
              <p className="text-xs sm:text-sm text-[#F5F3EC]">
                “{SAMPLE_REFERENCE_IMAGE.motionPrompt}”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Comparison: Generative AI vs Photo Motion */}
      <section className="space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-[#D5FF3F]">
            Two Distinct Engines, Clearly Labeled
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EC]">
            Generative Image-to-Video vs. Browser Photo Motion
          </h2>
          <p className="text-sm text-[#9298A6] leading-relaxed">
            We never disguise basic camera pans as generative AI. Pick the exact tool that fits your shot and privacy needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#D5FF3F] font-semibold">
                <ImageIcon className="w-4 h-4" />
                <span>Generative Neural Synthesis</span>
              </div>
              <h3 className="text-xl font-bold text-[#F5F3EC]">
                AI Image-to-Video (ZeroGPU)
              </h3>
              <p className="text-sm text-[#9298A6] leading-relaxed">
                Uses Lightricks LTX-Video Distilled to synthesize genuine subject movement—such as rippling water, drifting mist, moving vehicles, or wind in fabric—guided by your motion prompt.
              </p>
              <ul className="space-y-2 text-xs text-[#9298A6] pt-2 border-t border-white/[0.08]">
                <li>· Output: Genuine neural MP4 video (4s, 6s, 8s, or 10s at 24 FPS)</li>
                <li>· Processing: Transient upload to Hugging Face ZeroGPU</li>
                <li>· Availability: Subject to shared free community GPU queue</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate('/studio', {
                  mode: 'image-to-video',
                  preloadSampleImage: true,
                })
              }
              className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors cursor-pointer"
            >
              <span>Open AI Image-to-Video</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#FF6B65] font-semibold">
                <Layers className="w-4 h-4" />
                <span>Non-Generative Camera Animation</span>
              </div>
              <h3 className="text-xl font-bold text-[#F5F3EC]">
                Photo Motion (Browser Canvas)
              </h3>
              <p className="text-sm text-[#9298A6] leading-relaxed">
                Applies smooth 30 FPS anamorphic push-in, pull-back, horizon pan, and filmic vignette transitions directly to your photograph using HTML5 Canvas and MediaRecorder.
              </p>
              <ul className="space-y-2 text-xs text-[#9298A6] pt-2 border-t border-white/[0.08]">
                <li>· Output: Crisp 720p–1280p H.264 MP4 camera animation (4s, 6s, 8s, or 10s at 30 FPS)</li>
                <li>· Privacy: 100% local in-browser processing (zero server upload)</li>
                <li>· Availability: Instant, unlimited, works even when GPU queues are full</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigate('/studio', {
                  mode: 'photo-motion',
                  preloadSampleImage: true,
                })
              }
              className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F5F3EC] text-[#0B0D12] text-xs font-semibold hover:bg-white transition-colors cursor-pointer"
            >
              <span>Open Photo Motion</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Upload Privacy & Consent Trust Block */}
      <section className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 sm:p-9 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#F5F3EC]">
          <ShieldCheck className="w-5 h-5 text-[#D5FF3F] shrink-0" />
          <h2>Upload Validation, Privacy &amp; Portrait Consent</h2>
        </div>
        <p className="text-sm text-[#9298A6] leading-relaxed max-w-4xl">
          VidNova AI validates every uploaded file strictly for format (<span className="font-mono text-[#F5F3EC]">JPG, PNG, WebP</span>) and size (<span className="font-mono text-[#F5F3EC]">≤ 8 MB</span>). We never store uploaded images in permanent cloud storage. Before submitting any photograph containing a recognizable person to external AI processing, you must hold explicit permission from that individual.
        </p>
      </section>
    </div>
  );
}
