import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from 'lucide-react';
import {
  ASPECT_RATIO_CONFIGS,
  SAMPLE_REFERENCE_IMAGE,
  STUDIO_PROMPT_EXAMPLES,
  VISUAL_STYLES,
} from '../data/showcaseData';
import { PromptAssistantInteractive } from '../components/PromptAssistantInteractive';
import {
  fetchProviderStatus,
  generateImageToVideo,
  generateTextToVideo,
} from '../services/videoService';
import { renderPhotoMotionClip } from '../utils/photoMotionRenderer';
import {
  getExpectedLtxFrameCount,
  getLtx23Dimensions,
  normalizeClipDuration,
} from '../utils/videoMetadata';
import {
  CLIP_DURATION_OPTIONS,
  DEFAULT_CLIP_DURATION,
  type AspectRatioOption,
  type ClipDurationOption,
  type CreationMode,
  type GeneratedCreation,
  type PhotoMotionPreset,
  type ProviderStatus,
  type RoutePath,
  type StudioLaunchPayload,
  type VideoErrorCode,
  type VisualStyleId,
} from '../types/studio';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

const PHOTO_MOTION_PRESETS: Array<{
  id: PhotoMotionPreset;
  name: string;
  desc: string;
}> = [
  { id: 'slow-push', name: 'Slow Push-In', desc: 'Controlled anamorphic zoom into focal center' },
  { id: 'editorial-drift', name: 'Editorial Drift', desc: 'Gentle diagonal Ken Burns glide with vignette' },
  { id: 'dramatic-pull', name: 'Wide Reveal Pull', desc: 'Pulls outward from close detail to full frame' },
  { id: 'horizon-pan', name: 'Lateral Horizon Pan', desc: 'Smooth horizontal camera track across scene' },
];

interface UploadedImageState {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

interface StudioPageProps {
  launchPayload: StudioLaunchPayload | null;
  onClearPayload: () => void;
  onNavigate: (route: RoutePath) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function StudioPage({
  launchPayload,
  onClearPayload,
  onNavigate,
}: StudioPageProps) {
  const [mode, setMode] = useState<CreationMode>('text-to-video');
  const [prompt, setPrompt] = useState<string>(STUDIO_PROMPT_EXAMPLES[0].prompt);
  const [negativePrompt, setNegativePrompt] = useState<string>(
    'worst quality, inconsistent motion, blurry, jittery, distorted, watermark'
  );
  const [style, setStyle] = useState<VisualStyleId>('anamorphic');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('16:9');
  const [duration, setDuration] = useState<ClipDurationOption>(DEFAULT_CLIP_DURATION);
  const [photoMotionPreset, setPhotoMotionPreset] = useState<PhotoMotionPreset>('slow-push');
  const [useCustomSeed, setUseCustomSeed] = useState<boolean>(false);
  const [customSeed, setCustomSeed] = useState<number>(42);

  const [uploadedImage, setUploadedImage] = useState<UploadedImageState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hasPermissionConsent, setHasPermissionConsent] = useState<boolean>(false);

  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [checkingProvider, setCheckingProvider] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [stageMessage, setStageMessage] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [photoMotionProgress, setPhotoMotionProgress] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [errorBanner, setErrorBanner] = useState<{
    unavailable: boolean;
    errorCode?: VideoErrorCode;
    message: string;
    detail?: string;
    externalDemoUrl?: string;
  } | null>(null);

  const [creations, setCreations] = useState<GeneratedCreation[]>([]);
  const [activeCreationId, setActiveCreationId] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const monitorSectionRef = useRef<HTMLDivElement | null>(null);
  const sessionBlobUrlsRef = useRef<Set<string>>(new Set());

  const activeCreation =
    creations.find((c) => c.id === activeCreationId) || creations[0] || null;

  const refreshProvider = async () => {
    setCheckingProvider(true);
    const status = await fetchProviderStatus();
    setProviderStatus(status);
    setCheckingProvider(false);
  };

  useEffect(() => {
    refreshProvider();
    const blobSet = sessionBlobUrlsRef.current;
    return () => {
      blobSet.forEach((blobUrl) => URL.revokeObjectURL(blobUrl));
      blobSet.clear();
    };
  }, []);

  // Automatically start video playback (with muted fallback if browser blocks unmuted autoplay after async GPU wait)
  useEffect(() => {
    setPlayerError(null);
    if (!activeCreation || isGenerating) return;
    const videoEl = videoPlayerRef.current;
    if (!videoEl) return;

    const startPlayback = async () => {
      try {
        await videoEl.play();
      } catch {
        videoEl.muted = true;
        await videoEl.play().catch(() => undefined);
      }
    };
    startPlayback();
  }, [activeCreation?.id, activeCreation?.videoUrl, isGenerating]);

  // Load sample reference image helper
  const handleLoadSampleImage = async () => {
    setUploadError(null);
    try {
      const response = await fetch(SAMPLE_REFERENCE_IMAGE.src);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          setUploadedImage({
            dataUrl,
            fileName: 'chronograph-sample.jpg',
            mimeType: blob.type || 'image/jpeg',
            sizeBytes: blob.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
          setHasPermissionConsent(true);
          if (!prompt.trim() || prompt === STUDIO_PROMPT_EXAMPLES[0].prompt) {
            setPrompt(SAMPLE_REFERENCE_IMAGE.motionPrompt);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(blob);
    } catch {
      setUploadError('Unable to load sample reference frame.');
    }
  };

  // Apply incoming launch payload from Homepage / Gallery / Mode pages
  useEffect(() => {
    if (!launchPayload) return;
    if (launchPayload.mode) setMode(launchPayload.mode);
    if (launchPayload.prompt) setPrompt(launchPayload.prompt);
    if (launchPayload.style) setStyle(launchPayload.style);
    if (launchPayload.aspectRatio) setAspectRatio(launchPayload.aspectRatio);
    if (launchPayload.duration) setDuration(normalizeClipDuration(launchPayload.duration));
    if (launchPayload.preloadSampleImage) {
      handleLoadSampleImage();
    }
    onClearPayload();
  }, [launchPayload, onClearPayload]);

  // Live elapsed timer during genuine generation
  useEffect(() => {
    if (!isGenerating) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const validateAndLoadFile = (file: File) => {
    setUploadError(null);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Unsupported file format. Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(
        `File exceeds 8 MB limit (${formatFileSize(file.size)}). Please choose a compressed image.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setUploadError('Could not read the selected image file.');
    };
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => {
        setUploadError('The selected file could not be decoded as a valid image.');
      };
      img.onload = () => {
        setUploadedImage({
          dataUrl,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndLoadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndLoadFile(file);
  };

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setPhotoMotionProgress(null);
    setStageMessage('');
  };

  const handleGenerate = async () => {
    setErrorBanner(null);
    setPlayerError(null);

    if (mode === 'text-to-video') {
      if (prompt.trim().length < 4) {
        setErrorBanner({
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Please enter a scene description of at least 4 characters before generating.',
        });
        return;
      }
    } else {
      if (!uploadedImage) {
        setErrorBanner({
          unavailable: false,
          errorCode: 'MISSING_CONFIG',
          message: 'Please upload a JPG, PNG, or WebP reference image (or load the sample frame).',
        });
        return;
      }
      if (mode === 'image-to-video' && !hasPermissionConsent) {
        setErrorBanner({
          unavailable: false,
          errorCode: 'MISSING_CONFIG',
          message:
            'Please confirm image upload rights and external ZeroGPU inference consent before running AI Image-to-Video.',
        });
        return;
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startedAt = performance.now();
    setIsGenerating(true);
    setPhotoMotionProgress(null);

    try {
      if (mode === 'photo-motion' && uploadedImage) {
        setStageMessage(
          `Encoding ${duration}s (${duration * 30} unique frames @ 30 FPS) H.264 MP4 camera animation locally...`
        );
        const motionOut = await renderPhotoMotionClip({
          imageDataUrl: uploadedImage.dataUrl,
          aspectRatio,
          durationSeconds: duration,
          preset: photoMotionPreset,
          captionHint: prompt,
          onProgress: (frac) => setPhotoMotionProgress(Math.round(frac * 100)),
          signal: controller.signal,
        });

        const totalSec = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
        const newCreation: GeneratedCreation = {
          id: `pm-${Date.now()}`,
          mode: 'photo-motion',
          prompt: `Photo Animation (${
            PHOTO_MOTION_PRESETS.find((p) => p.id === photoMotionPreset)?.name || 'Camera Pan'
          }) — ${uploadedImage.fileName}`,
          videoUrl: motionOut.videoUrl,
          downloadUrl: motionOut.downloadUrl,
          fileExtension: motionOut.fileExtension,
          width: motionOut.width,
          height: motionOut.height,
          duration: motionOut.duration,
          verifiedDuration: motionOut.verifiedDuration,
          fps: motionOut.fps,
          frameCount: motionOut.frameCount,
          aspectRatio,
          style,
          modelLabel: 'Photo Animation · Browser Canvas (Not Generative AI)',
          isGenerativeAi: false,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          elapsedSeconds: totalSec,
        };
        if (motionOut.videoUrl.startsWith('blob:')) {
          sessionBlobUrlsRef.current.add(motionOut.videoUrl);
        }
        setCreations((prev) => [newCreation, ...prev]);
        setActiveCreationId(newCreation.id);
        monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (mode === 'text-to-video') {
        const res = await generateTextToVideo({
          prompt,
          negativePrompt,
          aspectRatio,
          duration,
          style,
          seed: useCustomSeed ? customSeed : undefined,
          onStage: setStageMessage,
          signal: controller.signal,
        });

        if (!res.ok) {
          setErrorBanner({
            unavailable: res.unavailable,
            errorCode: res.errorCode,
            message: res.message,
            detail: res.detail,
            externalDemoUrl: res.externalDemoUrl,
          });
        } else {
          if (res.videoUrl.startsWith('blob:')) {
            sessionBlobUrlsRef.current.add(res.videoUrl);
          }
          const totalSec = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
          const newCreation: GeneratedCreation = {
            id: `t2v-${Date.now()}`,
            mode: 'text-to-video',
            prompt,
            videoUrl: res.videoUrl,
            remoteVideoUrl: res.remoteVideoUrl,
            downloadUrl: res.downloadUrl,
            fileExtension: 'mp4',
            width: res.width,
            height: res.height,
            duration: res.duration,
            verifiedDuration: res.verifiedDuration,
            fps: res.fps,
            frameCount: res.frameCount,
            aspectRatio,
            style,
            seed: res.seed,
            modelLabel: res.model,
            isGenerativeAi: true,
            fallbackNotice: res.fallbackNotice,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            elapsedSeconds: totalSec,
          };
          setCreations((prev) => [newCreation, ...prev]);
          setActiveCreationId(newCreation.id);
          monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (mode === 'image-to-video' && uploadedImage) {
        const res = await generateImageToVideo({
          prompt:
            prompt.trim() ||
            'Subtle natural camera push-in with realistic atmospheric motion',
          negativePrompt,
          imageBase64: uploadedImage.dataUrl,
          mimeType: uploadedImage.mimeType,
          fileName: uploadedImage.fileName,
          aspectRatio,
          duration,
          style,
          hasPermission: hasPermissionConsent,
          seed: useCustomSeed ? customSeed : undefined,
          onStage: setStageMessage,
          signal: controller.signal,
        });

        if (!res.ok) {
          setErrorBanner({
            unavailable: res.unavailable,
            errorCode: res.errorCode,
            message: res.message,
            detail: res.detail,
            externalDemoUrl: res.externalDemoUrl,
          });
        } else {
          if (res.videoUrl.startsWith('blob:')) {
            sessionBlobUrlsRef.current.add(res.videoUrl);
          }
          const totalSec = Math.max(1, Math.round((performance.now() - startedAt) / 1000));
          const newCreation: GeneratedCreation = {
            id: `i2v-${Date.now()}`,
            mode: 'image-to-video',
            prompt: prompt.trim() || `Animated ${uploadedImage.fileName}`,
            videoUrl: res.videoUrl,
            remoteVideoUrl: res.remoteVideoUrl,
            downloadUrl: res.downloadUrl,
            fileExtension: 'mp4',
            width: res.width,
            height: res.height,
            duration: res.duration,
            verifiedDuration: res.verifiedDuration,
            fps: res.fps,
            frameCount: res.frameCount,
            aspectRatio,
            style,
            seed: res.seed,
            modelLabel: res.model,
            isGenerativeAi: true,
            fallbackNotice: res.fallbackNotice,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            elapsedSeconds: totalSec,
          };
          setCreations((prev) => [newCreation, ...prev]);
          setActiveCreationId(newCreation.id);
          monitorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrorBanner({
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: err instanceof Error ? err.message : 'Unable to complete motion rendering.',
        });
      }
    } finally {
      setIsGenerating(false);
      setPhotoMotionProgress(null);
      setStageMessage('');
    }
  };

  const handleDownloadCreation = async (creation: GeneratedCreation) => {
    const fileName = `vidnova-ai-${creation.id}.${creation.fileExtension}`;
    // Local blob: URLs or same-origin /api/video/download attachment streams can trigger immediately
    if (creation.downloadUrl.startsWith('blob:') || creation.downloadUrl.startsWith('/api/')) {
      const a = document.createElement('a');
      a.href = creation.downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // Cross-origin Hugging Face asset URL (e.g., on static Vercel hosting): fetch as Blob for direct file save
    setDownloadingId(creation.id);
    try {
      const res = await fetch(creation.videoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);
    } catch {
      const a = document.createElement('a');
      a.href = creation.videoUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* Studio Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#9298A6] mb-1">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="hover:text-[#F5F3EC] transition-colors cursor-pointer"
            >
              VidNova AI
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-[#F5F3EC]">AI Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EC]">
            AI Motion Production Studio
          </h1>
        </div>

        {/* Honest Real-Time Provider Status Readout */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9298A6]">
          <span>
            Engine:{' '}
            <strong className="text-[#F5F3EC]">
              {mode === 'photo-motion'
                ? 'Browser Photo Animation (Local Canvas MP4 — Not Generative AI)'
                : providerStatus?.model || 'Lightricks/LTX-2.3 Distilled (4s–10s · 24 FPS)'}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            ZeroGPU Status:{' '}
            <strong
              className={
                checkingProvider
                  ? 'text-[#9298A6]'
                  : providerStatus?.available
                  ? 'text-[#D5FF3F]'
                  : 'text-[#FF6B65]'
              }
            >
              {checkingProvider
                ? 'Checking...'
                : providerStatus?.available
                ? 'Running (Free Shared Queue)'
                : `Standby (${providerStatus?.stage || 'Offline'})`}
            </strong>
          </span>
          <button
            type="button"
            onClick={refreshProvider}
            aria-label="Refresh provider status"
            className="p-1.5 rounded-lg border border-white/10 bg-[#151820] text-[#9298A6] hover:text-[#F5F3EC] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingProvider ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Two-Column Desktop Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANEL: Production Controls */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.09] bg-[#151820] p-5 sm:p-6 space-y-6">
          {/* 1. Creation Mode Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#F5F3EC]">
              Creation Mode
            </label>
            <div
              role="tablist"
              aria-label="Select creation mode"
              className="grid grid-cols-1 min-[375px]:grid-cols-3 gap-1 p-1 rounded-2xl min-[375px]:rounded-full bg-[#0B0D12] border border-white/10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'text-to-video'}
                onClick={() => {
                  setMode('text-to-video');
                  setErrorBanner(null);
                }}
                className={`py-2.5 px-2 rounded-xl min-[375px]:rounded-full text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                  mode === 'text-to-video'
                    ? 'bg-[#D5FF3F] text-[#0B0D12]'
                    : 'text-[#9298A6] hover:text-[#F5F3EC]'
                }`}
              >
                Text to Video
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'image-to-video'}
                onClick={() => {
                  setMode('image-to-video');
                  setErrorBanner(null);
                }}
                className={`py-2.5 px-2 rounded-xl min-[375px]:rounded-full text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                  mode === 'image-to-video'
                    ? 'bg-[#D5FF3F] text-[#0B0D12]'
                    : 'text-[#9298A6] hover:text-[#F5F3EC]'
                }`}
              >
                Image to Video
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'photo-motion'}
                onClick={() => {
                  setMode('photo-motion');
                  setErrorBanner(null);
                }}
                className={`py-2.5 px-2 rounded-xl min-[375px]:rounded-full text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                  mode === 'photo-motion'
                    ? 'bg-[#F5F3EC] text-[#0B0D12]'
                    : 'text-[#9298A6] hover:text-[#F5F3EC]'
                }`}
              >
                Photo Motion
              </button>
            </div>
            {mode === 'photo-motion' && (
              <p className="text-xs text-[#9298A6] pt-1">
                <strong className="text-[#F5F3EC]">
                  Photo Motion (Photo Animation — Not Generative AI):
                </strong>{' '}
                Animates your still photo with smooth 30 FPS pan/zoom camera optics locally in your browser—zero GPU queue wait, zero paid APIs, and zero external upload.
              </p>
            )}
          </div>

          {/* 2. Image Upload & Drag-and-Drop (Image-to-Video & Photo Motion) */}
          {(mode === 'image-to-video' || mode === 'photo-motion') && (
            <div className="space-y-3 pt-4 border-t border-white/[0.08]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#F5F3EC]">
                  Source Still Image (JPG, PNG, WebP · Max 8 MB)
                </span>
                {!uploadedImage && (
                  <button
                    type="button"
                    onClick={handleLoadSampleImage}
                    className="text-xs font-medium text-[#D5FF3F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Load Sample Frame
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileInput}
                className="sr-only"
                aria-label="Upload JPG, PNG, or WebP image"
              />

              {!uploadedImage ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`rounded-xl border border-dashed p-6 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-[#D5FF3F] bg-[#D5FF3F]/5'
                      : 'border-white/20 bg-[#0B0D12] hover:border-white/40'
                  }`}
                >
                  <Upload className="w-6 h-6 text-[#D5FF3F] mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-[#F5F3EC]">
                    Drop an image here or click to browse
                  </p>
                  <p className="text-xs text-[#9298A6] mt-1">
                    Validated client-side · JPG, PNG, or WebP up to 8 MB
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/15 bg-[#0B0D12] p-3 flex items-center gap-3.5">
                  <img
                    src={uploadedImage.dataUrl}
                    alt="Uploaded reference preview"
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-white/10"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold text-[#F5F3EC] truncate">
                      {uploadedImage.fileName}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[#9298A6]">
                      {uploadedImage.width} × {uploadedImage.height}px ·{' '}
                      {formatFileSize(uploadedImage.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedImage(null)}
                    aria-label="Remove uploaded image"
                    className="p-2 rounded-lg text-[#9298A6] hover:text-[#FF6B65] hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {uploadError && (
                <p role="alert" className="text-xs text-[#FF6B65] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </p>
              )}

              {mode === 'image-to-video' && (
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasPermissionConsent}
                    onChange={(e) => setHasPermissionConsent(e.target.checked)}
                    className="mt-0.5 accent-[#D5FF3F] rounded"
                  />
                  <span className="text-xs text-[#9298A6] leading-relaxed">
                    I confirm I have permission to use any recognizable person’s likeness and understand this image is sent transiently to Hugging Face ZeroGPU for AI video synthesis (never permanently stored by VidNova AI).
                  </span>
                </label>
              )}
            </div>
          )}

          {/* 3. Prompt Editor (for AI modes) or Camera Rig Selector (for Photo Motion) */}
          {mode !== 'photo-motion' ? (
            <div className="space-y-3 pt-4 border-t border-white/[0.08]">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="studio-prompt-editor"
                  className="text-xs font-semibold text-[#F5F3EC]"
                >
                  {mode === 'image-to-video'
                    ? 'Motion Direction Prompt'
                    : 'Scene & Cinematography Prompt'}
                </label>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-mono tabular-nums text-[#9298A6]">
                    {prompt.length}/1200
                  </span>
                  {prompt.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPrompt('')}
                      className="text-[#9298A6] hover:text-[#F5F3EC] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <textarea
                id="studio-prompt-editor"
                rows={4}
                maxLength={1200}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'image-to-video'
                    ? 'Describe how the subject and camera should move (e.g., Gentle breeze ripples across the water while the camera pushes forward)...'
                    : 'Describe subject, motion, lighting, and camera movement in English or Roman Urdu...'
                }
                className="w-full rounded-xl bg-[#0B0D12] border border-white/15 p-3.5 text-sm text-[#F5F3EC] placeholder-[#9298A6]/60 focus:border-[#D5FF3F] transition-colors leading-relaxed"
              />

              {/* Clickable Starter Examples */}
              <div className="space-y-1.5">
                <span className="block text-xs text-[#9298A6]">
                  Click an example prompt (English &amp; Roman Urdu):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_PROMPT_EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => {
                        setPrompt(ex.prompt);
                        setStyle(ex.style);
                        setAspectRatio(ex.aspectRatio);
                      }}
                      className="px-3 py-1 rounded-full bg-[#0B0D12] border border-white/10 text-xs text-[#9298A6] hover:text-[#F5F3EC] hover:border-white/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Integrated Local AI Prompt Assistant Drawer */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAssistantOpen((prev) => !prev)}
                  aria-expanded={assistantOpen}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#0B0D12] border border-white/12 text-xs font-semibold text-[#F5F3EC] hover:border-[#D5FF3F]/50 transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <Wand2 className="w-3.5 h-3.5 text-[#D5FF3F]" />
                    <span>AI Prompt Assistant (Local Offline Builder)</span>
                  </span>
                  {assistantOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#9298A6]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#9298A6]" />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-4 border-t border-white/[0.08]">
              <label className="block text-xs font-semibold text-[#F5F3EC]">
                Photo Motion Camera Rig
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PHOTO_MOTION_PRESETS.map((preset) => {
                  const active = photoMotionPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPhotoMotionPreset(preset.id)}
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0B0D12] border-[#D5FF3F] text-[#F5F3EC]'
                          : 'bg-[#0B0D12]/60 border-white/10 text-[#9298A6] hover:text-[#F5F3EC]'
                      }`}
                    >
                      <p className="text-xs font-semibold text-[#F5F3EC]">{preset.name}</p>
                      <p className="text-[11px] text-[#9298A6] mt-0.5 leading-snug">
                        {preset.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Visual Style Selection (AI Modes) */}
          {mode !== 'photo-motion' && (
            <div className="space-y-2.5 pt-4 border-t border-white/[0.08]">
              <label className="block text-xs font-semibold text-[#F5F3EC]">
                Cinematic Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {VISUAL_STYLES.map((st) => {
                  const active = style === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStyle(st.id)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0B0D12] border-[#D5FF3F] text-[#F5F3EC]'
                          : 'bg-[#0B0D12]/60 border-white/10 text-[#9298A6] hover:border-white/25 hover:text-[#F5F3EC]'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{st.name}</span>
                      <span className="block text-[11px] text-[#9298A6] truncate mt-0.5">
                        {st.descriptor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Aspect Ratio & Duration Controls */}
          <div className="space-y-4 pt-4 border-t border-white/[0.08]">
            <div>
              <label className="block text-xs font-semibold text-[#F5F3EC] mb-2">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ASPECT_RATIO_CONFIGS.map((ar) => {
                  const active = aspectRatio === ar.id;
                  return (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => setAspectRatio(ar.id)}
                      className={`py-2 px-2 rounded-xl border text-center transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0B0D12] border-[#D5FF3F] text-[#D5FF3F]'
                          : 'bg-[#0B0D12]/60 border-white/10 text-[#9298A6] hover:text-[#F5F3EC]'
                      }`}
                    >
                      <span className="block text-xs font-mono font-semibold tabular-nums">
                        {ar.label}
                      </span>
                      <span className="block text-[10px] text-[#9298A6] truncate mt-0.5">
                        {ar.usage.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="w-full sm:w-auto">
                  <span className="block text-xs font-semibold text-[#F5F3EC] mb-1.5">
                    Clip Duration
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Clip duration in seconds"
                    className="grid grid-cols-4 sm:inline-flex items-center gap-1 p-1 rounded-full bg-[#0B0D12] border border-white/10 w-full sm:w-auto"
                  >
                    {CLIP_DURATION_OPTIONS.map((sec) => {
                      const selected = duration === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setDuration(sec)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-mono tabular-nums font-medium transition-colors whitespace-nowrap shrink-0 text-center cursor-pointer ${
                            selected
                              ? 'bg-[#D5FF3F] text-[#0B0D12] font-semibold'
                              : 'text-[#9298A6] hover:text-[#F5F3EC]'
                          }`}
                        >
                          {sec}s
                        </button>
                      );
                    })}
                  </div>
                </div>

                {mode !== 'photo-motion' && (
                  <div>
                    <span className="block text-xs font-semibold text-[#F5F3EC] mb-1.5">
                      Seed Control
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setUseCustomSeed((v) => !v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          useCustomSeed
                            ? 'bg-[#0B0D12] border-[#D5FF3F] text-[#D5FF3F]'
                            : 'bg-[#0B0D12] border-white/10 text-[#9298A6]'
                        }`}
                      >
                        {useCustomSeed ? 'Fixed' : 'Random'}
                      </button>
                      {useCustomSeed && (
                        <input
                          type="number"
                          min={0}
                          max={2147483647}
                          value={customSeed}
                          onChange={(e) =>
                            setCustomSeed(
                              Math.min(2147483647, Math.max(0, Number(e.target.value) || 0))
                            )
                          }
                          aria-label="Custom generation seed"
                          className="w-24 rounded-lg bg-[#0B0D12] border border-white/15 px-2.5 py-1 text-xs font-mono tabular-nums text-[#F5F3EC]"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] font-mono tabular-nums text-[#9298A6]">
                {mode === 'photo-motion' ? (
                  <>
                    Output spec: {duration * 30} unique frames @ 30 FPS · {duration}.0s H.264 MP4
                  </>
                ) : (
                  <>
                    Target spec: {getExpectedLtxFrameCount(duration, 24)} frames @ 24 FPS ·{' '}
                    {getLtx23Dimensions(
                      aspectRatio,
                      duration,
                      Boolean(providerStatus?.authenticatedQuota)
                    ).width}
                    ×
                    {getLtx23Dimensions(
                      aspectRatio,
                      duration,
                      Boolean(providerStatus?.authenticatedQuota)
                    ).height}{' '}
                    ({duration}s MP4)
                  </>
                )}
              </p>

              {mode !== 'photo-motion' && (
                <p className="text-[11px] text-[#9298A6] leading-relaxed">
                  Model duration support: <strong className="text-[#F5F3EC]">LTX-2.3</strong> natively renders 4s, 6s, 8s &amp; 10s. If free ZeroGPU queues fall back during peak load, clips automatically adjust to that backup model’s real frame cap (8s max on LTX-Distilled, 6s on Zeroscope-v2, ~3.4s on Wan 2.1, or 1.6s on AnimateDiff-Lightning) without breaking generation or looping frames.
                </p>
              )}
            </div>
          </div>

          {/* 6. Primary Generate Button & Honest Quota Notice */}
          <div className="pt-4 border-t border-white/[0.08] space-y-3">
            {!isGenerating ? (
              <button
                type="button"
                onClick={handleGenerate}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-sm font-bold hover:bg-[#E2FF70] transition-transform duration-150 active:scale-[0.99] whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>
                  {mode === 'photo-motion'
                    ? 'Animate Photo Locally (Not Generative AI)'
                    : mode === 'image-to-video'
                    ? 'Generate AI Image-to-Video'
                    : 'Generate AI Text-to-Video'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelGeneration}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-[#FF6B65]/50 bg-[#FF6B65]/10 text-[#FF6B65] text-sm font-semibold hover:bg-[#FF6B65]/20 transition-colors whitespace-nowrap cursor-pointer"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Cancel Active Job ({elapsedSeconds}s)</span>
              </button>
            )}

            <p className="text-[11px] text-[#9298A6] leading-relaxed text-center">
              {mode === 'photo-motion'
                ? '100% free local browser photo animation (not generative AI) · Frame-accurate H.264 MP4 export with zero external upload.'
                : 'Rs. 0 Free Community Quota · Powered by Lightricks LTX-2.3 & LTX-Video Distilled (4s, 6s, 8s, 10s @ 24 FPS) on Hugging Face ZeroGPU.'}
            </p>
          </div>
        </div>

        {/* RIGHT PANEL: Cinema Monitor, Live Status, Video Player & Session History */}
        <div className="lg:col-span-7 space-y-6">
          {/* Expandable Prompt Assistant Drawer when opened in Studio */}
          {assistantOpen && mode !== 'photo-motion' && (
            <PromptAssistantInteractive
              initialIdea={prompt}
              compact
              applyButtonLabel="Apply Enhanced Prompt to Editor"
              onApplyPrompt={(enhanced, neg) => {
                setPrompt(enhanced);
                setNegativePrompt(neg);
                setAssistantOpen(false);
              }}
            />
          )}

          {/* Honest Error / Provider Unavailable Banner */}
          {errorBanner && (
            <div
              role="alert"
              className="rounded-2xl border border-[#FF6B65]/40 bg-[#151820] p-5 sm:p-6 space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#FF6B65] shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  {errorBanner.errorCode && (
                    <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#FF6B65]">
                      {errorBanner.errorCode === 'MISSING_CONFIG'
                        ? 'Missing Input / Consent'
                        : errorBanner.errorCode === 'QUOTA_EXHAUSTED'
                        ? 'Free GPU Quota Exhausted'
                        : errorBanner.errorCode === 'BACKEND_UNAVAILABLE'
                        ? 'Free GPU Backend Unavailable'
                        : 'Generation Request Failed'}
                    </p>
                  )}
                  <p className="text-sm font-semibold text-[#F5F3EC]">
                    {errorBanner.message}
                  </p>
                  {errorBanner.detail && (
                    <p className="text-xs text-[#9298A6] leading-relaxed">
                      Provider report: {errorBanner.detail}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3 pl-8">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Generation</span>
                </button>

                {errorBanner.unavailable && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!uploadedImage) {
                        await handleLoadSampleImage();
                      }
                      setMode('photo-motion');
                      setErrorBanner(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0B0D12] border border-white/20 text-xs font-semibold text-[#F5F3EC] hover:border-[#D5FF3F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>
                      {uploadedImage
                        ? `Switch to ${duration}s Browser Photo Animation (Non-AI)`
                        : `Try Instant ${duration}s Browser Photo Animation (Sample Frame)`}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#D5FF3F]" />
                  </button>
                )}

                {errorBanner.externalDemoUrl && (
                  <a
                    href={errorBanner.externalDemoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0B0D12] border border-white/15 text-xs font-medium text-[#9298A6] hover:text-[#F5F3EC] hover:border-white/35 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Open Official LTX-2.3 Space</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#D5FF3F]" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Main Cinema Monitor */}
          <div
            ref={monitorSectionRef}
            className="rounded-2xl border border-white/[0.09] bg-[#151820] overflow-hidden"
          >
            {/* Monitor Top Bar */}
            <div className="px-5 py-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs text-[#9298A6]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#D5FF3F]" />
                <span className="font-semibold text-[#F5F3EC]">Cinema Output Monitor</span>
              </div>
              <div className="flex items-center gap-2 font-mono tabular-nums">
                <span>Frame {aspectRatio}</span>
                <span aria-hidden="true">·</span>
                <span>{duration}s Target</span>
              </div>
            </div>

            {/* Viewport Stage */}
            <div className="bg-[#0B0D12] min-h-[380px] sm:min-h-[460px] flex items-center justify-center p-4 sm:p-6 relative">
              {isGenerating ? (
                <div className="max-w-md w-full text-center space-y-5 p-6">
                  <Loader2 className="w-10 h-10 text-[#D5FF3F] animate-spin mx-auto" />
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-[#F5F3EC]">
                      {stageMessage || 'Processing motion stream...'}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[#9298A6]">
                      Elapsed: {elapsedSeconds}s
                      {photoMotionProgress !== null && ` · Rendered: ${photoMotionProgress}%`}
                    </p>
                  </div>
                  {photoMotionProgress !== null ? (
                    <div className="w-full h-1.5 bg-[#151820] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D5FF3F] transition-transform duration-150 origin-left"
                        style={{ transform: `scaleX(${photoMotionProgress / 100})` }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-[#9298A6] leading-relaxed">
                      Waiting on real Hugging Face ZeroGPU execution. Shared community queues typically complete in 12–45 seconds without artificial progress estimates.
                    </p>
                  )}
                </div>
              ) : activeCreation ? (
                playerError ? (
                  <div className="max-w-md w-full rounded-xl border border-[#FF6B65]/40 bg-[#151820] p-6 text-center space-y-4">
                    <AlertTriangle className="w-8 h-8 text-[#FF6B65] mx-auto" />
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-[#F5F3EC]">
                        Video Playback Stream Interrupted
                      </p>
                      <p className="text-xs text-[#9298A6] leading-relaxed">{playerError}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadCreation(activeCreation)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download MP4 Directly</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 bg-[#0B0D12] text-xs font-semibold text-[#F5F3EC] hover:border-white/35 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Generate Fresh Take</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center justify-center">
                    <video
                      ref={videoPlayerRef}
                      key={activeCreation.videoUrl}
                      src={activeCreation.videoUrl}
                      controls
                      autoPlay
                      loop
                      playsInline
                      preload="auto"
                      onLoadedMetadata={(e) => {
                        setPlayerError(null);
                        const actualDur = e.currentTarget.duration;
                        if (Number.isFinite(actualDur) && actualDur > 0) {
                          const rounded = Number(actualDur.toFixed(2));
                          setCreations((prev) =>
                            prev.map((item) =>
                              item.id === activeCreation.id && item.verifiedDuration !== rounded
                                ? { ...item, verifiedDuration: rounded }
                                : item
                            )
                          );
                        }
                      }}
                      onError={() => {
                        const fallbackProxy =
                          activeCreation.remoteVideoUrl &&
                          activeCreation.remoteVideoUrl.startsWith('https://')
                            ? `/api/video/download?url=${encodeURIComponent(
                                activeCreation.remoteVideoUrl
                              )}&inline=1`
                            : null;

                        if (fallbackProxy && activeCreation.videoUrl !== fallbackProxy) {
                          setCreations((prev) =>
                            prev.map((item) =>
                              item.id === activeCreation.id
                                ? { ...item, videoUrl: fallbackProxy }
                                : item
                            )
                          );
                          return;
                        }

                        setPlayerError(
                          'This browser could not decode the active video stream directly. You can download the verified MP4 file below or generate a new take.'
                        );
                      }}
                      className="w-full max-h-[460px] object-contain rounded-xl border border-white/10 bg-black"
                    />
                  </div>
                )
              ) : errorBanner ? (
                /* Explicit Failure State Inside Cinema Monitor (Never Blank!) */
                <div className="max-w-lg w-full text-center space-y-4 py-8 px-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl border border-[#FF6B65]/40 bg-[#151820] flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-[#FF6B65]" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg sm:text-xl font-display font-bold text-[#F5F3EC]">
                      {errorBanner.errorCode === 'QUOTA_EXHAUSTED'
                        ? 'Free Community GPU Quota Temporarily Full'
                        : 'Video Generation Could Not Complete'}
                    </h2>
                    <p className="text-sm text-[#9298A6] leading-relaxed">
                      {errorBanner.message}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs font-semibold hover:bg-[#E2FF70] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry Generation</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!uploadedImage) {
                          await handleLoadSampleImage();
                        }
                        setMode('photo-motion');
                        setErrorBanner(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-white/20 bg-[#151820] text-xs font-semibold text-[#F5F3EC] hover:border-[#D5FF3F] transition-colors cursor-pointer"
                    >
                      <span>Render {duration}s Browser Photo Animation Instead</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#D5FF3F]" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Elegant Empty State */
                <div className="max-w-md text-center space-y-5 py-8">
                  <div className="mx-auto w-16 h-16 rounded-2xl border border-white/12 bg-[#151820] flex items-center justify-center">
                    {mode === 'text-to-video' ? (
                      <Film className="w-7 h-7 text-[#D5FF3F]" />
                    ) : mode === 'image-to-video' ? (
                      <ImageIcon className="w-7 h-7 text-[#FF6B65]" />
                    ) : (
                      <Layers className="w-7 h-7 text-[#F5F3EC]" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-display font-bold text-[#F5F3EC]">
                      Ready for Your First Take
                    </h2>
                    <p className="text-sm text-[#9298A6] leading-relaxed">
                      {mode === 'text-to-video'
                        ? 'Enter a scene description on the left—or click any starter prompt—then choose 4s, 6s, 8s, or 10s and press Generate AI Text-to-Video.'
                        : mode === 'image-to-video'
                        ? 'Upload a JPG, PNG, or WebP frame (or load the sample watch image), select 4s, 6s, 8s, or 10s, and generate real motion.'
                        : 'Upload any still photograph or load our sample frame to render a frame-accurate 4s, 6s, 8s, or 10s 30 FPS MP4 clip directly in your browser.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#9298A6]">
                    <span>No watermarks added</span>
                    <span aria-hidden="true">·</span>
                    <span>Verified 4s / 6s / 8s / 10s MP4 output</span>
                  </div>
                </div>
              )}
            </div>

            {/* Completed Video Metadata & Download Footer */}
            {activeCreation && !isGenerating && (
              <div className="p-5 sm:p-6 border-t border-white/[0.08] bg-[#151820] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#9298A6]">
                    <span
                      className={
                        activeCreation.isGenerativeAi
                          ? 'text-[#D5FF3F] font-semibold'
                          : 'text-[#FF6B65] font-semibold'
                      }
                    >
                      {activeCreation.modelLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {activeCreation.width}×{activeCreation.height}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#F5F3EC]">
                      {typeof activeCreation.verifiedDuration === 'number'
                        ? `${activeCreation.verifiedDuration}s output (${activeCreation.duration}s requested)`
                        : `${activeCreation.duration}s`}
                    </span>
                    {typeof activeCreation.frameCount === 'number' &&
                      typeof activeCreation.fps === 'number' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {activeCreation.frameCount}f @ {activeCreation.fps}fps
                          </span>
                        </>
                      )}
                    {typeof activeCreation.seed === 'number' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Seed {activeCreation.seed}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-[#F5F3EC] line-clamp-2">
                    {activeCreation.prompt}
                  </p>
                  {activeCreation.fallbackNotice && (
                    <p className="text-[11px] text-[#FF6B65] leading-relaxed pt-0.5">
                      Note: {activeCreation.fallbackNotice}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const el = videoPlayerRef.current;
                      if (el) {
                        el.currentTime = 0;
                        el.play().catch(() => {
                          el.muted = true;
                          el.play().catch(() => undefined);
                        });
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full border border-white/15 bg-[#0B0D12] text-[#F5F3EC] text-xs sm:text-sm font-semibold hover:border-[#D5FF3F] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-[#D5FF3F] shrink-0" />
                    <span>Replay</span>
                  </button>

                  <button
                    type="button"
                    disabled={downloadingId === activeCreation.id}
                    onClick={() => handleDownloadCreation(activeCreation)}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#D5FF3F] text-[#0B0D12] text-xs sm:text-sm font-semibold hover:bg-[#E2FF70] disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>
                      {downloadingId === activeCreation.id
                        ? 'Saving...'
                        : `Download ${activeCreation.fileExtension.toUpperCase()}`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Session Take History */}
          {creations.length > 0 && (
            <div className="rounded-2xl border border-white/[0.09] bg-[#151820] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#F5F3EC]">
                  Session Takes ({creations.length})
                </h3>
                <span className="text-xs text-[#9298A6]">
                  Stored locally in current browser tab
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {creations.map((item) => {
                  const selected = activeCreation?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveCreationId(item.id)}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#0B0D12] border-[#D5FF3F]'
                          : 'bg-[#0B0D12]/60 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#9298A6] mb-1">
                        <span>
                          {item.isGenerativeAi ? 'Generative AI' : 'Photo Animation (Non-AI)'}
                        </span>
                        <span className="font-mono tabular-nums">
                          {item.createdAt} · {item.elapsedSeconds}s
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#F5F3EC] truncate">
                        {item.prompt}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
