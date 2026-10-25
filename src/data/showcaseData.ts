import heroCinemaImg from '../assets/images/hero_cinematic_motion_1792959244731.jpg';
import landscapeImg from '../assets/images/gallery_cinematic_landscape_1792959245555.jpg';
import futuristicCityImg from '../assets/images/gallery_futuristic_architectural_1792959248042.jpg';
import dreamlikeNatureImg from '../assets/images/gallery_dreamlike_nature_1792959249276.jpg';
import productCommercialImg from '../assets/images/gallery_product_commercial_1792959250656.jpg';
import animeCinemaImg from '../assets/images/gallery_anime_cinema_1792959251898.jpg';
import artisticPortraitImg from '../assets/images/gallery_artistic_portrait_1792959252669.jpg';

import type { AspectRatioOption, ShowcaseItem, VisualStyleId } from '../types/studio';

export const HERO_ARTWORK = {
  src: heroCinemaImg,
  alt: 'Filmmaker on a volcanic ridge overlooking twilight clouds with warm coral horizon light',
  prompt:
    'A solitary cinematographer standing on a dark basalt ridge above rolling twilight clouds, warm sunset coral horizon glow, slow 65mm anamorphic dolly push-in, subtle atmospheric wind.',
};

export const SAMPLE_REFERENCE_IMAGE = {
  src: productCommercialImg,
  title: 'Titanium Chronograph Splash Still',
  motionPrompt:
    'Crystal water droplets splash outward in slow motion around the matte-black timepiece while studio rim light glints across the bezel, subtle camera push-in.',
};

export const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'iceland-highlands',
    title: 'Braided Glacial Rivers at Last Light',
    category: 'Landscapes',
    aspectClass: 'wide',
    aspectRatio: '16:9',
    style: 'anamorphic',
    imageSrc: landscapeImg,
    cameraNote: '65mm Aerial Glide · Slow Forward Parallax',
    lightingNote: 'Crepuscular Golden Sunbeams · Slate Storm Cover',
    prompt:
      'Sweeping aerial cinema shot over black sand highland valleys and braided glacial rivers in Iceland at golden hour, warm sunbeams piercing moody storm clouds, fluid forward flight.',
    romanUrduHint: 'paharon ke darmiyan behhta darya aur shaam ki roshni',
  },
  {
    id: 'aurora-monorail',
    title: 'Aurora Brutalist Monorail Pavilion',
    category: 'Futuristic Cities',
    aspectClass: 'standard',
    aspectRatio: '4:3',
    style: 'noir',
    imageSrc: futuristicCityImg,
    cameraNote: '35mm Locked Tripod · Passing Transit Motion',
    lightingNote: 'Amber Interior Tungsten · Wet Stone Reflections',
    prompt:
      'An illuminated glass-and-concrete monorail train glides smoothly into a brutalist transit pavilion at dusk after rain, warm amber reflections rippling across wet stone plaza, commuters walking with umbrellas.',
    romanUrduHint: 'barish ke baad roshan shehar aur chalti train',
  },
  {
    id: 'glasswing-flora',
    title: 'Translucent Forest Blossoms in Dawn Mist',
    category: 'Dreamlike Nature',
    aspectClass: 'portrait',
    aspectRatio: '9:16',
    style: 'naturalistic',
    imageSrc: dreamlikeNatureImg,
    cameraNote: '85mm Macro Lens · Rack Focus & Floating Dew',
    lightingNote: 'Backlit Morning Sun · Bokeh Forest Canopy',
    prompt:
      'Dreamlike macro cinema shot of translucent white blossoms resting on ancient moss in a misty forest at dawn, tiny dew droplets drifting slowly in golden sunbeams, gentle breeze.',
    romanUrduHint: 'subah ki dhund mein jangal aur chamakte phool',
  },
  {
    id: 'chronograph-splash',
    title: 'Obsidian Titanium Chronograph Hydro-Test',
    category: 'Commercials',
    aspectClass: 'standard',
    aspectRatio: '4:3',
    style: 'commercial',
    imageSrc: productCommercialImg,
    cameraNote: '100mm Tabletop Macro · High-Speed Slow Motion',
    lightingNote: 'Crisp Specular Studio Rim · Dark Slate Contrast',
    prompt:
      'High-speed tabletop commercial slow-motion shot of water droplets splashing around a matte-black titanium mechanical watch on wet obsidian stone, sharp studio rim lighting.',
  },
  {
    id: 'coastal-viaduct-anime',
    title: 'Coastal Viaduct Express at Sunset',
    category: 'Anime Cinema',
    aspectClass: 'wide',
    aspectRatio: '16:9',
    style: 'anime',
    imageSrc: animeCinemaImg,
    cameraNote: 'Wide Tracking Shot · Parallel Ocean Horizon',
    lightingNote: 'Painterly Sunset Coral Cumulus · Shimmering Sea',
    prompt:
      'Hand-painted theatrical anime cinema shot of a vintage express train crossing a sunlit ocean viaduct at sunset, billowing steam trailing in the wind beneath towering coral clouds, waves sparkling below.',
    romanUrduHint: 'samandar ke upar shaam ke waqt train ka safar',
  },
  {
    id: 'silk-kinetic-portrait',
    title: 'Choreography in Ivory Silk & Tungsten',
    category: 'Portraits',
    aspectClass: 'portrait',
    aspectRatio: '9:16',
    style: 'documentary',
    imageSrc: artisticPortraitImg,
    cameraNote: '50mm Leica Prime · Slow Shutter Motion Trail',
    lightingNote: 'Warm Coral Side Key · Deep Graphite Backdrop',
    prompt:
      'High-contrast 35mm editorial film portrait of a contemporary dancer turning gracefully in flowing ivory silk against a dark studio backdrop, warm coral side lighting, fluid fabric movement.',
  },
];

export const VISUAL_STYLES: Array<{
  id: VisualStyleId;
  name: string;
  descriptor: string;
}> = [
  {
    id: 'anamorphic',
    name: 'Anamorphic Film',
    descriptor: '65mm widescreen depth, organic grain, rich shadows',
  },
  {
    id: 'documentary',
    name: 'Editorial 35mm',
    descriptor: 'Naturalistic Leica contrast, authentic human movement',
  },
  {
    id: 'noir',
    name: 'Architectural Noir',
    descriptor: 'Rain-slicked surfaces, warm tungsten & obsidian contrast',
  },
  {
    id: 'anime',
    name: 'Theatrical Anime',
    descriptor: 'Painterly skies, expressive lighting, cel-shaded motion',
  },
  {
    id: 'commercial',
    name: 'Macro Commercial',
    descriptor: 'Crisp studio rim light, tactile slow-motion physics',
  },
  {
    id: 'naturalistic',
    name: 'Pure Daylight',
    descriptor: 'Balanced atmospheric optics and lifelike fluid dynamics',
  },
];

export const ASPECT_RATIO_CONFIGS: Array<{
  id: AspectRatioOption;
  label: string;
  usage: string;
  resolution: string;
}> = [
  { id: '16:9', label: '16:9', usage: 'Widescreen Cinema', resolution: '768 × 448' },
  { id: '9:16', label: '9:16', usage: 'Vertical Reel', resolution: '448 × 768' },
  { id: '1:1', label: '1:1', usage: 'Editorial Square', resolution: '576 × 576' },
  { id: '4:3', label: '4:3', usage: 'Academy Frame', resolution: '704 × 512' },
];

export const STUDIO_PROMPT_EXAMPLES: Array<{
  label: string;
  language: 'English' | 'Roman Urdu';
  style: VisualStyleId;
  aspectRatio: AspectRatioOption;
  prompt: string;
}> = [
  {
    label: 'Volcanic Ridge Mist',
    language: 'English',
    style: 'anamorphic',
    aspectRatio: '16:9',
    prompt:
      'Low-altitude mist rolling across black volcanic cliffs at dawn while golden sunlight pierces storm clouds, slow 65mm anamorphic aerial push-in.',
  },
  {
    label: 'Rainy Monorail Plaza',
    language: 'English',
    style: 'noir',
    aspectRatio: '4:3',
    prompt:
      'A sleek glass monorail gliding silently into a rain-slicked concrete station at dusk, warm amber reflections rippling across wet stone.',
  },
  {
    label: 'Coastal Anime Express',
    language: 'English',
    style: 'anime',
    aspectRatio: '16:9',
    prompt:
      'Hand-painted theatrical anime scene of an express train crossing an ocean bridge at sunset under glowing coral cumulus clouds, gentle camera pan.',
  },
  {
    label: 'Barish Aur Pahari Safar',
    language: 'Roman Urdu',
    style: 'documentary',
    aspectRatio: '16:9',
    prompt:
      'barish aur dhund mein lipti pahari sarak par shaam ki roshni aur tez hawa',
  },
  {
    label: 'Samandar Ki Lehrein',
    language: 'Roman Urdu',
    style: 'anamorphic',
    aspectRatio: '9:16',
    prompt:
      'shaam ke suraj ke neeche samandar ki lehrein aur hawa mein urhte parinday',
  },
];

export const FAQ_ITEMS: Array<{
  category: 'Pricing & Quotas' | 'AI Models' | 'Privacy & Uploads' | 'Prompting';
  question: string;
  answer: string;
}> = [
  {
    category: 'Pricing & Quotas',
    question: 'Is VidNova AI completely free to use?',
    answer:
      'Yes. VidNova AI operates on a strict zero-cost architecture (Rs. 0 / $0). There are no subscriptions, hidden credit packs, or paid API keys. Our Local Prompt Assistant and Photo Motion studio run directly in your browser at zero cost, while generative AI video connects to free community Hugging Face ZeroGPU infrastructure.',
  },
  {
    category: 'AI Models',
    question: 'Which open-source AI model powers Text-to-Video and Image-to-Video?',
    answer:
      'Generative video synthesis connects to Lightricks LTX-Video Distilled (an open-weight Diffusion Transformer video model) hosted on Hugging Face ZeroGPU. Because ZeroGPU allocates shared dynamic GPUs across free community users, generation typically takes 12 to 35 seconds when queue capacity is open.',
  },
  {
    category: 'Pricing & Quotas',
    question: 'Why might AI video generation show a temporary unavailability notice?',
    answer:
      'Free Hugging Face ZeroGPU spaces enforce strict per-IP and hourly compute quotas so everyone can share GPU slices fairly without billing. If shared community capacity is temporarily full, VidNova AI honestly displays a provider status notice rather than showing fake progress bars or pre-recorded videos—and provides a direct link to the official Space plus local Photo Motion.',
  },
  {
    category: 'AI Models',
    question: 'What is the difference between Image-to-Video and Photo Motion?',
    answer:
      'Image-to-Video uses the open-weight LTX-Video neural model on ZeroGPU to synthesize new frame-by-frame motion from your still image and prompt. Photo Motion is an instant, non-generative browser camera engine that renders smooth 30fps pan, zoom, and vignette camera movements locally on your device using HTML5 Canvas—requiring zero GPU queue wait and zero external upload.',
  },
  {
    category: 'Prompting',
    question: 'Does the AI Prompt Assistant support both English and Roman Urdu?',
    answer:
      'Yes. Our local cinematography prompt builder runs 100% offline in your browser without paid LLM APIs. You can write ideas in English or Roman Urdu (such as "barish ke baad pahari par dhund aur shaam ki roshni"), and the assistant translates and structures subject, camera movement, lighting, mood, and optical details for video models.',
  },
  {
    category: 'Privacy & Uploads',
    question: 'How are uploaded photos handled, and are they stored permanently?',
    answer:
      'VidNova AI does not store personal photos in any permanent database or cloud bucket. In Photo Motion mode, your image never leaves your browser. In AI Image-to-Video mode, your validated JPG, PNG, or WebP file (up to 8 MB) is transmitted transiently to the Hugging Face ZeroGPU worker solely to compute the output video. Always ensure you have explicit permission before uploading images of recognizable people.',
  },
];
