export interface PromptBuilderParams {
  rawIdea: string;
  cameraMovement: string;
  lighting: string;
  environment: string;
  mood: string;
  visualStyle: string;
  motionPace: string;
}

export interface EnhancedPromptResult {
  enhancedPrompt: string;
  negativePrompt: string;
  detectedRomanUrduTerms: string[];
  appliedLayers: string[];
}

// Curated Roman Urdu -> English cinematography lexicon for local zero-API translation/enrichment
const ROMAN_URDU_LEXICON: Array<{
  pattern: RegExp;
  term: string;
  cinematicTranslation: string;
}> = [
  {
    pattern: /\bbarish\b|\bbaatish\b|\bbarsaat\b/i,
    term: 'barish',
    cinematicTranslation: 'falling rain with glistening wet reflections on stone and glass',
  },
  {
    pattern: /\bpahari\b|\bpahar\b|\bpaharon\b/i,
    term: 'pahar / pahari',
    cinematicTranslation: 'towering rugged mountain ridges wrapped in drifting alpine clouds',
  },
  {
    pattern: /\bdhund\b|\bkohra\b/i,
    term: 'dhund',
    cinematicTranslation: 'volumetric low-lying atmospheric mist rolling across the frame',
  },
  {
    pattern: /\braat\b|\bandhera\b/i,
    term: 'raat',
    cinematicTranslation: 'deep nocturnal twilight sky with moody chiaroscuro shadows',
  },
  {
    pattern: /\bshaam\b|\bmaghrib\b|\bsuraj\b/i,
    term: 'shaam / suraj',
    cinematicTranslation: 'warm golden-hour sunset casting long directional amber shadows',
  },
  {
    pattern: /\bsubah\b|\bsavera\b|\bfajr\b/i,
    term: 'subah',
    cinematicTranslation: 'crisp first light of dawn breaking through soft horizon haze',
  },
  {
    pattern: /\bsamandar\b|\bdarya\b|\blehrein\b|\bpaani\b/i,
    term: 'samandar / paani',
    cinematicTranslation: 'rhythmic ocean waves and shimmering water surface reflections',
  },
  {
    pattern: /\bshehar\b|\bgali\b|\bsarak\b/i,
    term: 'shehar',
    cinematicTranslation: 'cinematic urban streetscape with warm architectural illumination',
  },
  {
    pattern: /\bjangal\b|\bdarakht\b|\bpatte\b/i,
    term: 'jangal / darakht',
    cinematicTranslation: 'ancient wind-stirred forest canopy with dappled sunbeams',
  },
  {
    pattern: /\bhawa\b|\baandhi\b/i,
    term: 'hawa',
    cinematicTranslation: 'expressive wind motion rippling across clothing, hair, and foliage',
  },
  {
    pattern: /\bmusafir\b|\binsaan\b|\bladka\b|\bladki\b/i,
    term: 'musafir / character',
    cinematicTranslation: 'a solitary protagonist framed in medium-wide cinematic composition',
  },
  {
    pattern: /\btrain\b|\brel\b|\bsafar\b/i,
    term: 'safar / train',
    cinematicTranslation: 'an express train gliding smoothly across a scenic viaduct',
  },
  {
    pattern: /\bphool\b|\bbagh\b/i,
    term: 'phool',
    cinematicTranslation: 'delicate botanical petals swaying gently with macro dew droplets',
  },
  {
    pattern: /\bchand\b|\bsitare\b|\baasman\b/i,
    term: 'chand / aasman',
    cinematicTranslation: 'expansive celestial sky illuminated by silver moonlight',
  },
  {
    pattern: /\bgaari\b|\bcar\b/i,
    term: 'gaari',
    cinematicTranslation: 'a sleek vehicle tracking smoothly along a rain-slicked coastal road',
  },
];

export const CAMERA_MOVEMENT_OPTIONS = [
  { id: 'dolly-in', label: 'Anamorphic Dolly Push-In', phrase: 'slow controlled dolly push-in on a 65mm anamorphic lens' },
  { id: 'aerial-fpv', label: 'Sweeping Aerial Glide', phrase: 'sweeping elevated aerial cinema glide with natural parallax' },
  { id: 'tracking-pan', label: 'Lateral Tracking Pan', phrase: 'smooth lateral Steadicam tracking shot following the motion' },
  { id: 'handheld-35', label: 'Organic 35mm Handheld', phrase: 'subtle organic 35mm handheld camera breathing with shallow depth of field' },
  { id: 'crane-rise', label: 'Slow Crane Reveal', phrase: 'gradual upward cinema crane reveal expanding into the horizon' },
  { id: 'locked-macro', label: 'Locked Macro Focus Pull', phrase: 'locked tripod macro composition with smooth rack focus' },
];

export const LIGHTING_OPTIONS = [
  { id: 'golden-chiaroscuro', label: 'Golden Hour Chiaroscuro', phrase: 'warm golden-hour rim light contrasting against deep obsidian shadows' },
  { id: 'rain-tungsten', label: 'Rain & Warm Tungsten', phrase: 'warm amber tungsten interior glow reflecting across wet dark stone' },
  { id: 'volumetric-dawn', label: 'Volumetric Dawn Rays', phrase: 'crepuscular dawn sunbeams diffusing through soft atmospheric mist' },
  { id: 'studio-rim', label: 'Crisp Studio Rim Light', phrase: 'precision commercial studio rim lighting with specular micro-highlights' },
  { id: 'overcast-cinema', label: 'Soft Overcast Film', phrase: 'diffused overcast cinema lighting with rich midtone gradation' },
];

export const ENVIRONMENT_OPTIONS = [
  { id: 'auto', label: 'Match Scene Naturally', phrase: '' },
  { id: 'volcanic-mist', label: 'Misty Highland Ridge', phrase: 'set atop dark basalt terrain with drifting low-altitude clouds' },
  { id: 'architectural-plaza', label: 'Modernist Glass Pavilion', phrase: 'framed by brutalist concrete geometry and rain-slicked plaza reflections' },
  { id: 'botanical-canopy', label: 'Ancient Moss Forest', phrase: 'surrounded by lush moss textures and suspended morning dew particles' },
  { id: 'obsidian-stage', label: 'Minimalist Dark Studio', phrase: 'isolated against a clean deep-graphite studio backdrop' },
];

export const MOOD_OPTIONS = [
  { id: 'contemplative', label: 'Poetic & Contemplative', phrase: 'evoking a quiet, poetic A24 cinema atmosphere' },
  { id: 'monumental', label: 'Epic & Monumental', phrase: 'conveying grand theatrical scale and awe-inspiring momentum' },
  { id: 'tactile-luxury', label: 'Tactile & Precision', phrase: 'highlighting crisp material physics and luxury craftsmanship' },
  { id: 'nostalgic-warm', label: 'Warm & Nostalgic', phrase: 'infused with warm nostalgic color grading and gentle movement' },
];

export const VISUAL_STYLE_OPTIONS = [
  { id: '65mm-film', label: '65mm Cinema Film', phrase: 'photorealistic 65mm film stock, subtle organic grain, natural motion blur' },
  { id: '35mm-editorial', label: '35mm Editorial', phrase: 'high-contrast Leica 35mm editorial cinematography, authentic textures' },
  { id: 'anime-theatrical', label: 'Theatrical Anime', phrase: 'hand-painted theatrical anime film direction, luminous clouds, fluid cel motion' },
  { id: 'macro-tabletop', label: 'High-Speed Commercial', phrase: 'high-speed Phantom Flex commercial slow motion, razor-sharp optics' },
];

export function enhancePromptLocally(params: PromptBuilderParams): EnhancedPromptResult {
  const raw = params.rawIdea.trim();
  const detectedRomanUrduTerms: string[] = [];
  const translatedFragments: string[] = [];

  for (const entry of ROMAN_URDU_LEXICON) {
    if (entry.pattern.test(raw)) {
      detectedRomanUrduTerms.push(entry.term);
      translatedFragments.push(entry.cinematicTranslation);
    }
  }

  // Build subject/action core
  let coreScene = raw;
  if (!coreScene) {
    coreScene = 'A solitary figure standing on a mist-covered volcanic ridge overlooking an illuminated horizon';
  } else if (detectedRomanUrduTerms.length > 0) {
    // Combine user's original phrasing context with crystal-clear English visual descriptors for DiT video models
    coreScene = `${ translatedFragments.join(', ')} (inspired by: "${raw}")`;
  } else {
    // Capitalize cleanly and strip trailing punctuation
    coreScene = coreScene.replace(/[.!,;]+$/, '');
  }

  const cameraObj =
    CAMERA_MOVEMENT_OPTIONS.find((c) => c.id === params.cameraMovement) ||
    CAMERA_MOVEMENT_OPTIONS[0];
  const lightingObj =
    LIGHTING_OPTIONS.find((l) => l.id === params.lighting) || LIGHTING_OPTIONS[0];
  const envObj = ENVIRONMENT_OPTIONS.find((e) => e.id === params.environment);
  const moodObj = MOOD_OPTIONS.find((m) => m.id === params.mood) || MOOD_OPTIONS[0];
  const styleObj =
    VISUAL_STYLE_OPTIONS.find((s) => s.id === params.visualStyle) ||
    VISUAL_STYLE_OPTIONS[0];

  const motionDescriptor =
    params.motionPace === 'dynamic'
      ? 'expressive kinetic subject movement and dynamic environmental particles'
      : params.motionPace === 'subtle'
      ? 'measured, subtle micro-movements with high temporal stability'
      : 'fluid, natural cinematic motion across foreground and background';

  const parts: string[] = [coreScene];
  const appliedLayers: string[] = [];

  if (envObj && envObj.phrase) {
    parts.push(envObj.phrase);
    appliedLayers.push(`Environment: ${envObj.label}`);
  }

  parts.push(motionDescriptor);
  appliedLayers.push(`Motion: ${params.motionPace || 'fluid'}`);

  parts.push(cameraObj.phrase);
  appliedLayers.push(`Camera: ${cameraObj.label}`);

  parts.push(lightingObj.phrase);
  appliedLayers.push(`Lighting: ${lightingObj.label}`);

  parts.push(moodObj.phrase);
  appliedLayers.push(`Mood: ${moodObj.label}`);

  parts.push(styleObj.phrase);
  appliedLayers.push(`Optics: ${styleObj.label}`);

  const enhancedPrompt = parts.join(', ') + '.';
  const negativePrompt =
    'worst quality, inconsistent motion, blurry, jittery, distorted anatomy, flickering textures, watermark, text overlay, oversaturated neon';

  return {
    enhancedPrompt,
    negativePrompt,
    detectedRomanUrduTerms,
    appliedLayers,
  };
}
