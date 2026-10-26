export type RoutePath =
  | '/'
  | '/explore'
  | '/studio'
  | '/text-to-video'
  | '/image-to-video'
  | '/how-it-works'
  | '/faq'
  | '/contact'
  | '/privacy'
  | '/terms';

export type CreationMode = 'text-to-video' | 'image-to-video' | 'photo-motion';

export type AspectRatioOption = '16:9' | '9:16' | '1:1' | '4:3';

export type ClipDurationOption = 4 | 6 | 8 | 10;

export const CLIP_DURATION_OPTIONS: readonly ClipDurationOption[] = [4, 6, 8, 10] as const;

export const DEFAULT_CLIP_DURATION: ClipDurationOption = 4;

export type VisualStyleId =
  | 'anamorphic'
  | 'documentary'
  | 'noir'
  | 'anime'
  | 'commercial'
  | 'naturalistic';

export type PhotoMotionPreset =
  | 'slow-push'
  | 'editorial-drift'
  | 'dramatic-pull'
  | 'horizon-pan';

export interface StudioLaunchPayload {
  mode?: CreationMode;
  prompt?: string;
  style?: VisualStyleId;
  aspectRatio?: AspectRatioOption;
  duration?: ClipDurationOption;
  preloadSampleImage?: boolean;
}

export interface ShowcaseItem {
  id: string;
  title: string;
  category:
    | 'Landscapes'
    | 'Futuristic Cities'
    | 'Dreamlike Nature'
    | 'Commercials'
    | 'Anime Cinema'
    | 'Portraits';
  aspectClass: 'wide' | 'standard' | 'portrait';
  aspectRatio: AspectRatioOption;
  style: VisualStyleId;
  imageSrc: string;
  cameraNote: string;
  lightingNote: string;
  prompt: string;
  romanUrduHint?: string;
}

export type VideoErrorCode =
  | 'MISSING_CONFIG'
  | 'QUOTA_EXHAUSTED'
  | 'BACKEND_UNAVAILABLE'
  | 'REQUEST_FAILED';

export interface ProviderStatus {
  available: boolean;
  stage: string;
  hardware: string;
  provider: string;
  model: string;
  fallbackModel?: string;
  fallbackAvailable?: boolean;
  authenticatedQuota: boolean;
}

export interface GeneratedCreation {
  id: string;
  mode: CreationMode;
  prompt: string;
  videoUrl: string;
  remoteVideoUrl?: string;
  downloadUrl: string;
  fileExtension: 'mp4' | 'webm';
  width: number;
  height: number;
  duration: ClipDurationOption;
  verifiedDuration?: number;
  fps?: number;
  frameCount?: number;
  aspectRatio: AspectRatioOption;
  style: VisualStyleId;
  seed?: number;
  modelLabel: string;
  isGenerativeAi: boolean;
  fallbackNotice?: string;
  createdAt: string;
  elapsedSeconds: number;
}
