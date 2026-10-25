import type { AspectRatioOption, PhotoMotionPreset } from '../types/studio';

export interface PhotoMotionRenderOptions {
  imageDataUrl: string;
  aspectRatio: AspectRatioOption;
  durationSeconds: number;
  preset: PhotoMotionPreset;
  captionHint?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface PhotoMotionRenderOutput {
  videoUrl: string;
  downloadUrl: string;
  fileExtension: 'mp4' | 'webm';
  width: number;
  height: number;
  duration: number;
}

const CANVAS_SIZES: Record<AspectRatioOption, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 960, height: 960 },
  '4:3': { width: 1024, height: 768 },
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode uploaded image for Photo Motion.'));
    img.src = src;
  });
}

function createSafeMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  mimeType: string;
  ext: 'mp4' | 'webm';
} {
  const candidates: Array<{ mimeType: string; ext: 'mp4' | 'webm' }> = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];

  for (const item of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(item.mimeType)) {
      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: item.mimeType,
          videoBitsPerSecond: 6_000_000,
        });
        const actualMime = recorder.mimeType || item.mimeType;
        return {
          recorder,
          mimeType: actualMime,
          ext: actualMime.includes('mp4') ? 'mp4' : item.ext,
        };
      } catch {
        // Continue to next supported browser codec profile
      }
    }
  }

  const fallbackRecorder = new MediaRecorder(stream);
  const actualMime = fallbackRecorder.mimeType || 'video/webm';
  return {
    recorder: fallbackRecorder,
    mimeType: actualMime,
    ext: actualMime.includes('mp4') ? 'mp4' : 'webm',
  };
}

export async function renderPhotoMotionClip(
  options: PhotoMotionRenderOptions
): Promise<PhotoMotionRenderOutput> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('Your current browser does not support local HTML5 MediaRecorder video export.');
  }

  const img = await loadHtmlImage(options.imageDataUrl);
  const { width, height } = CANVAS_SIZES[options.aspectRatio] || CANVAS_SIZES['16:9'];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize 2D rendering context.');
  }

  const fps = 30;
  const durationMs = Math.max(2, Math.min(6, options.durationSeconds)) * 1000;
  const stream = canvas.captureStream(fps);
  const chosenMime = createSafeMediaRecorder(stream);
  const recorder = chosenMime.recorder;

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  return new Promise<PhotoMotionRenderOutput>((resolve, reject) => {
    let rafId = 0;
    const startTime = performance.now();

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      stream.getTracks().forEach((t) => t.stop());
    };

    if (options.signal) {
      options.signal.addEventListener(
        'abort',
        () => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          cleanup();
          reject(new Error('Photo Motion rendering cancelled.'));
        },
        { once: true }
      );
    }

    recorder.onerror = () => {
      cleanup();
      reject(new Error('Browser video encoder encountered an error during Photo Motion export.'));
    };

    recorder.onstop = () => {
      cleanup();
      if (options.signal?.aborted) return;
      const blob = new Blob(chunks, {
        type: chosenMime.mimeType || 'video/webm',
      });
      const url = URL.createObjectURL(blob);
      resolve({
        videoUrl: url,
        downloadUrl: url,
        fileExtension: chosenMime.ext,
        width,
        height,
        duration: durationMs / 1000,
      });
    };

    // Compute cover base scale so the image fills the aspect frame cleanly without black bars
    const baseScale = Math.max(width / img.naturalWidth, height / img.naturalHeight);

    const drawFrame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeInOutCubic(progress);
      options.onProgress?.(progress);

      let zoomFactor = 1.04;
      let offsetX = 0;
      let offsetY = 0;

      switch (options.preset) {
        case 'slow-push':
          zoomFactor = 1.02 + eased * 0.16;
          offsetY = -eased * height * 0.02;
          break;
        case 'dramatic-pull':
          zoomFactor = 1.2 - eased * 0.16;
          offsetY = (1 - eased) * height * 0.015;
          break;
        case 'horizon-pan':
          zoomFactor = 1.15;
          offsetX = (eased - 0.5) * width * 0.09;
          break;
        case 'editorial-drift':
        default:
          zoomFactor = 1.06 + eased * 0.1;
          offsetX = (0.5 - eased) * width * 0.05;
          offsetY = (eased - 0.5) * height * 0.03;
          break;
      }

      const drawW = img.naturalWidth * baseScale * zoomFactor;
      const drawH = img.naturalHeight * baseScale * zoomFactor;
      const drawX = (width - drawW) / 2 + offsetX;
      const drawY = (height - drawH) / 2 + offsetY;

      ctx.fillStyle = '#0B0D12';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Subtle cinematic radial vignette
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.32,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      grad.addColorStop(0, 'rgba(11, 13, 18, 0)');
      grad.addColorStop(1, 'rgba(11, 13, 18, 0.34)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gentle 0.25s filmic fade-in from Midnight Graphite
      if (progress < 0.08) {
        const fadeAlpha = 1 - progress / 0.08;
        ctx.fillStyle = `rgba(11, 13, 18, ${fadeAlpha * 0.65})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(drawFrame);
      } else if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    };

    recorder.start(120);
    rafId = requestAnimationFrame(drawFrame);
  });
}
