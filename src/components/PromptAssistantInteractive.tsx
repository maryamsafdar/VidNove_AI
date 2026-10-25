import { useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, SlidersHorizontal, Wand2 } from 'lucide-react';
import {
  CAMERA_MOVEMENT_OPTIONS,
  ENVIRONMENT_OPTIONS,
  LIGHTING_OPTIONS,
  MOOD_OPTIONS,
  VISUAL_STYLE_OPTIONS,
  enhancePromptLocally,
} from '../utils/promptEnhancer';

interface PromptAssistantInteractiveProps {
  initialIdea?: string;
  compact?: boolean;
  onApplyPrompt: (enhancedPrompt: string, negativePrompt: string) => void;
  applyButtonLabel?: string;
}

const STARTER_IDEAS = [
  {
    label: 'Misty Volcanic Coast (EN)',
    text: 'A lone figure walking along black volcanic sand as waves crash in morning mist',
  },
  {
    label: 'Barish Aur Pahari (Roman Urdu)',
    text: 'barish ke baad pahari par dhund aur shaam ki suraj ki roshni',
  },
  {
    label: 'Monorail After Rain (EN)',
    text: 'A glass monorail arriving at a modernist concrete station at dusk',
  },
  {
    label: 'Samandar Aur Train (Roman Urdu)',
    text: 'samandar ke upar shaam ke waqt train ka safar aur tez hawa',
  },
];

export function PromptAssistantInteractive({
  initialIdea = 'barish ke baad pahari par dhund aur shaam ki suraj ki roshni',
  compact = false,
  onApplyPrompt,
  applyButtonLabel = 'Use Prompt in AI Studio',
}: PromptAssistantInteractiveProps) {
  const [rawIdea, setRawIdea] = useState(initialIdea);
  const [cameraMovement, setCameraMovement] = useState(CAMERA_MOVEMENT_OPTIONS[0].id);
  const [lighting, setLighting] = useState(LIGHTING_OPTIONS[0].id);
  const [environment, setEnvironment] = useState(ENVIRONMENT_OPTIONS[0].id);
  const [mood, setMood] = useState(MOOD_OPTIONS[0].id);
  const [visualStyle, setVisualStyle] = useState(VISUAL_STYLE_OPTIONS[0].id);
  const [motionPace, setMotionPace] = useState<'subtle' | 'fluid' | 'dynamic'>('fluid');
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      enhancePromptLocally({
        rawIdea,
        cameraMovement,
        lighting,
        environment,
        mood,
        visualStyle,
        motionPace,
      }),
    [rawIdea, cameraMovement, lighting, environment, mood, visualStyle, motionPace]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.enhancedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored safely
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9298A6] mb-1">
            <span className="text-[#FF6B65] font-medium">Local Cinematography Prompt Builder</span>
            <span aria-hidden="true">·</span>
            <span>English &amp; Roman Urdu</span>
            <span aria-hidden="true">·</span>
            <span>Runs Offline in Browser (Zero Paid APIs)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-[#F5F3EC]">
            Transform a Basic Idea Into a Director’s Shooting Prompt
          </h3>
        </div>
        <SlidersHorizontal className="w-5 h-5 text-[#9298A6] hidden sm:block shrink-0" />
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'gap-6' : 'lg:grid-cols-12 gap-8'} pt-6`}>
        {/* Controls Column */}
        <div className={compact ? 'space-y-4' : 'lg:col-span-6 space-y-5'}>
          <div>
            <label
              htmlFor={compact ? 'studio-assistant-idea' : 'home-assistant-idea'}
              className="block text-xs font-semibold text-[#F5F3EC] mb-2"
            >
              1. Basic Scene Idea (English or Roman Urdu)
            </label>
            <textarea
              id={compact ? 'studio-assistant-idea' : 'home-assistant-idea'}
              rows={2}
              value={rawIdea}
              onChange={(e) => setRawIdea(e.target.value)}
              placeholder="e.g., A lone cyclist riding across a misty bridge at sunrise — or — subah ki dhund mein pahari sarak..."
              className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EC] placeholder-[#9298A6]/60 focus:border-[#D5FF3F] transition-colors resize-none"
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {STARTER_IDEAS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setRawIdea(sample.text)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#0B0D12] text-[#9298A6] hover:text-[#F5F3EC] border border-white/10 hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#9298A6] mb-1.5">
                Camera Movement
              </label>
              <select
                value={cameraMovement}
                onChange={(e) => setCameraMovement(e.target.value)}
                aria-label="Camera Movement"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3 py-2.5 text-xs sm:text-sm text-[#F5F3EC]"
              >
                {CAMERA_MOVEMENT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9298A6] mb-1.5">
                Lighting Direction
              </label>
              <select
                value={lighting}
                onChange={(e) => setLighting(e.target.value)}
                aria-label="Lighting Direction"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3 py-2.5 text-xs sm:text-sm text-[#F5F3EC]"
              >
                {LIGHTING_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9298A6] mb-1.5">
                Environment Context
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                aria-label="Environment Context"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3 py-2.5 text-xs sm:text-sm text-[#F5F3EC]"
              >
                {ENVIRONMENT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9298A6] mb-1.5">
                Visual Optics &amp; Mood
              </label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
                aria-label="Visual Optics"
                className="w-full rounded-xl bg-[#0B0D12] border border-white/15 px-3 py-2.5 text-xs sm:text-sm text-[#F5F3EC]"
              >
                {VISUAL_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#0B0D12] border border-white/10">
              {(['subtle', 'fluid', 'dynamic'] as const).map((pace) => (
                <button
                  key={pace}
                  type="button"
                  onClick={() => setMotionPace(pace)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    motionPace === pace
                      ? 'bg-[#D5FF3F] text-[#0B0D12] font-semibold'
                      : 'text-[#9298A6] hover:text-[#F5F3EC]'
                  }`}
                >
                  {pace} Motion
                </button>
              ))}
            </div>

            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              aria-label="Atmospheric Mood"
              className="rounded-full bg-[#0B0D12] border border-white/15 px-3.5 py-1.5 text-xs text-[#F5F3EC]"
            >
              {MOOD_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Output Preview Column */}
        <div
          className={`${
            compact ? 'pt-4 border-t border-white/[0.08]' : 'lg:col-span-6 lg:border-l lg:border-white/[0.08] lg:pl-8'
          } flex flex-col justify-between space-y-5`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#D5FF3F] flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                Structured Cinematography Output
              </span>
              <span className="text-xs font-mono tabular-nums text-[#9298A6]">
                {result.enhancedPrompt.length} chars
              </span>
            </div>

            <p className="text-sm sm:text-base text-[#F5F3EC] leading-relaxed bg-[#0B0D12] rounded-xl p-4 border border-white/10">
              {result.enhancedPrompt}
            </p>

            {result.detectedRomanUrduTerms.length > 0 && (
              <p className="text-xs text-[#9298A6]">
                <span className="text-[#FF6B65] font-medium">Roman Urdu mapped:</span>{' '}
                {result.detectedRomanUrduTerms.join(' · ')}
              </p>
            )}

            <p className="text-xs text-[#9298A6] leading-relaxed">
              {result.appliedLayers.join(' · ')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onApplyPrompt(result.enhancedPrompt, result.negativePrompt)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs sm:text-sm font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{applyButtonLabel}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/15 bg-[#0B0D12] text-xs sm:text-sm font-medium text-[#F5F3EC] hover:border-white/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#D5FF3F]" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#9298A6]" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
