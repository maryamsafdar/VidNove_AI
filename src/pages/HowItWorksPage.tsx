import { ArrowRight, Cpu, Download, Globe, Shield, Wand2 } from 'lucide-react';
import type { RoutePath, StudioLaunchPayload } from '../types/studio';

interface HowItWorksPageProps {
  onNavigate: (route: RoutePath, payload?: StudioLaunchPayload) => void;
}

export function HowItWorksPage({ onNavigate }: HowItWorksPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-20">
      <section className="max-w-3xl space-y-4 pb-10 border-b border-white/[0.08]">
        <p className="text-xs font-semibold text-[#D5FF3F]">
          Open Filmmaking Architecture · Zero-Cost Pipeline
        </p>
        <h1 className="text-3xl sm:text-5xl font-display font-bold text-[#F5F3EC] tracking-tight">
          How VidNova AI Turns Ideas Into Motion for Rs. 0
        </h1>
        <p className="text-sm sm:text-base text-[#9298A6] leading-relaxed">
          VidNova AI is engineered around open-weight research models, client-side cinematography tooling, and transparent free community GPU execution—without subscriptions or hidden API billing.
        </p>
      </section>

      {/* 3-Step Visual Journey */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-[#D5FF3F] tabular-nums">
              Step 01 · Imagine
            </span>
            <Wand2 className="w-5 h-5 text-[#9298A6]" />
          </div>
          <h2 className="text-xl font-bold text-[#F5F3EC]">
            Direct the Scene Locally
          </h2>
          <p className="text-sm text-[#9298A6] leading-relaxed">
            Write a prompt in English or Roman Urdu, or drag-and-drop a validated JPG, PNG, or WebP still frame. Our offline Prompt Assistant enriches lens focal length, camera movement, lighting contrast, and mood instantaneously in your browser.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-[#FF6B65] tabular-nums">
              Step 02 · Create
            </span>
            <Cpu className="w-5 h-5 text-[#9298A6]" />
          </div>
          <h2 className="text-xl font-bold text-[#F5F3EC]">
            Execute on ZeroGPU or Canvas
          </h2>
          <p className="text-sm text-[#9298A6] leading-relaxed">
            For generative Text-to-Video and Image-to-Video, VidNova AI dispatches your request to Lightricks LTX-Video Distilled running on Hugging Face ZeroGPU. For instant non-generative camera pans on photos, Photo Motion renders locally via Web Canvas.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold text-[#F5F3EC] tabular-nums">
              Step 03 · Share
            </span>
            <Download className="w-5 h-5 text-[#9298A6]" />
          </div>
          <h2 className="text-xl font-bold text-[#F5F3EC]">
            Preview &amp; Save Genuine Video
          </h2>
          <p className="text-sm text-[#9298A6] leading-relaxed">
            Play your newly synthesized clip directly inside the Cinema Output Monitor, verify exact frame dimensions and seed numbers, and download the MP4 file to your device.
          </p>
        </div>
      </section>

      {/* Open-Source Model & Quota Transparency */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.09] bg-[#151820] p-7 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs text-[#D5FF3F] font-semibold">
            <Globe className="w-4 h-4" />
            <span>Open-Source Stack Specification</span>
          </div>
          <h2 className="text-2xl font-display font-bold text-[#F5F3EC]">
            Under the Hood
          </h2>

          <div className="divide-y divide-white/[0.08] text-sm">
            <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#9298A6]">Generative Video Model</span>
              <span className="font-medium text-[#F5F3EC]">
                Lightricks / LTX-Video Distilled (DiT Architecture)
              </span>
            </div>
            <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#9298A6]">Compute Infrastructure</span>
              <span className="font-medium text-[#F5F3EC]">
                Hugging Face ZeroGPU (Dynamic Shared GPU Slices)
              </span>
            </div>
            <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#9298A6]">Model Codebase &amp; Weights</span>
              <span className="font-medium text-[#F5F3EC]">
                Apache-2.0 Codebase · LTX-Video Open Weights License
              </span>
            </div>
            <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#9298A6]">Prompt Assistant Engine</span>
              <span className="font-medium text-[#F5F3EC]">
                Deterministic Bilingual Rule Lexicon (EN + Roman Urdu)
              </span>
            </div>
            <div className="py-3.5 flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#9298A6]">Photo Motion Renderer</span>
              <span className="font-medium text-[#F5F3EC]">
                HTML5 2D Canvas + Browser MediaRecorder (30 FPS)
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/[0.09] bg-[#151820] p-7 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs text-[#FF6B65] font-semibold">
            <Shield className="w-4 h-4" />
            <span>Our Honesty Pledge</span>
          </div>
          <h2 className="text-xl font-display font-bold text-[#F5F3EC]">
            Zero Fake Demos, Zero Hidden Costs
          </h2>
          <p className="text-sm text-[#9298A6] leading-relaxed">
            Many AI websites display pre-rendered studio reels or simulated progress bars when servers are busy. VidNova AI adheres to strict engineering transparency:
          </p>
          <ul className="space-y-2.5 text-xs text-[#9298A6] leading-relaxed">
            <li>· Showcase stills are explicitly marked as illustrative art-direction concepts.</li>
            <li>· Every video shown in the Studio Monitor is genuinely rendered from your prompt or uploaded frame.</li>
            <li>· When shared free ZeroGPU quotas are temporarily full, we tell you immediately and never fake completion.</li>
          </ul>
          <button
            type="button"
            onClick={() => onNavigate('/studio')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs sm:text-sm font-semibold hover:bg-[#E2FF70] transition-colors cursor-pointer"
          >
            <span>Open AI Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
