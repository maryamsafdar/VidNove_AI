import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type {
  AspectRatioOption,
  ClipDurationOption,
  PhotoMotionPreset,
} from '../types/studio';
import {
  normalizeClipDuration,
  parseMp4MetadataFromBytes,
  probeBrowserVideoDuration,
} from './videoMetadata';

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
  duration: ClipDurationOption;
  verifiedDuration: number;
  fps: number;
  frameCount: number;
}

const CANVAS_SIZES: Record<AspectRatioOption, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
  '1:1': { width: 960, height: 960 },
  '4:3': { width: 1024, height: 768 },
};

const PHOTO_MOTION_FPS = 30;

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

function drawCameraMotionFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  baseScale: number,
  preset: PhotoMotionPreset,
  progress: number,
  elapsedSec: number
): void {
  const eased = easeInOutCubic(Math.min(1, Math.max(0, progress)));

  let zoomFactor = 1.04;
  let offsetX = 0;
  let offsetY = 0;

  switch (preset) {
    case 'slow-push':
      zoomFactor = 1.02 + eased * 0.18;
      offsetY = -eased * height * 0.022;
      break;
    case 'dramatic-pull':
      zoomFactor = 1.22 - eased * 0.18;
      offsetY = (1 - eased) * height * 0.018;
      break;
    case 'horizon-pan':
      zoomFactor = 1.16;
      offsetX = (eased - 0.5) * width * 0.1;
      break;
    case 'editorial-drift':
    default:
      zoomFactor = 1.06 + eased * 0.12;
      offsetX = (0.5 - eased) * width * 0.055;
      offsetY = (eased - 0.5) * height * 0.032;
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

  // Gentle 0.3s filmic fade-in from Midnight Graphite at clip opening
  if (elapsedSec < 0.3) {
    const fadeAlpha = 1 - elapsedSec / 0.3;
    ctx.fillStyle = `rgba(11, 13, 18, ${fadeAlpha * 0.65})`;
    ctx.fillRect(0, 0, width, height);
  }
}

async function pickSupportedAvcCodec(width: number, height: number): Promise<string | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const candidates = [
    'avc1.640028', // H.264 High Profile Level 4.0
    'avc1.4d0028', // H.264 Main Profile Level 4.0
    'avc1.42001f', // H.264 Baseline Profile Level 3.1
    'avc1.42E01E', // H.264 Constrained Baseline
  ];

  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 6_000_000,
        framerate: PHOTO_MOTION_FPS,
      });
      if (support.supported) {
        return codec;
      }
    } catch {
      // Try next H.264 profile
    }
  }

  return null;
}

async function encodeExactMp4WithWebCodecs(params: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  width: number;
  height: number;
  baseScale: number;
  durationSec: ClipDurationOption;
  preset: PhotoMotionPreset;
  codec: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<PhotoMotionRenderOutput> {
  const {
    canvas,
    ctx,
    img,
    width,
    height,
    baseScale,
    durationSec,
    preset,
    codec,
    onProgress,
    signal,
  } = params;

  const totalFrames = durationSec * PHOTO_MOTION_FPS;
  const frameDurationUs = Math.round(1_000_000 / PHOTO_MOTION_FPS);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: PHOTO_MOTION_FPS,
    },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (err) => {
      encoderError = err instanceof Error ? err : new Error('H.264 encoder failed.');
    },
  });

  encoder.configure({
    codec,
    width,
    height,
    bitrate: 6_000_000,
    framerate: PHOTO_MOTION_FPS,
  });

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (signal?.aborted) {
        throw new Error('Photo Motion rendering cancelled.');
      }
      if (encoderError) {
        throw encoderError;
      }

      // Continuous unique camera position for every single frame (no frozen/duplicated frames)
      const progress = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 1;
      const elapsedSec = frameIndex / PHOTO_MOTION_FPS;

      drawCameraMotionFrame(
        ctx,
        img,
        width,
        height,
        baseScale,
        preset,
        progress,
        elapsedSec
      );

      const timestampUs = Math.round((frameIndex * 1_000_000) / PHOTO_MOTION_FPS);
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      const isKeyFrame = frameIndex % PHOTO_MOTION_FPS === 0;
      encoder.encode(videoFrame, { keyFrame: isKeyFrame });
      videoFrame.close();

      onProgress?.((frameIndex + 1) / totalFrames);

      // Yield periodically for encoder backpressure and responsive UI progress updates
      if (encoder.encodeQueueSize > 8) {
        await encoder.flush();
      } else if (frameIndex % 6 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    if (encoderError) {
      throw encoderError;
    }
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }

  const mp4Bytes = new Uint8Array(target.buffer);
  const parsedMeta = parseMp4MetadataFromBytes(mp4Bytes);
  const verifiedDuration = parsedMeta?.durationSeconds ?? durationSec;

  const blob = new Blob([mp4Bytes], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);

  return {
    videoUrl: url,
    downloadUrl: url,
    fileExtension: 'mp4',
    width,
    height,
    duration: durationSec,
    verifiedDuration,
    fps: PHOTO_MOTION_FPS,
    frameCount: parsedMeta?.frameCount ?? totalFrames,
  };
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
  if (typeof document === 'undefined') {
    throw new Error('Photo Motion requires a browser rendering environment.');
  }

  const durationSec = normalizeClipDuration(options.durationSeconds);
  const img = await loadHtmlImage(options.imageDataUrl);
  const { width, height } = CANVAS_SIZES[options.aspectRatio] || CANVAS_SIZES['16:9'];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize 2D rendering context.');
  }

  const baseScale = Math.max(width / img.naturalWidth, height / img.naturalHeight);

  // Primary Path: Frame-accurate H.264 MP4 synthesis via WebCodecs + mp4-muxer (exact 120/180/240/300 unique frames @ 30 FPS)
  const supportedAvc = await pickSupportedAvcCodec(width, height);
  if (supportedAvc) {
    try {
      return await encodeExactMp4WithWebCodecs({
        canvas,
        ctx,
        img,
        width,
        height,
        baseScale,
        durationSec,
        preset: options.preset,
        codec: supportedAvc,
        onProgress: options.onProgress,
        signal: options.signal,
      });
    } catch (err) {
      if (options.signal?.aborted) {
        throw err;
      }
      // Fall back to MediaRecorder if hardware WebCodecs fails on a niche GPU driver
    }
  }

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Your browser does not support WebCodecs or HTML5 MediaRecorder video export.');
  }

  // Fallback Path: Full-duration real-time MediaRecorder (supports 4s, 6s, 8s, 10s with no 6s cap)
  const durationMs = durationSec * 1000;
  const totalFrames = durationSec * PHOTO_MOTION_FPS;
  const stream = canvas.captureStream(PHOTO_MOTION_FPS);
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

    recorder.onstop = async () => {
      cleanup();
      if (options.signal?.aborted) return;
      const blob = new Blob(chunks, {
        type: chosenMime.mimeType || 'video/webm',
      });
      const url = URL.createObjectURL(blob);
      const probed = await probeBrowserVideoDuration(url, 4000);
      resolve({
        videoUrl: url,
        downloadUrl: url,
        fileExtension: chosenMime.ext,
        width,
        height,
        duration: durationSec,
        verifiedDuration: probed ?? durationSec,
        fps: PHOTO_MOTION_FPS,
        frameCount: totalFrames,
      });
    };

    const drawFrame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      options.onProgress?.(progress);

      drawCameraMotionFrame(
        ctx,
        img,
        width,
        height,
        baseScale,
        options.preset,
        progress,
        elapsed / 1000
      );

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
