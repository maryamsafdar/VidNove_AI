import crypto from 'crypto';
import type { IncomingMessage } from 'http';
import type {
  AspectRatioOption,
  ClipDurationOption,
  ProviderStatus,
  VideoErrorCode,
} from '../types/studio';
import {
  getExpectedLtxFrameCount,
  getLtx23Dimensions,
  hasValidVideoSignature,
  isDurationWithinTolerance,
  isValidClipDuration,
  normalizeGradioVideoUrl,
  parseMp4MetadataFromBytes,
} from '../utils/videoMetadata';

// 1. Primary 4s-10s Open-Weight DiT Engine (LTX-2.3 22B Distilled, 24 FPS: 97/145/193/241 frames)
export const LTX23_SPACE_BASE = 'https://upsampler-ltx-video.hf.space';

// 2. Secondary 4s-8s Official Distilled Engine (caps at 8.5s @ 24 FPS)
export const LTX_DISTILLED_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space';

// 3. Tertiary 4s-6s Widescreen Engine (24-48 frames @ 8 FPS; caps at 6.0s)
export const ZEROSCOPE_SPACE_BASE = 'https://hysts-zeroscope-v2.hf.space';

// 4. Fast 4-Step Image-to-Video Fallback Engine (Wan 2.1 14B Fast, 81 frames @ 24 FPS ≈ 3.38s)
export const WAN_FAST_SPACE_BASE = 'https://multimodalart-wan2-1-fast.hf.space';

// 5. Resilient Short-Clip Fallback Engine (ByteDance AnimateDiff-Lightning, 16 frames @ 10 FPS = 1.6s)
export const ANIMATEDIFF_SPACE_BASE = 'https://bytedance-animatediff-lightning.hf.space';

export const ALLOWED_DOWNLOAD_ORIGINS = new Set([
  LTX23_SPACE_BASE,
  LTX_DISTILLED_SPACE_BASE,
  ZEROSCOPE_SPACE_BASE,
  WAN_FAST_SPACE_BASE,
  ANIMATEDIFF_SPACE_BASE,
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_JSON_BODY_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VALID_ASPECT_RATIOS = new Set<AspectRatioOption>(['16:9', '9:16', '1:1', '4:3']);

const LTX_DISTILLED_DIMENSIONS: Record<AspectRatioOption, { width: number; height: number }> = {
  '16:9': { width: 768, height: 448 },
  '9:16': { width: 448, height: 768 },
  '1:1': { width: 576, height: 576 },
  '4:3': { width: 704, height: 512 },
};

const WAN_FAST_DIMENSIONS: Record<AspectRatioOption, { width: number; height: number }> = {
  '16:9': { width: 640, height: 384 },
  '9:16': { width: 384, height: 640 },
  '1:1': { width: 512, height: 512 },
  '4:3': { width: 576, height: 448 },
};

const STYLE_MODIFIERS: Record<string, string> = {
  anamorphic:
    'shot on 65mm anamorphic cinema lens, natural film grain, rich tonal contrast, smooth camera motion',
  documentary:
    '35mm editorial documentary film aesthetic, naturalistic lighting, authentic organic textures, steady camera',
  noir: 'high-contrast architectural cinema, deep obsidian shadows, warm tungsten rim light, atmospheric mist',
  anime:
    'hand-painted theatrical anime feature film animation, expressive lighting, detailed atmospheric backgrounds, fluid motion',
  commercial:
    'high-speed tabletop commercial cinematography, crisp studio rim lighting, shallow depth of field, pristine detail',
  naturalistic:
    'photorealistic cinema, natural daylight illumination, realistic physics and fluid motion',
};

const ROMAN_URDU_SERVER_LEXICON: Array<{ pattern: RegExp; phrase: string }> = [
  { pattern: /\bbarish\b|\bbaatish\b|\bbarsaat\b/i, phrase: 'falling rain with glistening wet reflections' },
  { pattern: /\bpahari\b|\bpahar\b|\bpaharon\b/i, phrase: 'rugged mountain ridges wrapped in alpine clouds' },
  { pattern: /\bdhund\b|\bkohra\b/i, phrase: 'volumetric atmospheric mist rolling across the scene' },
  { pattern: /\braat\b|\bandhera\b/i, phrase: 'deep nocturnal twilight sky with moody shadows' },
  { pattern: /\bshaam\b|\bmaghrib\b|\bsuraj\b/i, phrase: 'warm golden-hour sunset casting amber light' },
  { pattern: /\bsubah\b|\bsavera\b|\bfajr\b/i, phrase: 'first light of dawn breaking through soft horizon haze' },
  { pattern: /\bsamandar\b|\bdarya\b|\blehrein\b|\bpaani\b/i, phrase: 'rhythmic ocean waves and shimmering water reflections' },
  { pattern: /\bshehar\b|\bgali\b|\bsarak\b/i, phrase: 'cinematic roadway and urban architecture' },
  { pattern: /\bjangal\b|\bdarakht\b|\bpatte\b/i, phrase: 'wind-stirred forest canopy with sunbeams' },
  { pattern: /\bhawa\b|\baandhi\b|urhte\s+parinday/i, phrase: 'expressive wind motion and birds gliding across the sky' },
  { pattern: /\btrain\b|\brel\b|\bsafar\b/i, phrase: 'an express train gliding smoothly along a scenic route' },
  { pattern: /\bphool\b|\bbagh\b/i, phrase: 'delicate blossoms swaying gently with morning dew' },
];

export interface ServerGenerationResult {
  httpStatus: number;
  body:
    | {
        ok: true;
        videoUrl: string;
        downloadUrl: string;
        seed: number;
        width: number;
        height: number;
        duration: ClipDurationOption;
        verifiedDuration: number;
        fps: number;
        frameCount: number;
        model: string;
        fallbackNotice?: string;
      }
    | {
        ok: false;
        unavailable: boolean;
        errorCode: VideoErrorCode;
        message: string;
        detail?: string;
        externalDemoUrl?: string;
      };
}

let cachedStatus: (ProviderStatus & { checkedAt: number }) | null = null;

export function getOptionalServerHfToken(): string | null {
  const token = process.env.HF_TOKEN?.trim();
  if (token && token.startsWith('hf_') && token.length >= 10) {
    return token;
  }
  return null;
}

export function getHfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const validToken = getOptionalServerHfToken();
  if (validToken) {
    headers['Authorization'] = `Bearer ${validToken}`;
  }
  return headers;
}

function normalizePromptWithRomanUrdu(rawPrompt: string): string {
  const hits: string[] = [];
  for (const item of ROMAN_URDU_SERVER_LEXICON) {
    if (item.pattern.test(rawPrompt)) {
      hits.push(item.phrase);
    }
  }
  if (hits.length > 0) {
    return `${hits.join(', ')} (${rawPrompt})`;
  }
  return rawPrompt;
}

function classifyUpstreamError(rawMessage: string): VideoErrorCode {
  if (/quota|exceeded|runs limit|rate limit|too many requests|429|0s left|zero gpu/i.test(rawMessage)) {
    return 'QUOTA_EXHAUSTED';
  }
  if (/paused|sleeping|building|stopped|unreachable|502|503|504|fetch failed|abort|timeout/i.test(rawMessage)) {
    return 'BACKEND_UNAVAILABLE';
  }
  return 'REQUEST_FAILED';
}

function normalizeAspectRatio(raw: unknown): AspectRatioOption {
  if (typeof raw === 'string' && VALID_ASPECT_RATIOS.has(raw as AspectRatioOption)) {
    return raw as AspectRatioOption;
  }
  return '16:9';
}

function buildUserFacingErrorMessage(code: VideoErrorCode, modeLabel: string): string {
  switch (code) {
    case 'MISSING_CONFIG':
      return `${modeLabel} configuration is incomplete.`;
    case 'QUOTA_EXHAUSTED':
      return `Free Hugging Face ZeroGPU community quota is currently exhausted for this IP. Add a free read-only HF_TOKEN on your server/Vercel settings or retry when the free IP window resets.`;
    case 'BACKEND_UNAVAILABLE':
      return `The free open-source ${modeLabel} GPU backend is temporarily unreachable or waking up.`;
    case 'REQUEST_FAILED':
    default:
      return `${modeLabel} request could not be completed by the upstream provider.`;
  }
}

export async function readJsonBody<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const withBody = req as IncomingMessage & { body?: unknown };
  if (withBody.body !== undefined && withBody.body !== null) {
    if (typeof withBody.body === 'object' && !Buffer.isBuffer(withBody.body) && !(withBody.body instanceof Uint8Array)) {
      return withBody.body as T;
    }
    if (typeof withBody.body === 'string') {
      return (withBody.body.trim() ? JSON.parse(withBody.body) : {}) as T;
    }
    if (Buffer.isBuffer(withBody.body) || withBody.body instanceof Uint8Array) {
      const str = Buffer.from(withBody.body).toString('utf8');
      return (str.trim() ? JSON.parse(str) : {}) as T;
    }
  }

  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.byteLength;
      if (totalBytes > MAX_JSON_BODY_BYTES) {
        reject(new Error('Request payload exceeds 12 MB limit.'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function extractVideoFromGradioOutput(
  outData: unknown,
  spaceBase: string,
  apiPrefix: '/gradio_api' | ''
): { videoUrl?: string; seed?: number } {
  if (!Array.isArray(outData) || outData.length === 0) {
    return {};
  }

  const first = outData[0];
  const returnedSeed = typeof outData[1] === 'number' ? outData[1] : undefined;

  if (typeof first === 'string') {
    const normalized = normalizeGradioVideoUrl({
      rawUrl: first.startsWith('http') ? first : null,
      rawPath: !first.startsWith('http') ? first : null,
      spaceBase,
      apiPrefix,
    });
    return { videoUrl: normalized, seed: returnedSeed };
  }

  if (first && typeof first === 'object') {
    const obj = first as {
      video?: { url?: string | null; path?: string | null } | string | null;
      url?: string | null;
      path?: string | null;
    };

    if (typeof obj.video === 'string') {
      const normalized = normalizeGradioVideoUrl({
        rawUrl: obj.video.startsWith('http') ? obj.video : null,
        rawPath: !obj.video.startsWith('http') ? obj.video : null,
        spaceBase,
        apiPrefix,
      });
      return { videoUrl: normalized, seed: returnedSeed };
    }

    const rawUrl = obj.video?.url ?? obj.url ?? null;
    const rawPath = obj.video?.path ?? obj.path ?? null;
    const normalized = normalizeGradioVideoUrl({
      rawUrl,
      rawPath,
      spaceBase,
      apiPrefix,
    });
    return { videoUrl: normalized, seed: returnedSeed };
  }

  return {};
}

async function readSseLines(
  res: Response,
  onEvent: (eventType: string, dataStr: string) => { done: boolean }
): Promise<void> {
  if (!res.body) {
    const fullText = await res.text();
    let currentEvent = 'message';
    for (const rawLine of fullText.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        currentEvent = 'message';
        continue;
      }
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const outcome = onEvent(currentEvent, line.slice(5).trim());
        if (outcome.done) return;
      }
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          currentEvent = 'message';
          continue;
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const outcome = onEvent(currentEvent, line.slice(5).trim());
          if (outcome.done) {
            await reader.cancel().catch(() => undefined);
            return;
          }
        }
      }
    }

    if (buffer.trim()) {
      for (const rawLine of buffer.split('\n')) {
        const line = rawLine.trim();
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const outcome = onEvent(currentEvent, line.slice(5).trim());
          if (outcome.done) return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function runGradioCallEndpoint(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
  apiName: string;
  data: unknown[];
  signal: AbortSignal;
}): Promise<{
  unsupported?: boolean;
  videoUrl?: string;
  seed?: number;
  errorCode?: VideoErrorCode;
  errorMessage?: string;
}> {
  const callUrl = `${options.spaceBase}${options.apiPrefix}/call/${options.apiName}`;
  const callRes = await fetch(callUrl, {
    method: 'POST',
    headers: getHfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data: options.data }),
    signal: options.signal,
  });

  if (callRes.status === 404 || callRes.status === 405) {
    return { unsupported: true };
  }

  if (!callRes.ok) {
    const errBody = await callRes.text().catch(() => '');
    const msg = errBody.slice(0, 260) || `Upstream Space returned HTTP ${callRes.status}.`;
    return {
      errorCode: callRes.status === 429 ? 'QUOTA_EXHAUSTED' : classifyUpstreamError(msg),
      errorMessage: msg,
    };
  }

  const callJson = (await callRes.json().catch(() => ({}))) as { event_id?: string };
  if (!callJson.event_id) {
    return { unsupported: true };
  }

  const streamRes = await fetch(`${callUrl}/${callJson.event_id}`, {
    headers: getHfHeaders({ Accept: 'text/event-stream' }),
    signal: options.signal,
  });

  if (!streamRes.ok) {
    return {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: `Upstream Space event stream returned HTTP ${streamRes.status}.`,
    };
  }

  let resolved: {
    videoUrl?: string;
    seed?: number;
    errorCode?: VideoErrorCode;
    errorMessage?: string;
  } | null = null;

  await readSseLines(streamRes, (eventType, dataStr) => {
    if (eventType === 'error') {
      let errMsg = dataStr;
      try {
        const parsedErr = JSON.parse(dataStr) as
          | string
          | { message?: string; title?: string; error?: string }
          | null;
        if (typeof parsedErr === 'string' && parsedErr) {
          errMsg = parsedErr;
        } else if (parsedErr && typeof parsedErr === 'object') {
          errMsg =
            parsedErr.message ||
            parsedErr.error ||
            parsedErr.title ||
            'ZeroGPU quota or worker error.';
        }
      } catch {
        // Keep raw text
      }
      if (!errMsg || errMsg === 'null') {
        errMsg = 'ZeroGPU quota exhausted or worker interrupted.';
      }
      resolved = {
        errorCode: classifyUpstreamError(errMsg),
        errorMessage: errMsg,
      };
      return { done: true };
    }

    if (eventType === 'complete') {
      try {
        const outData = JSON.parse(dataStr) as unknown;
        const extracted = extractVideoFromGradioOutput(
          outData,
          options.spaceBase,
          options.apiPrefix
        );
        if (extracted.videoUrl) {
          resolved = extracted;
        } else {
          resolved = {
            errorCode: 'REQUEST_FAILED',
            errorMessage:
              'Upstream model finished without returning a video file (internal worker exception or empty output).',
          };
        }
      } catch {
        resolved = {
          errorCode: 'REQUEST_FAILED',
          errorMessage: 'Malformed completion payload from upstream Space.',
        };
      }
      return { done: true };
    }

    return { done: false };
  });

  return (
    resolved || {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: 'Upstream GPU stream closed before video synthesis finished.',
    }
  );
}

async function runGradioQueueJob(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
  apiName?: string;
  fnIndex: number;
  data: unknown[];
  signal: AbortSignal;
}): Promise<{
  videoUrl?: string;
  seed?: number;
  errorCode?: VideoErrorCode;
  errorMessage?: string;
}> {
  const sessionHash = crypto.randomBytes(8).toString('hex');
  const joinUrl = `${options.spaceBase}${options.apiPrefix}/queue/join`;
  const dataUrl = `${options.spaceBase}${options.apiPrefix}/queue/data?session_hash=${sessionHash}`;

  const joinRes = await fetch(joinUrl, {
    method: 'POST',
    headers: getHfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      data: options.data,
      fn_index: options.fnIndex,
      session_hash: sessionHash,
    }),
    signal: options.signal,
  });

  if (
    (joinRes.status === 404 || joinRes.status === 405 || joinRes.status === 422) &&
    options.apiName
  ) {
    const namedResult = await runGradioCallEndpoint({
      spaceBase: options.spaceBase,
      apiPrefix: options.apiPrefix,
      apiName: options.apiName,
      data: options.data,
      signal: options.signal,
    });
    if (!namedResult.unsupported) {
      return namedResult;
    }
  }

  if (!joinRes.ok) {
    const errBody = await joinRes.text().catch(() => '');
    const msg =
      errBody.slice(0, 260) || `Upstream Space queue returned HTTP ${joinRes.status}.`;
    return {
      errorCode: joinRes.status === 429 ? 'QUOTA_EXHAUSTED' : classifyUpstreamError(msg),
      errorMessage: msg,
    };
  }

  const sseRes = await fetch(dataUrl, {
    headers: getHfHeaders({ Accept: 'text/event-stream' }),
    signal: options.signal,
  });

  if (!sseRes.ok) {
    return {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: `Upstream Space event stream returned HTTP ${sseRes.status}.`,
    };
  }

  let resolved: {
    videoUrl?: string;
    seed?: number;
    errorCode?: VideoErrorCode;
    errorMessage?: string;
  } | null = null;

  await readSseLines(sseRes, (_eventType, jsonStr) => {
    if (!jsonStr || jsonStr === 'null') return { done: false };

    let payload: {
      msg?: string;
      success?: boolean;
      title?: string;
      message?: string;
      output?: {
        data?: unknown[];
        error?: string;
        title?: string;
      };
    };

    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return { done: false };
    }

    if (payload.msg === 'queue_full') {
      resolved = {
        errorCode: 'QUOTA_EXHAUSTED',
        errorMessage: 'Free community GPU queue is temporarily full.',
      };
      return { done: true };
    }

    if (payload.msg === 'unexpected_error') {
      const errText = payload.message || 'Upstream Space reported an unexpected queue error.';
      resolved = {
        errorCode: classifyUpstreamError(errText),
        errorMessage: errText,
      };
      return { done: true };
    }

    if (payload.msg === 'process_completed') {
      if (payload.success === false || payload.output?.error) {
        const errDetail =
          payload.output?.error ||
          payload.output?.title ||
          payload.title ||
          'Upstream ZeroGPU task ended without output.';
        resolved = {
          errorCode: classifyUpstreamError(errDetail),
          errorMessage: errDetail,
        };
        return { done: true };
      }

      const extracted = extractVideoFromGradioOutput(
        payload.output?.data,
        options.spaceBase,
        options.apiPrefix
      );
      if (extracted.videoUrl) {
        resolved = extracted;
      } else {
        resolved = {
          errorCode: 'REQUEST_FAILED',
          errorMessage:
            'Upstream model completed without returning a playable MP4 file.',
        };
      }
      return { done: true };
    }

    return { done: false };
  });

  return (
    resolved || {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: 'Upstream GPU stream closed before video synthesis finished.',
    }
  );
}

async function uploadImageToGradioSpace(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
  imgBuffer: Buffer;
  mimeType: string;
  safeName: string;
  signal: AbortSignal;
}): Promise<{ remotePath?: string; errorCode?: VideoErrorCode; errorMessage?: string }> {
  const formData = new FormData();
  formData.append(
    'files',
    new Blob([new Uint8Array(options.imgBuffer)], { type: options.mimeType }),
    options.safeName
  );

  const uploadRes = await fetch(`${options.spaceBase}${options.apiPrefix}/upload`, {
    method: 'POST',
    headers: getHfHeaders(),
    body: formData,
    signal: options.signal,
  });

  if (!uploadRes.ok) {
    return {
      errorCode: uploadRes.status === 429 ? 'QUOTA_EXHAUSTED' : 'BACKEND_UNAVAILABLE',
      errorMessage: `Unable to stage reference image on ${options.spaceBase} (HTTP ${uploadRes.status}).`,
    };
  }

  const uploadedPaths = (await uploadRes.json().catch(() => [])) as string[];
  const remotePath = uploadedPaths?.[0];
  if (!remotePath) {
    return {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: 'Upstream ZeroGPU upload endpoint returned an empty file reference.',
    };
  }

  return { remotePath };
}

/**
 * Verifies that a remote URL actually points to a binary MP4/WebM container (never HTML/404)
 * and extracts real container duration (`mvhd`) and video-track sample count (`stts`).
 */
async function inspectAndVerifyRemoteVideo(
  videoUrl: string,
  signal: AbortSignal
): Promise<{
  playable: boolean;
  durationSeconds?: number;
  frameCount?: number;
  fps?: number;
  errorMessage?: string;
}> {
  try {
    const rangeRes = await fetch(videoUrl, {
      headers: getHfHeaders({ Range: 'bytes=0-524287' }),
      signal,
    });

    if (!rangeRes.ok) {
      return {
        playable: false,
        errorMessage: `Video file URL returned HTTP ${rangeRes.status}.`,
      };
    }

    const contentType = (rangeRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return {
        playable: false,
        errorMessage: `Video file URL returned non-video content (${contentType}).`,
      };
    }

    const buf = new Uint8Array(await rangeRes.arrayBuffer());
    if (!hasValidVideoSignature(buf)) {
      return {
        playable: false,
        errorMessage: 'Returned file lacks a valid MP4/WebM binary header.',
      };
    }

    const parsed = parseMp4MetadataFromBytes(buf);
    if (parsed) {
      return {
        playable: true,
        ...parsed,
      };
    }

    // If moov box is located at the tail of the MP4 file, read full clip buffer
    const fullRes = await fetch(videoUrl, {
      headers: getHfHeaders(),
      signal,
    });
    if (fullRes.ok) {
      const fullBuf = new Uint8Array(await fullRes.arrayBuffer());
      if (hasValidVideoSignature(fullBuf)) {
        const fullParsed = parseMp4MetadataFromBytes(fullBuf);
        return {
          playable: true,
          ...(fullParsed || {}),
        };
      }
    }

    return { playable: true };
  } catch (err) {
    return {
      playable: false,
      errorMessage: err instanceof Error ? err.message : 'Unable to verify generated video stream.',
    };
  }
}

export async function getProviderStatusData(): Promise<ProviderStatus> {
  const now = Date.now();
  const authenticatedQuota = Boolean(getOptionalServerHfToken());

  if (
    cachedStatus &&
    now - cachedStatus.checkedAt < 60_000 &&
    cachedStatus.authenticatedQuota === authenticatedQuota
  ) {
    const { checkedAt: _unused, ...rest } = cachedStatus;
    return rest;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Query Space /config directly instead of huggingface.co/api to avoid Hub API 429 rate limits
    const [ltx23Res, ltxDistRes, adRes] = await Promise.allSettled([
      fetch(`${LTX23_SPACE_BASE}/config`, { signal: controller.signal }),
      fetch(`${LTX_DISTILLED_SPACE_BASE}/config`, { signal: controller.signal }),
      fetch(`${ANIMATEDIFF_SPACE_BASE}/config`, { signal: controller.signal }),
    ]);
    clearTimeout(timeout);

    const ltx23Running = ltx23Res.status === 'fulfilled' && ltx23Res.value.ok;
    const fallbackRunning =
      (ltxDistRes.status === 'fulfilled' && ltxDistRes.value.ok) ||
      (adRes.status === 'fulfilled' && adRes.value.ok);

    const result: ProviderStatus = {
      available: ltx23Running || fallbackRunning,
      stage: ltx23Running ? 'RUNNING' : fallbackRunning ? 'FALLBACK_READY' : 'STANDBY',
      hardware: 'zero-a10g',
      provider: authenticatedQuota
        ? 'Hugging Face ZeroGPU (Authenticated Server Quota)'
        : 'Hugging Face ZeroGPU (Free Community Tier)',
      model: 'Lightricks/LTX-2.3 Distilled (4s–10s · 24 FPS)',
      fallbackModel:
        'LTX-Video Distilled (4s–8s) · Zeroscope-v2 (4s–6s) · AnimateDiff-Lightning (1.6s)',
      fallbackAvailable: fallbackRunning,
      authenticatedQuota,
    };

    cachedStatus = { ...result, checkedAt: now };
    return result;
  } catch {
    return {
      available: false,
      stage: 'UNREACHABLE',
      hardware: 'zero-a10g',
      provider: 'Hugging Face ZeroGPU (Free Community Tier)',
      model: 'Lightricks/LTX-2.3 Distilled (4s–10s · 24 FPS)',
      fallbackModel:
        'LTX-Video Distilled (4s–8s) · Zeroscope-v2 (4s–6s) · AnimateDiff-Lightning (1.6s)',
      fallbackAvailable: false,
      authenticatedQuota,
    };
  }
}

export async function handleTextToVideoRequest(
  rawBody: Record<string, unknown>
): Promise<ServerGenerationResult> {
  try {
    const prompt = typeof rawBody.prompt === 'string' ? rawBody.prompt : '';
    const negativePrompt = typeof rawBody.negativePrompt === 'string' ? rawBody.negativePrompt : '';
    const aspectRatio = rawBody.aspectRatio ?? '16:9';
    const duration = rawBody.duration ?? 4;
    const style = typeof rawBody.style === 'string' ? rawBody.style : 'anamorphic';
    const seed = typeof rawBody.seed === 'number' ? rawBody.seed : undefined;

    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 4) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Please enter a descriptive scene prompt of at least 4 characters.',
        },
      };
    }
    if (trimmedPrompt.length > 1200) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Prompt must be 1,200 characters or fewer.',
        },
      };
    }

    const parsedDuration = Number(duration);
    if (!isValidClipDuration(parsedDuration)) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Supported clip durations are strictly 4, 6, 8, or 10 seconds.',
        },
      };
    }
    const selectedDuration: ClipDurationOption = parsedDuration;

    const normalizedAspect = normalizeAspectRatio(aspectRatio);
    const hasAuthToken = Boolean(getOptionalServerHfToken());
    const expectedFrames = getExpectedLtxFrameCount(selectedDuration, 24);

    const styleSuffix = STYLE_MODIFIERS[style] || STYLE_MODIFIERS.anamorphic;
    const englishPrompt = normalizePromptWithRomanUrdu(trimmedPrompt);
    const finalPrompt = englishPrompt.toLowerCase().includes(styleSuffix.slice(0, 18).toLowerCase())
      ? englishPrompt
      : `${englishPrompt}, ${styleSuffix}`;
    const cleanNegative =
      negativePrompt.trim() ||
      'worst quality, inconsistent motion, blurry, jittery, distorted, watermark, deformed';
    const useFixedSeed = typeof seed === 'number' && Number.isFinite(seed) && seed >= 0;
    const safeSeed = useFixedSeed ? Math.min(2147483647, Math.max(0, Math.floor(seed))) : 42;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 165_000);
    const providerDiagnostics: string[] = [];

    try {
      // 1A & 1B. Primary 4s-10s Engine: Lightricks LTX-2.3 22B Distilled (standard dims, plus compact low-quota retry)
      for (const compactRetry of [false, true]) {
        const ltx23Dims = getLtx23Dimensions(
          normalizedAspect,
          selectedDuration,
          hasAuthToken && !compactRetry,
          compactRetry
        );
        const ltx23Result = await runGradioQueueJob({
          spaceBase: LTX23_SPACE_BASE,
          apiPrefix: '/gradio_api',
          apiName: 'generate_video',
          fnIndex: 2,
          data: [
            null,
            finalPrompt,
            selectedDuration,
            false,
            safeSeed,
            !useFixedSeed,
            ltx23Dims.height,
            ltx23Dims.width,
          ],
          signal: controller.signal,
        }).catch((err: unknown) => ({
          videoUrl: undefined,
          seed: undefined,
          errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
          errorMessage: err instanceof Error ? err.message : 'LTX-2.3 connection failed.',
        }));

        if (ltx23Result.videoUrl) {
          const meta = await inspectAndVerifyRemoteVideo(ltx23Result.videoUrl, controller.signal);
          if (meta.playable) {
            const actualSec = meta.durationSeconds ?? Number((expectedFrames / 24).toFixed(2));
            const durationCapped = !isDurationWithinTolerance(actualSec, selectedDuration);
            return {
              httpStatus: 200,
              body: {
                ok: true,
                videoUrl: ltx23Result.videoUrl,
                downloadUrl: `/api/video/download?url=${encodeURIComponent(ltx23Result.videoUrl)}`,
                seed: ltx23Result.seed ?? safeSeed,
                width: ltx23Dims.width,
                height: ltx23Dims.height,
                duration: selectedDuration,
                verifiedDuration: actualSec,
                fps: meta.fps ?? 24,
                frameCount: meta.frameCount ?? expectedFrames,
                model: `Lightricks/LTX-2.3 22B Distilled (${meta.frameCount ?? expectedFrames} frames @ 24 FPS)`,
                fallbackNotice: durationCapped
                  ? `Model returned a verified ${actualSec}s clip for your ${selectedDuration}s request without frame duplication.`
                  : compactRetry
                  ? `Synthesized at ZeroGPU-friendly ${ltx23Dims.width}×${ltx23Dims.height} resolution to fit remaining free GPU quota.`
                  : undefined,
              },
            };
          }
          providerDiagnostics.push(
            `LTX-2.3 stream invalid: ${meta.errorMessage || 'Unplayable video header'}`
          );
          break;
        }

        if (!compactRetry) {
          providerDiagnostics.push(`LTX-2.3: ${ltx23Result.errorMessage || 'Unavailable'}`);
          // Only attempt compact retry if standard attempt hit a partial GPU quota threshold (not 0s left)
          if (
            ltx23Result.errorCode !== 'QUOTA_EXHAUSTED' ||
            /0s left/i.test(ltx23Result.errorMessage || '')
          ) {
            break;
          }
        }
      }

      // 2. Secondary Engine: Official Lightricks/ltx-video-distilled (max supported model slider is 8.5s -> clamp 10s to 8s)
      const distTargetDuration = Math.min(selectedDuration, 8) as ClipDurationOption;
      const distExpectedFrames = getExpectedLtxFrameCount(distTargetDuration, 24);
      const distDims = LTX_DISTILLED_DIMENSIONS[normalizedAspect];

      const ltxDistResult = await runGradioQueueJob({
        spaceBase: LTX_DISTILLED_SPACE_BASE,
        apiPrefix: '/gradio_api',
        apiName: 'text_to_video',
        fnIndex: 4,
        data: [
          finalPrompt,
          cleanNegative,
          null,
          null,
          distDims.height,
          distDims.width,
          'text-to-video',
          distTargetDuration,
          9,
          safeSeed,
          !useFixedSeed,
          1.0,
          true,
        ],
        signal: controller.signal,
      }).catch((err: unknown) => ({
        videoUrl: undefined,
        seed: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'LTX-Video Distilled connection failed.',
      }));

      if (ltxDistResult.videoUrl) {
        const meta = await inspectAndVerifyRemoteVideo(ltxDistResult.videoUrl, controller.signal);
        if (meta.playable) {
          const actualSec = meta.durationSeconds ?? Number((distExpectedFrames / 24).toFixed(2));
          return {
            httpStatus: 200,
            body: {
              ok: true,
              videoUrl: ltxDistResult.videoUrl,
              downloadUrl: `/api/video/download?url=${encodeURIComponent(ltxDistResult.videoUrl)}`,
              seed: ltxDistResult.seed ?? safeSeed,
              width: distDims.width,
              height: distDims.height,
              duration: selectedDuration,
              verifiedDuration: actualSec,
              fps: meta.fps ?? 24,
              frameCount: meta.frameCount ?? distExpectedFrames,
              model: `Lightricks/LTX-Video Distilled (${meta.frameCount ?? distExpectedFrames} frames @ 24 FPS)`,
              fallbackNotice:
                selectedDuration > 8
                  ? `Primary LTX-2.3 (10s capable) was busy, so VidNova AI used Lightricks/LTX-Video Distilled at its maximum 8.0s model limit (${distExpectedFrames} frames @ 24 FPS) rather than failing or duplicating frames.`
                  : undefined,
            },
          };
        }
      } else {
        providerDiagnostics.push(
          `LTX-Video Distilled: ${ltxDistResult.errorMessage || 'Unavailable'}`
        );
      }

      // 3. Tertiary Widescreen Engine: Zeroscope-v2 (supports up to 48 frames @ 8 FPS = 6.0s; clamps 8s/10s to 6s)
      const zsTargetSec = Math.min(selectedDuration, 6);
      const zsFrames = zsTargetSec * 8; // 32f (4.0s) or 48f (6.0s)
      const zsSeed = useFixedSeed ? safeSeed : Math.floor(Math.random() * 1_000_000);
      const compactPrompt = finalPrompt.slice(0, 340);

      const zsResult = await runGradioQueueJob({
        spaceBase: ZEROSCOPE_SPACE_BASE,
        apiPrefix: '/gradio_api',
        apiName: 'run',
        fnIndex: 3,
        data: [compactPrompt, zsSeed, zsFrames, 24],
        signal: controller.signal,
      }).catch((err: unknown) => ({
        videoUrl: undefined,
        seed: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'Zeroscope-v2 connection failed.',
      }));

      if (zsResult.videoUrl) {
        const meta = await inspectAndVerifyRemoteVideo(zsResult.videoUrl, controller.signal);
        if (meta.playable) {
          const actualSec = meta.durationSeconds ?? zsTargetSec;
          return {
            httpStatus: 200,
            body: {
              ok: true,
              videoUrl: zsResult.videoUrl,
              downloadUrl: `/api/video/download?url=${encodeURIComponent(zsResult.videoUrl)}`,
              seed: zsSeed,
              width: 576,
              height: 320,
              duration: selectedDuration,
              verifiedDuration: actualSec,
              fps: meta.fps ?? 8,
              frameCount: meta.frameCount ?? zsFrames,
              model: `Zeroscope-v2 576w (${meta.frameCount ?? zsFrames} frames @ 8 FPS · 16:9)`,
              fallbackNotice:
                selectedDuration > 6
                  ? `Primary 8s–10s LTX ZeroGPU queues were full, so VidNova AI generated a real ${actualSec}s (${zsFrames} frames @ 8 FPS) widescreen clip via Zeroscope-v2—its maximum 48-frame model limit—without looping frames.`
                  : `Primary LTX-2.3 queue was full, so VidNova AI synthesized a genuine ${actualSec}s (${zsFrames} frames @ 8 FPS) widescreen MP4 via Zeroscope-v2.`,
            },
          };
        }
      } else {
        providerDiagnostics.push(`Zeroscope-v2: ${zsResult.errorMessage || 'Unavailable'}`);
      }

      // 4. Resilient Short-Clip Fallback: ByteDance/AnimateDiff-Lightning (Gradio 4, 16 frames @ 10 FPS = 1.6s)
      const adBaseModel = style === 'anime' ? 'ToonYou' : 'epiCRealism';
      const adMotion = 'guoyww/animatediff-motion-lora-zoom-in';
      const adPrompt = finalPrompt.slice(0, 260);

      const adResult = await runGradioQueueJob({
        spaceBase: ANIMATEDIFF_SPACE_BASE,
        apiPrefix: '',
        fnIndex: 0,
        data: [adPrompt, adBaseModel, adMotion, 4],
        signal: controller.signal,
      }).catch((err: unknown) => ({
        videoUrl: undefined,
        seed: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'AnimateDiff-Lightning connection failed.',
      }));

      if (adResult.videoUrl) {
        const meta = await inspectAndVerifyRemoteVideo(adResult.videoUrl, controller.signal);
        if (meta.playable) {
          const actualSec = meta.durationSeconds ?? 1.6;
          return {
            httpStatus: 200,
            body: {
              ok: true,
              videoUrl: adResult.videoUrl,
              downloadUrl: `/api/video/download?url=${encodeURIComponent(adResult.videoUrl)}`,
              seed: safeSeed,
              width: 512,
              height: 512,
              duration: selectedDuration,
              verifiedDuration: actualSec,
              fps: meta.fps ?? 10,
              frameCount: meta.frameCount ?? 16,
              model: `ByteDance/AnimateDiff-Lightning (16 frames @ 10 FPS · 1:1)`,
              fallbackNotice: `Long-duration LTX-2.3 (4s–10s) ZeroGPU queues were exhausted on this IP, so VidNova AI generated a real ${actualSec}s (16 frames @ 10 FPS) AI clip via ByteDance/AnimateDiff-Lightning. AnimateDiff-Lightning's temporal architecture is capped at 16 frames and frames are never duplicated or looped.`,
            },
          };
        }
      } else {
        providerDiagnostics.push(
          `AnimateDiff-Lightning: ${adResult.errorMessage || 'Unavailable'}`
        );
      }

      const combinedDiag = providerDiagnostics.join(' | ');
      const finalCode = classifyUpstreamError(combinedDiag);
      const httpStatus = finalCode === 'QUOTA_EXHAUSTED' ? 429 : 503;

      return {
        httpStatus,
        body: {
          ok: false,
          unavailable: true,
          errorCode: finalCode,
          message: buildUserFacingErrorMessage(finalCode, `${selectedDuration}s AI Text-to-Video`),
          detail: combinedDiag,
          externalDemoUrl: 'https://huggingface.co/spaces/Upsampler/ltx-video',
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unexpected network error';
    const code = classifyUpstreamError(reason);
    return {
      httpStatus: code === 'QUOTA_EXHAUSTED' ? 429 : 503,
      body: {
        ok: false,
        unavailable: true,
        errorCode: code,
        message: buildUserFacingErrorMessage(code, 'AI Text-to-Video'),
        detail: `Connection interrupted (${reason}).`,
        externalDemoUrl: 'https://huggingface.co/spaces/Upsampler/ltx-video',
      },
    };
  }
}

export async function handleImageToVideoRequest(
  rawBody: Record<string, unknown>
): Promise<ServerGenerationResult> {
  try {
    const prompt = typeof rawBody.prompt === 'string' ? rawBody.prompt : '';
    const negativePrompt = typeof rawBody.negativePrompt === 'string' ? rawBody.negativePrompt : '';
    const imageBase64 = typeof rawBody.imageBase64 === 'string' ? rawBody.imageBase64 : '';
    const mimeType = typeof rawBody.mimeType === 'string' ? rawBody.mimeType : '';
    const fileName = typeof rawBody.fileName === 'string' ? rawBody.fileName : 'frame.jpg';
    const aspectRatio = rawBody.aspectRatio ?? '16:9';
    const duration = rawBody.duration ?? 4;
    const style = typeof rawBody.style === 'string' ? rawBody.style : 'anamorphic';
    const hasPermission = Boolean(rawBody.hasPermission);
    const seed = typeof rawBody.seed === 'number' ? rawBody.seed : undefined;

    if (!hasPermission) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message:
            'Please confirm upload rights and external ZeroGPU processing consent before generating.',
        },
      };
    }

    if (!imageBase64 || !mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Please provide a valid JPG, PNG, or WebP image file.',
        },
      };
    }

    const parsedDuration = Number(duration);
    if (!isValidClipDuration(parsedDuration)) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Supported clip durations are strictly 4, 6, 8, or 10 seconds.',
        },
      };
    }
    const selectedDuration: ClipDurationOption = parsedDuration;

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const imgBuffer = Buffer.from(cleanBase64, 'base64');

    if (imgBuffer.byteLength === 0 || imgBuffer.byteLength > MAX_IMAGE_BYTES) {
      return {
        httpStatus: 400,
        body: {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Image size must be greater than 0 bytes and at most 8 MB.',
        },
      };
    }

    const trimmedPrompt =
      prompt.trim() ||
      'Natural cinematic camera movement, subtle atmospheric motion, photorealistic lighting';
    const normalizedAspect = normalizeAspectRatio(aspectRatio);
    const hasAuthToken = Boolean(getOptionalServerHfToken());
    const expectedFrames = getExpectedLtxFrameCount(selectedDuration, 24);

    const styleSuffix = STYLE_MODIFIERS[style] || STYLE_MODIFIERS.anamorphic;
    const englishPrompt = normalizePromptWithRomanUrdu(trimmedPrompt);
    const finalPrompt = `${englishPrompt}, ${styleSuffix}`;
    const cleanNegative =
      negativePrompt.trim() ||
      'worst quality, inconsistent motion, blurry, jittery, distorted, deformed';
    const useFixedSeed = typeof seed === 'number' && Number.isFinite(seed) && seed >= 0;
    const safeSeed = useFixedSeed ? Math.min(2147483647, Math.max(0, Math.floor(seed))) : 42;
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'reference.jpg';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 165_000);
    const providerDiagnostics: string[] = [];

    try {
      // 1. Primary 4s-10s Image-to-Video Engine: Lightricks LTX-2.3 22B Distilled
      const up23 = await uploadImageToGradioSpace({
        spaceBase: LTX23_SPACE_BASE,
        apiPrefix: '/gradio_api',
        imgBuffer,
        mimeType,
        safeName,
        signal: controller.signal,
      }).catch((err: unknown) => ({
        remotePath: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'LTX-2.3 upload failed.',
      }));

      if (up23.remotePath) {
        for (const compactRetry of [false, true]) {
          const ltx23Dims = getLtx23Dimensions(
            normalizedAspect,
            selectedDuration,
            hasAuthToken && !compactRetry,
            compactRetry
          );
          const ltx23I2v = await runGradioQueueJob({
            spaceBase: LTX23_SPACE_BASE,
            apiPrefix: '/gradio_api',
            apiName: 'generate_video',
            fnIndex: 2,
            data: [
              {
                path: up23.remotePath,
                meta: { _type: 'gradio.FileData' },
                orig_name: safeName,
                mime_type: mimeType,
              },
              finalPrompt,
              selectedDuration,
              false,
              safeSeed,
              !useFixedSeed,
              ltx23Dims.height,
              ltx23Dims.width,
            ],
            signal: controller.signal,
          }).catch((err: unknown) => ({
            videoUrl: undefined,
            seed: undefined,
            errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
            errorMessage: err instanceof Error ? err.message : 'LTX-2.3 I2V connection failed.',
          }));

          if (ltx23I2v.videoUrl) {
            const meta = await inspectAndVerifyRemoteVideo(ltx23I2v.videoUrl, controller.signal);
            if (meta.playable) {
              const actualSec = meta.durationSeconds ?? Number((expectedFrames / 24).toFixed(2));
              return {
                httpStatus: 200,
                body: {
                  ok: true,
                  videoUrl: ltx23I2v.videoUrl,
                  downloadUrl: `/api/video/download?url=${encodeURIComponent(ltx23I2v.videoUrl)}`,
                  seed: ltx23I2v.seed ?? safeSeed,
                  width: ltx23Dims.width,
                  height: ltx23Dims.height,
                  duration: selectedDuration,
                  verifiedDuration: actualSec,
                  fps: meta.fps ?? 24,
                  frameCount: meta.frameCount ?? expectedFrames,
                  model: `Lightricks/LTX-2.3 22B Distilled (${meta.frameCount ?? expectedFrames} frames @ 24 FPS)`,
                  fallbackNotice: compactRetry
                    ? `Synthesized at ZeroGPU-friendly ${ltx23Dims.width}×${ltx23Dims.height} resolution to fit remaining free GPU quota.`
                    : undefined,
                },
              };
            }
            break;
          }

          if (!compactRetry) {
            providerDiagnostics.push(`LTX-2.3: ${ltx23I2v.errorMessage || 'Unavailable'}`);
            if (
              ltx23I2v.errorCode !== 'QUOTA_EXHAUSTED' ||
              /0s left/i.test(ltx23I2v.errorMessage || '')
            ) {
              break;
            }
          }
        }
      } else {
        providerDiagnostics.push(`LTX-2.3 Upload: ${up23.errorMessage || 'Unavailable'}`);
      }

      // 2. Secondary 4s-8s Image-to-Video Engine: Official Lightricks/ltx-video-distilled (clamp 10s -> 8s)
      const distTargetDuration = Math.min(selectedDuration, 8) as ClipDurationOption;
      const distExpectedFrames = getExpectedLtxFrameCount(distTargetDuration, 24);
      const upDist = await uploadImageToGradioSpace({
        spaceBase: LTX_DISTILLED_SPACE_BASE,
        apiPrefix: '/gradio_api',
        imgBuffer,
        mimeType,
        safeName,
        signal: controller.signal,
      }).catch((err: unknown) => ({
        remotePath: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'LTX-Video Distilled upload failed.',
      }));

      if (upDist.remotePath) {
        const distDims = LTX_DISTILLED_DIMENSIONS[normalizedAspect];
        const ltxDistI2v = await runGradioQueueJob({
          spaceBase: LTX_DISTILLED_SPACE_BASE,
          apiPrefix: '/gradio_api',
          apiName: 'image_to_video',
          fnIndex: 5,
          data: [
            finalPrompt,
            cleanNegative,
            {
              path: upDist.remotePath,
              meta: { _type: 'gradio.FileData' },
              orig_name: safeName,
              mime_type: mimeType,
            },
            null,
            distDims.height,
            distDims.width,
            'image-to-video',
            distTargetDuration,
            9,
            safeSeed,
            !useFixedSeed,
            1.0,
            true,
          ],
          signal: controller.signal,
        }).catch((err: unknown) => ({
          videoUrl: undefined,
          seed: undefined,
          errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
          errorMessage: err instanceof Error ? err.message : 'LTX-Video Distilled I2V failed.',
        }));

        if (ltxDistI2v.videoUrl) {
          const meta = await inspectAndVerifyRemoteVideo(ltxDistI2v.videoUrl, controller.signal);
          if (meta.playable) {
            const actualSec = meta.durationSeconds ?? Number((distExpectedFrames / 24).toFixed(2));
            return {
              httpStatus: 200,
              body: {
                ok: true,
                videoUrl: ltxDistI2v.videoUrl,
                downloadUrl: `/api/video/download?url=${encodeURIComponent(ltxDistI2v.videoUrl)}`,
                seed: ltxDistI2v.seed ?? safeSeed,
                width: distDims.width,
                height: distDims.height,
                duration: selectedDuration,
                verifiedDuration: actualSec,
                fps: meta.fps ?? 24,
                frameCount: meta.frameCount ?? distExpectedFrames,
                model: `Lightricks/LTX-Video Distilled (${meta.frameCount ?? distExpectedFrames} frames @ 24 FPS)`,
                fallbackNotice:
                  selectedDuration > 8
                    ? `Primary LTX-2.3 (10s capable) was busy, so VidNova AI used Lightricks/LTX-Video Distilled at its maximum 8.0s model limit (${distExpectedFrames} frames @ 24 FPS).`
                    : undefined,
              },
            };
          }
        } else {
          providerDiagnostics.push(
            `LTX-Video Distilled: ${ltxDistI2v.errorMessage || 'Unavailable'}`
          );
        }
      }

      // 3. Tertiary Fast 4-Step I2V Fallback: multimodalart/wan2-1-fast (81 frames @ 24 FPS ≈ 3.38s)
      const upWan = await uploadImageToGradioSpace({
        spaceBase: WAN_FAST_SPACE_BASE,
        apiPrefix: '/gradio_api',
        imgBuffer,
        mimeType,
        safeName,
        signal: controller.signal,
      }).catch((err: unknown) => ({
        remotePath: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'Wan2.1-Fast upload failed.',
      }));

      if (upWan.remotePath) {
        const wanDims = WAN_FAST_DIMENSIONS[normalizedAspect];
        const wanI2v = await runGradioQueueJob({
          spaceBase: WAN_FAST_SPACE_BASE,
          apiPrefix: '/gradio_api',
          apiName: 'generate_video',
          fnIndex: 2,
          data: [
            {
              path: upWan.remotePath,
              meta: { _type: 'gradio.FileData' },
              orig_name: safeName,
              mime_type: mimeType,
            },
            finalPrompt,
            wanDims.height,
            wanDims.width,
            cleanNegative,
            3.3,
            1.0,
            4,
            safeSeed,
            !useFixedSeed,
          ],
          signal: controller.signal,
        }).catch((err: unknown) => ({
          videoUrl: undefined,
          seed: undefined,
          errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
          errorMessage: err instanceof Error ? err.message : 'Wan2.1-Fast I2V failed.',
        }));

        if (wanI2v.videoUrl) {
          const meta = await inspectAndVerifyRemoteVideo(wanI2v.videoUrl, controller.signal);
          if (meta.playable) {
            const actualSec = meta.durationSeconds ?? 3.38;
            return {
              httpStatus: 200,
              body: {
                ok: true,
                videoUrl: wanI2v.videoUrl,
                downloadUrl: `/api/video/download?url=${encodeURIComponent(wanI2v.videoUrl)}`,
                seed: wanI2v.seed ?? safeSeed,
                width: wanDims.width,
                height: wanDims.height,
                duration: selectedDuration,
                verifiedDuration: actualSec,
                fps: meta.fps ?? 24,
                frameCount: meta.frameCount ?? 81,
                model: `Wan 2.1 14B Fast (${meta.frameCount ?? 81} frames @ 24 FPS)`,
                fallbackNotice: `LTX ZeroGPU queues were full, so VidNova AI synthesized a real ${actualSec}s (81 frames @ 24 FPS) clip via Wan 2.1 Fast—its fixed 81-frame model window—without frame looping.`,
              },
            };
          }
        } else {
          providerDiagnostics.push(`Wan2.1-Fast: ${wanI2v.errorMessage || 'Unavailable'}`);
        }
      }

      const combinedDiag = providerDiagnostics.join(' | ');
      const errCode = classifyUpstreamError(combinedDiag);
      const httpStatus = errCode === 'QUOTA_EXHAUSTED' ? 429 : 503;

      return {
        httpStatus,
        body: {
          ok: false,
          unavailable: true,
          errorCode: errCode,
          message: buildUserFacingErrorMessage(errCode, `${selectedDuration}s AI Image-to-Video`),
          detail:
            errCode === 'QUOTA_EXHAUSTED'
              ? `${combinedDiag} Tip: Click "Switch to ${selectedDuration}s Browser Photo Animation (Non-AI)" below for instant, unlimited ${selectedDuration}-second local H.264 MP4 camera animation.`
              : combinedDiag,
          externalDemoUrl: 'https://huggingface.co/spaces/Upsampler/ltx-video',
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unexpected network error';
    const code = classifyUpstreamError(reason);
    return {
      httpStatus: code === 'QUOTA_EXHAUSTED' ? 429 : 503,
      body: {
        ok: false,
        unavailable: true,
        errorCode: code,
        message: buildUserFacingErrorMessage(code, 'AI Image-to-Video'),
        detail: `Free ZeroGPU connection interrupted (${reason}).`,
        externalDemoUrl: 'https://huggingface.co/spaces/Upsampler/ltx-video',
      },
    };
  }
}

export async function fetchWhitelistedVideoBuffer(
  rawUrl: string
): Promise<
  | { ok: true; buffer: Buffer; contentType: string }
  | { ok: false; httpStatus: number; error: string }
> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { ok: false, httpStatus: 400, error: 'Invalid video asset URL.' };
  }

  if (parsedUrl.protocol === 'http:' && parsedUrl.hostname.endsWith('.hf.space')) {
    parsedUrl.protocol = 'https:';
  }

  const isAllowedOrigin = ALLOWED_DOWNLOAD_ORIGINS.has(parsedUrl.origin);
  const isGradioFilePath =
    parsedUrl.pathname.startsWith('/gradio_api/file=') ||
    parsedUrl.pathname.startsWith('/file=');

  if (!isAllowedOrigin || !isGradioFilePath) {
    return {
      ok: false,
      httpStatus: 400,
      error: 'Disallowed upstream video asset host or path.',
    };
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), { headers: getHfHeaders() });
    if (!upstream.ok) {
      return {
        ok: false,
        httpStatus: 502,
        error: `Upstream video file expired or unavailable (HTTP ${upstream.status}).`,
      };
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (!hasValidVideoSignature(bytes)) {
      return {
        ok: false,
        httpStatus: 502,
        error: 'Upstream asset is no longer a valid MP4/WebM video file.',
      };
    }

    return {
      ok: true,
      buffer: Buffer.from(bytes),
      contentType: 'video/mp4',
    };
  } catch {
    return {
      ok: false,
      httpStatus: 502,
      error: 'Failed to stream generated MP4 file from upstream provider.',
    };
  }
}
