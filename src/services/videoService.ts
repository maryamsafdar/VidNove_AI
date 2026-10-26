import type {
  AspectRatioOption,
  ClipDurationOption,
  ProviderStatus,
  VideoErrorCode,
  VisualStyleId,
} from '../types/studio';
import {
  getExpectedLtxFrameCount,
  getLtx23Dimensions,
  hasValidVideoSignature,
  isDurationWithinTolerance,
  isValidClipDuration,
  normalizeClipDuration,
  normalizeGradioVideoUrl,
  parseMp4MetadataFromBytes,
  probeBrowserVideoDuration,
} from '../utils/videoMetadata';

// 1. Primary 4s-10s Open-Weight DiT Engine (LTX-2.3 22B Distilled, 24 FPS: 97/145/193/241 frames)
const LTX23_SPACE_BASE = 'https://upsampler-ltx-video.hf.space';

// 2. Secondary 4s-8s Official Distilled Engine (caps at 8.5s @ 24 FPS)
const LTX_DISTILLED_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space';

// 3. Tertiary 4s-6s Widescreen Engine (24-48 frames @ 8 FPS; caps at 6.0s)
const ZEROSCOPE_SPACE_BASE = 'https://hysts-zeroscope-v2.hf.space';

// 4. Fast 4-Step Image-to-Video Fallback Engine (Wan 2.1 14B Fast, 81 frames @ 24 FPS ≈ 3.38s)
const WAN_FAST_SPACE_BASE = 'https://multimodalart-wan2-1-fast.hf.space';

// 5. Resilient Short-Clip Fallback Engine (ByteDance AnimateDiff-Lightning, 16 frames @ 10 FPS = 1.6s)
const ANIMATEDIFF_SPACE_BASE = 'https://bytedance-animatediff-lightning.hf.space';

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

const STYLE_MODIFIERS: Record<VisualStyleId, string> = {
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

const ROMAN_URDU_CLIENT_LEXICON: Array<{ pattern: RegExp; phrase: string }> = [
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

function normalizePromptClient(rawPrompt: string): string {
  const hits: string[] = [];
  for (const item of ROMAN_URDU_CLIENT_LEXICON) {
    if (item.pattern.test(rawPrompt)) {
      hits.push(item.phrase);
    }
  }
  return hits.length > 0 ? `${hits.join(', ')} (${rawPrompt})` : rawPrompt;
}

export interface GenerationSuccess {
  ok: true;
  videoUrl: string;
  remoteVideoUrl?: string;
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

export interface GenerationFailure {
  ok: false;
  unavailable: boolean;
  errorCode?: VideoErrorCode;
  message: string;
  detail?: string;
  externalDemoUrl?: string;
}

export type GenerationResponse = GenerationSuccess | GenerationFailure;

let backendMetaCache: {
  checkedAt: number;
  hasBackendApi: boolean;
  authenticatedQuota: boolean;
} | null = null;

function createSessionHash(): string {
  return `vn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function classifyError(raw: string): VideoErrorCode {
  if (/quota|exceeded|runs limit|rate limit|too many requests|429|0s left|zero gpu/i.test(raw)) {
    return 'QUOTA_EXHAUSTED';
  }
  if (/paused|sleeping|building|stopped|unreachable|502|503|504|failed to fetch|network|timeout/i.test(raw)) {
    return 'BACKEND_UNAVAILABLE';
  }
  return 'REQUEST_FAILED';
}

export async function fetchProviderStatus(): Promise<ProviderStatus> {
  try {
    const res = await fetch('/api/video/status');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const status = (await res.json()) as ProviderStatus;
      backendMetaCache = {
        checkedAt: Date.now(),
        hasBackendApi: true,
        authenticatedQuota: Boolean(status.authenticatedQuota),
      };
      return status;
    }
  } catch {
    // Fallback to direct Space /config probe when deployed without backend API
  }

  backendMetaCache = {
    checkedAt: Date.now(),
    hasBackendApi: false,
    authenticatedQuota: false,
  };

  try {
    const [ltx23Res, ltxDistRes, adRes] = await Promise.allSettled([
      fetch(`${LTX23_SPACE_BASE}/config`),
      fetch(`${LTX_DISTILLED_SPACE_BASE}/config`),
      fetch(`${ANIMATEDIFF_SPACE_BASE}/config`),
    ]);

    const ltx23Running = ltx23Res.status === 'fulfilled' && ltx23Res.value.ok;
    const fallbackRunning =
      (ltxDistRes.status === 'fulfilled' && ltxDistRes.value.ok) ||
      (adRes.status === 'fulfilled' && adRes.value.ok);

    return {
      available: ltx23Running || fallbackRunning,
      stage: ltx23Running ? 'RUNNING' : fallbackRunning ? 'FALLBACK_READY' : 'STANDBY',
      hardware: 'zero-a10g',
      provider: 'Hugging Face ZeroGPU (Free Community Tier)',
      model: 'Lightricks/LTX-2.3 Distilled (4s–10s · 24 FPS)',
      fallbackModel:
        'LTX-Video Distilled (4s–8s) · Zeroscope-v2 (4s–6s) · AnimateDiff-Lightning (1.6s)',
      fallbackAvailable: fallbackRunning,
      authenticatedQuota: false,
    };
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
      authenticatedQuota: false,
    };
  }
}

async function getBackendMeta(): Promise<{
  hasBackendApi: boolean;
  authenticatedQuota: boolean;
}> {
  if (backendMetaCache && Date.now() - backendMetaCache.checkedAt < 60_000) {
    return backendMetaCache;
  }
  await fetchProviderStatus();
  return (
    backendMetaCache || {
      hasBackendApi: false,
      authenticatedQuota: false,
    }
  );
}

function buildDownloadUrl(videoUrl: string, hasBackendApi: boolean): string {
  if (videoUrl.startsWith('blob:')) {
    return videoUrl;
  }
  if (hasBackendApi) {
    return `/api/video/download?url=${encodeURIComponent(videoUrl)}`;
  }
  return videoUrl;
}

/**
 * Downloads and verifies the generated video into a local browser Blob URL (with MP4 header
 * signature check + container duration parsing + HTMLVideoElement fallback) so no invalid,
 * Mixed-Content, CORS-blocked, or expiring temporary URL ever renders a blank player.
 */
async function hydratePlayableVideoAsset(options: {
  remoteVideoUrl: string;
  hasBackendApi: boolean;
  signal?: AbortSignal;
}): Promise<{
  playable: boolean;
  playbackUrl?: string;
  downloadUrl?: string;
  durationSeconds?: number;
  frameCount?: number;
  fps?: number;
  errorMessage?: string;
}> {
  const { remoteVideoUrl, hasBackendApi, signal } = options;

  const fetchCandidates: string[] = [remoteVideoUrl];
  if (hasBackendApi && remoteVideoUrl.startsWith('https://')) {
    fetchCandidates.push(`/api/video/download?url=${encodeURIComponent(remoteVideoUrl)}&inline=1`);
  }

  for (const candidateUrl of fetchCandidates) {
    try {
      const res = await fetch(candidateUrl, { signal });
      if (!res.ok) continue;

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        continue;
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!hasValidVideoSignature(bytes)) {
        continue;
      }

      const parsed = parseMp4MetadataFromBytes(bytes);
      const blob = new Blob([bytes], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);

      let measuredDuration = parsed?.durationSeconds;
      if (measuredDuration === undefined) {
        const probed = await probeBrowserVideoDuration(blobUrl, 6000);
        if (probed !== null) {
          measuredDuration = probed;
        }
      }

      return {
        playable: true,
        playbackUrl: blobUrl,
        downloadUrl: blobUrl,
        durationSeconds: measuredDuration,
        frameCount: parsed?.frameCount,
        fps: parsed?.fps,
      };
    } catch {
      if (signal?.aborted) {
        return { playable: false, errorMessage: 'Generation cancelled by user.' };
      }
    }
  }

  // Fallback if fetch CORS is restricted on a static host: verify HTMLVideoElement can decode it directly
  const browserSec = await probeBrowserVideoDuration(remoteVideoUrl, 9000);
  if (browserSec !== null && browserSec > 0) {
    return {
      playable: true,
      playbackUrl: remoteVideoUrl,
      downloadUrl: buildDownloadUrl(remoteVideoUrl, hasBackendApi),
      durationSeconds: browserSec,
    };
  }

  return {
    playable: false,
    errorMessage: 'Upstream video file could not be loaded or decoded as a playable MP4.',
  };
}

async function hydrateServerSuccessResponse(
  serverRes: GenerationSuccess,
  hasBackendApi: boolean,
  onStage?: (stageLabel: string) => void,
  signal?: AbortSignal
): Promise<GenerationResponse> {
  onStage?.('Loading verified MP4 stream into Studio player...');
  const hydrated = await hydratePlayableVideoAsset({
    remoteVideoUrl: serverRes.videoUrl,
    hasBackendApi,
    signal,
  });

  if (!hydrated.playable || !hydrated.playbackUrl) {
    return {
      ok: false,
      unavailable: true,
      errorCode: 'REQUEST_FAILED',
      message:
        hydrated.errorMessage ||
        'Generated video file expired before it could be loaded into the player.',
    };
  }

  return {
    ...serverRes,
    remoteVideoUrl: serverRes.videoUrl,
    videoUrl: hydrated.playbackUrl,
    downloadUrl: hydrated.downloadUrl || serverRes.downloadUrl,
    verifiedDuration: hydrated.durationSeconds ?? serverRes.verifiedDuration,
    fps: hydrated.fps ?? serverRes.fps,
    frameCount: hydrated.frameCount ?? serverRes.frameCount,
  };
}

async function uploadBrowserBlobToSpace(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
  blob: Blob;
  safeName: string;
  signal?: AbortSignal;
}): Promise<{ remotePath?: string; errorCode?: VideoErrorCode; errorMessage?: string }> {
  const form = new FormData();
  form.append('files', options.blob, options.safeName);

  const upRes = await fetch(`${options.spaceBase}${options.apiPrefix}/upload`, {
    method: 'POST',
    body: form,
    signal: options.signal,
  });

  if (!upRes.ok) {
    return {
      errorCode: upRes.status === 429 ? 'QUOTA_EXHAUSTED' : 'BACKEND_UNAVAILABLE',
      errorMessage: `ZeroGPU upload returned HTTP ${upRes.status}.`,
    };
  }

  const upJson = (await upRes.json().catch(() => [])) as string[];
  const remotePath = upJson?.[0];
  if (!remotePath) {
    return {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: 'ZeroGPU upload endpoint returned an empty file reference.',
    };
  }

  return { remotePath };
}

function extractClientGradioVideo(
  outData: unknown,
  spaceBase: string,
  apiPrefix: '/gradio_api' | ''
): { videoUrl?: string; seed?: number } {
  if (!Array.isArray(outData) || outData.length === 0) {
    return {};
  }

  const first = outData[0];
  const seed = typeof outData[1] === 'number' ? outData[1] : undefined;

  if (typeof first === 'string') {
    const videoUrl = normalizeGradioVideoUrl({
      rawUrl: first.startsWith('http') ? first : null,
      rawPath: !first.startsWith('http') ? first : null,
      spaceBase,
      apiPrefix,
    });
    return { videoUrl, seed };
  }

  if (first && typeof first === 'object') {
    const obj = first as {
      video?: { url?: string | null; path?: string | null } | string | null;
      url?: string | null;
      path?: string | null;
    };

    if (typeof obj.video === 'string') {
      const videoUrl = normalizeGradioVideoUrl({
        rawUrl: obj.video.startsWith('http') ? obj.video : null,
        rawPath: !obj.video.startsWith('http') ? obj.video : null,
        spaceBase,
        apiPrefix,
      });
      return { videoUrl, seed };
    }

    const rawUrl = obj.video?.url ?? obj.url ?? null;
    const rawPath = obj.video?.path ?? obj.path ?? null;
    const videoUrl = normalizeGradioVideoUrl({
      rawUrl,
      rawPath,
      spaceBase,
      apiPrefix,
    });
    return { videoUrl, seed };
  }

  return {};
}

async function readBrowserSseStream(
  res: Response,
  onEvent: (eventType: string, dataStr: string) => { done: boolean }
): Promise<void> {
  if (!res.body) {
    const text = await res.text();
    let currentEvent = 'message';
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        currentEvent = 'message';
        continue;
      }
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        if (onEvent(currentEvent, line.slice(5).trim()).done) return;
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
          if (onEvent(currentEvent, line.slice(5).trim()).done) {
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
          if (onEvent(currentEvent, line.slice(5).trim()).done) return;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function runDirectGradioQueue(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
  apiName?: string;
  fnIndex: number;
  data: unknown[];
  signal?: AbortSignal;
}): Promise<{
  videoUrl?: string;
  seed?: number;
  errorCode?: VideoErrorCode;
  errorMessage?: string;
}> {
  const sessionHash = createSessionHash();
  const joinUrl = `${options.spaceBase}${options.apiPrefix}/queue/join`;
  const dataUrl = `${options.spaceBase}${options.apiPrefix}/queue/data?session_hash=${sessionHash}`;

  const joinRes = await fetch(joinUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const callUrl = `${options.spaceBase}${options.apiPrefix}/call/${options.apiName}`;
    const callRes = await fetch(callUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: options.data }),
      signal: options.signal,
    });

    if (callRes.status !== 404 && callRes.status !== 405) {
      if (!callRes.ok) {
        const errText = await callRes.text().catch(() => '');
        const msg = errText.slice(0, 240) || `ZeroGPU Space returned HTTP ${callRes.status}.`;
        return {
          errorCode: callRes.status === 429 ? 'QUOTA_EXHAUSTED' : classifyError(msg),
          errorMessage: msg,
        };
      }

      const callJson = (await callRes.json().catch(() => ({}))) as { event_id?: string };
      if (callJson.event_id) {
        const streamRes = await fetch(`${callUrl}/${callJson.event_id}`, {
          signal: options.signal,
        });
        if (!streamRes.ok) {
          return {
            errorCode: 'BACKEND_UNAVAILABLE',
            errorMessage: `ZeroGPU stream returned HTTP ${streamRes.status}.`,
          };
        }

        let callResult: {
          videoUrl?: string;
          seed?: number;
          errorCode?: VideoErrorCode;
          errorMessage?: string;
        } | null = null;

        await readBrowserSseStream(streamRes, (eventType, dataStr) => {
          if (eventType === 'error') {
            let errMsg = dataStr;
            try {
              const parsed = JSON.parse(dataStr) as
                | string
                | { message?: string; error?: string; title?: string }
                | null;
              if (typeof parsed === 'string' && parsed) {
                errMsg = parsed;
              } else if (parsed && typeof parsed === 'object') {
                errMsg =
                  parsed.message ||
                  parsed.error ||
                  parsed.title ||
                  'ZeroGPU quota reached or worker interrupted.';
              }
            } catch {
              // Keep raw string
            }
            if (!errMsg || errMsg === 'null') {
              errMsg = 'ZeroGPU quota exhausted on your current IP.';
            }
            callResult = {
              errorCode: classifyError(errMsg),
              errorMessage: errMsg,
            };
            return { done: true };
          }

          if (eventType === 'complete') {
            try {
              const outData = JSON.parse(dataStr) as unknown;
              const extracted = extractClientGradioVideo(
                outData,
                options.spaceBase,
                options.apiPrefix
              );
              if (extracted.videoUrl) {
                callResult = extracted;
              } else {
                callResult = {
                  errorCode: 'REQUEST_FAILED',
                  errorMessage: 'Model finished without returning a playable MP4 file.',
                };
              }
            } catch {
              callResult = {
                errorCode: 'REQUEST_FAILED',
                errorMessage: 'Invalid completion payload from ZeroGPU Space.',
              };
            }
            return { done: true };
          }

          return { done: false };
        });

        return (
          callResult || {
            errorCode: 'BACKEND_UNAVAILABLE',
            errorMessage: 'ZeroGPU stream closed before returning video frames.',
          }
        );
      }
    }
  }

  if (!joinRes.ok) {
    const errText = await joinRes.text().catch(() => '');
    const msg = errText.slice(0, 240) || `ZeroGPU Space returned HTTP ${joinRes.status}.`;
    return {
      errorCode: joinRes.status === 429 ? 'QUOTA_EXHAUSTED' : classifyError(msg),
      errorMessage: msg,
    };
  }

  const sseRes = await fetch(dataUrl, { signal: options.signal });
  if (!sseRes.ok) {
    return {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: `ZeroGPU stream returned HTTP ${sseRes.status}.`,
    };
  }

  let queueResult: {
    videoUrl?: string;
    seed?: number;
    errorCode?: VideoErrorCode;
    errorMessage?: string;
  } | null = null;

  await readBrowserSseStream(sseRes, (_eventType, dataStr) => {
    if (!dataStr || dataStr === 'null') return { done: false };

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
      payload = JSON.parse(dataStr);
    } catch {
      return { done: false };
    }

    if (payload.msg === 'queue_full') {
      queueResult = {
        errorCode: 'QUOTA_EXHAUSTED',
        errorMessage: 'Free community GPU queue is temporarily full.',
      };
      return { done: true };
    }

    if (payload.msg === 'unexpected_error') {
      const msg = payload.message || 'Upstream queue error.';
      queueResult = {
        errorCode: classifyError(msg),
        errorMessage: msg,
      };
      return { done: true };
    }

    if (payload.msg === 'process_completed') {
      if (payload.success === false || payload.output?.error) {
        const detail =
          payload.output?.error ||
          payload.output?.title ||
          payload.title ||
          'Free ZeroGPU worker rejected the job.';
        queueResult = {
          errorCode: classifyError(detail),
          errorMessage: detail,
        };
        return { done: true };
      }

      const extracted = extractClientGradioVideo(
        payload.output?.data,
        options.spaceBase,
        options.apiPrefix
      );
      if (extracted.videoUrl) {
        queueResult = {
          videoUrl: extracted.videoUrl,
          seed: extracted.seed ?? 42,
        };
      } else {
        queueResult = {
          errorCode: 'REQUEST_FAILED',
          errorMessage: 'Model finished without returning a playable MP4 video.',
        };
      }
      return { done: true };
    }

    return { done: false };
  });

  return (
    queueResult || {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: 'ZeroGPU stream closed before returning video frames.',
    }
  );
}

export async function generateTextToVideo(params: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatioOption;
  duration: number;
  style: VisualStyleId;
  seed?: number;
  onStage?: (stageLabel: string) => void;
  signal?: AbortSignal;
}): Promise<GenerationResponse> {
  const trimmedPrompt = params.prompt.trim();
  if (trimmedPrompt.length < 4) {
    return {
      ok: false,
      unavailable: false,
      errorCode: 'REQUEST_FAILED',
      message: 'Please enter a scene description of at least 4 characters.',
    };
  }

  if (!isValidClipDuration(params.duration)) {
    return {
      ok: false,
      unavailable: false,
      errorCode: 'REQUEST_FAILED',
      message: 'Supported clip durations are strictly 4, 6, 8, or 10 seconds.',
    };
  }

  const selectedDuration: ClipDurationOption = normalizeClipDuration(params.duration);
  const expectedFrames = getExpectedLtxFrameCount(selectedDuration, 24);

  params.onStage?.('Checking free open-source GPU capacity...');
  const meta = await getBackendMeta();

  // Path A: Server has authenticated HF_TOKEN quota -> run server-side proxy first (never exposing tokens)
  if (meta.hasBackendApi && meta.authenticatedQuota) {
    try {
      params.onStage?.(
        `Synthesizing ${selectedDuration}s (${expectedFrames} frames @ 24 FPS) clip via authenticated server ZeroGPU...`
      );
      const apiRes = await fetch('/api/video/text-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          aspectRatio: params.aspectRatio,
          duration: selectedDuration,
          style: params.style,
          seed: params.seed,
        }),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverJson = (await apiRes.json()) as GenerationResponse;
        if (serverJson.ok) {
          return hydrateServerSuccessResponse(
            serverJson,
            meta.hasBackendApi,
            params.onStage,
            params.signal
          );
        }
      }
    } catch {
      if (params.signal?.aborted) {
        return {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Generation cancelled by user.',
        };
      }
    }
  }

  // Path B (Zero-token default): Direct Browser ZeroGPU pipeline with duration-aware fallbacks
  const englishPrompt = normalizePromptClient(trimmedPrompt);
  const finalPrompt = `${englishPrompt}, ${STYLE_MODIFIERS[params.style]}`;
  const cleanNeg =
    params.negativePrompt?.trim() ||
    'worst quality, inconsistent motion, blurry, jittery, distorted, watermark';
  const useFixedSeed = typeof params.seed === 'number' && params.seed >= 0;
  const safeSeed = useFixedSeed ? Math.min(2147483647, Math.max(0, Math.floor(params.seed!))) : 42;

  const diagnostics: string[] = [];

  // 1A & 1B. Primary 4s-10s Engine: Lightricks LTX-2.3 22B Distilled (standard + low-quota compact retry)
  for (const compactRetry of [false, true]) {
    try {
      const ltx23Dims = getLtx23Dimensions(
        params.aspectRatio,
        selectedDuration,
        false,
        compactRetry
      );
      params.onStage?.(
        compactRetry
          ? `Retrying ${selectedDuration}s LTX-2.3 at compact ${ltx23Dims.width}×${ltx23Dims.height} ZeroGPU budget...`
          : `Synthesizing ${selectedDuration}s MP4 (${expectedFrames} frames @ 24 FPS) on Lightricks LTX-2.3 ZeroGPU...`
      );
      const directLtx23 = await runDirectGradioQueue({
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
        signal: params.signal,
      });

      if (directLtx23.videoUrl) {
        params.onStage?.('Verifying MP4 binary stream and loading player...');
        const hydrated = await hydratePlayableVideoAsset({
          remoteVideoUrl: directLtx23.videoUrl,
          hasBackendApi: meta.hasBackendApi,
          signal: params.signal,
        });

        if (hydrated.playable && hydrated.playbackUrl) {
          const actualSec = hydrated.durationSeconds ?? Number((expectedFrames / 24).toFixed(2));
          const durationCapped = !isDurationWithinTolerance(actualSec, selectedDuration);
          return {
            ok: true,
            videoUrl: hydrated.playbackUrl,
            remoteVideoUrl: directLtx23.videoUrl,
            downloadUrl:
              hydrated.downloadUrl || buildDownloadUrl(directLtx23.videoUrl, meta.hasBackendApi),
            seed: directLtx23.seed ?? safeSeed,
            width: ltx23Dims.width,
            height: ltx23Dims.height,
            duration: selectedDuration,
            verifiedDuration: actualSec,
            fps: hydrated.fps ?? 24,
            frameCount: hydrated.frameCount ?? expectedFrames,
            model: `Lightricks/LTX-2.3 22B Distilled (${hydrated.frameCount ?? expectedFrames} frames @ 24 FPS)`,
            fallbackNotice: durationCapped
              ? `Model returned a verified ${actualSec}s clip for your ${selectedDuration}s request without frame duplication.`
              : compactRetry
              ? `Synthesized at ZeroGPU-friendly ${ltx23Dims.width}×${ltx23Dims.height} resolution to fit remaining free GPU quota.`
              : undefined,
          };
        }
        diagnostics.push(`LTX-2.3 stream invalid: ${hydrated.errorMessage || 'Unplayable video'}`);
        break;
      }

      if (!compactRetry) {
        diagnostics.push(`LTX-2.3: ${directLtx23.errorMessage || 'ZeroGPU quota reached.'}`);
        if (
          directLtx23.errorCode !== 'QUOTA_EXHAUSTED' ||
          /0s left/i.test(directLtx23.errorMessage || '')
        ) {
          break;
        }
      }
    } catch (err) {
      if (params.signal?.aborted) {
        return {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Generation cancelled by user.',
        };
      }
      if (!compactRetry) {
        const msg = err instanceof Error ? err.message : 'Direct LTX-2.3 connection failed.';
        diagnostics.push(`LTX-2.3: ${msg}`);
      }
      break;
    }
  }

  // 2. Secondary Engine: Official Lightricks/ltx-video-distilled (supports up to 8.5s -> clamps 10s to 8s)
  try {
    const distTargetDuration = Math.min(selectedDuration, 8) as ClipDurationOption;
    const distExpectedFrames = getExpectedLtxFrameCount(distTargetDuration, 24);
    const distDims =
      LTX_DISTILLED_DIMENSIONS[params.aspectRatio] || LTX_DISTILLED_DIMENSIONS['16:9'];
    params.onStage?.(
      `Trying Lightricks LTX-Video Distilled (${distTargetDuration}s · ${distExpectedFrames} frames @ 24 FPS)...`
    );
    const directDist = await runDirectGradioQueue({
      spaceBase: LTX_DISTILLED_SPACE_BASE,
      apiPrefix: '/gradio_api',
      apiName: 'text_to_video',
      fnIndex: 4,
      data: [
        finalPrompt,
        cleanNeg,
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
      signal: params.signal,
    });

    if (directDist.videoUrl) {
      params.onStage?.('Verifying MP4 binary stream and loading player...');
      const hydrated = await hydratePlayableVideoAsset({
        remoteVideoUrl: directDist.videoUrl,
        hasBackendApi: meta.hasBackendApi,
        signal: params.signal,
      });

      if (hydrated.playable && hydrated.playbackUrl) {
        const actualSec = hydrated.durationSeconds ?? Number((distExpectedFrames / 24).toFixed(2));
        return {
          ok: true,
          videoUrl: hydrated.playbackUrl,
          remoteVideoUrl: directDist.videoUrl,
          downloadUrl:
            hydrated.downloadUrl || buildDownloadUrl(directDist.videoUrl, meta.hasBackendApi),
          seed: directDist.seed ?? safeSeed,
          width: distDims.width,
          height: distDims.height,
          duration: selectedDuration,
          verifiedDuration: actualSec,
          fps: hydrated.fps ?? 24,
          frameCount: hydrated.frameCount ?? distExpectedFrames,
          model: `Lightricks/LTX-Video Distilled (${hydrated.frameCount ?? distExpectedFrames} frames @ 24 FPS)`,
          fallbackNotice:
            selectedDuration > 8
              ? `Primary LTX-2.3 (10s capable) was busy, so VidNova AI used Lightricks/LTX-Video Distilled at its maximum 8.0s model limit (${distExpectedFrames} frames @ 24 FPS) without frame duplication.`
              : undefined,
        };
      }
    } else if (directDist.errorMessage) {
      diagnostics.push(`LTX-Video Distilled: ${directDist.errorMessage}`);
    }
  } catch {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
  }

  // 3. Tertiary Widescreen Engine: Zeroscope-v2 (supports up to 48 frames @ 8 FPS = 6.0s; clamps 8s/10s to 6s)
  try {
    const zsTargetSec = Math.min(selectedDuration, 6);
    const zsFrames = zsTargetSec * 8;
    const zsSeed = useFixedSeed ? safeSeed : Math.floor(Math.random() * 1_000_000);
    const compactPrompt = finalPrompt.slice(0, 340);
    params.onStage?.(
      `LTX ZeroGPU busy — trying Zeroscope-v2 (${zsTargetSec}s · ${zsFrames} frames @ 8 FPS)...`
    );
    const directZs = await runDirectGradioQueue({
      spaceBase: ZEROSCOPE_SPACE_BASE,
      apiPrefix: '/gradio_api',
      apiName: 'run',
      fnIndex: 3,
      data: [compactPrompt, zsSeed, zsFrames, 24],
      signal: params.signal,
    });

    if (directZs.videoUrl) {
      params.onStage?.('Verifying MP4 binary stream and loading player...');
      const hydrated = await hydratePlayableVideoAsset({
        remoteVideoUrl: directZs.videoUrl,
        hasBackendApi: meta.hasBackendApi,
        signal: params.signal,
      });

      if (hydrated.playable && hydrated.playbackUrl) {
        const actualSec = hydrated.durationSeconds ?? zsTargetSec;
        return {
          ok: true,
          videoUrl: hydrated.playbackUrl,
          remoteVideoUrl: directZs.videoUrl,
          downloadUrl:
            hydrated.downloadUrl || buildDownloadUrl(directZs.videoUrl, meta.hasBackendApi),
          seed: zsSeed,
          width: 576,
          height: 320,
          duration: selectedDuration,
          verifiedDuration: actualSec,
          fps: hydrated.fps ?? 8,
          frameCount: hydrated.frameCount ?? zsFrames,
          model: `Zeroscope-v2 576w (${hydrated.frameCount ?? zsFrames} frames @ 8 FPS · 16:9)`,
          fallbackNotice:
            selectedDuration > 6
              ? `Primary 8s–10s LTX ZeroGPU queues were full, so VidNova AI synthesized a genuine ${actualSec}s (${zsFrames} frames @ 8 FPS) widescreen MP4 via Zeroscope-v2—its maximum 48-frame model limit—without looping frames.`
              : `Primary LTX-2.3 slot was full, so VidNova AI synthesized a genuine ${actualSec}s (${zsFrames} frames @ 8 FPS) widescreen MP4 via Zeroscope-v2.`,
        };
      }
    } else if (directZs.errorMessage) {
      diagnostics.push(`Zeroscope-v2: ${directZs.errorMessage}`);
    }
  } catch {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
  }

  // 4. Resilient Short-Clip Fallback: ByteDance/AnimateDiff-Lightning (Gradio 4, 16 frames @ 10 FPS = 1.6s)
  try {
    const adBaseModel = params.style === 'anime' ? 'ToonYou' : 'epiCRealism';
    const adMotion = 'guoyww/animatediff-motion-lora-zoom-in';
    const adPrompt = finalPrompt.slice(0, 260);
    params.onStage?.(
      'Long-form ZeroGPU pools busy — trying fast ByteDance AnimateDiff-Lightning (16 frames @ 10 FPS)...'
    );
    const directAd = await runDirectGradioQueue({
      spaceBase: ANIMATEDIFF_SPACE_BASE,
      apiPrefix: '',
      fnIndex: 0,
      data: [adPrompt, adBaseModel, adMotion, 4],
      signal: params.signal,
    });

    if (directAd.videoUrl) {
      params.onStage?.('Verifying MP4 binary stream and loading player...');
      const hydrated = await hydratePlayableVideoAsset({
        remoteVideoUrl: directAd.videoUrl,
        hasBackendApi: meta.hasBackendApi,
        signal: params.signal,
      });

      if (hydrated.playable && hydrated.playbackUrl) {
        const actualSec = hydrated.durationSeconds ?? 1.6;
        return {
          ok: true,
          videoUrl: hydrated.playbackUrl,
          remoteVideoUrl: directAd.videoUrl,
          downloadUrl:
            hydrated.downloadUrl || buildDownloadUrl(directAd.videoUrl, meta.hasBackendApi),
          seed: safeSeed,
          width: 512,
          height: 512,
          duration: selectedDuration,
          verifiedDuration: actualSec,
          fps: hydrated.fps ?? 10,
          frameCount: hydrated.frameCount ?? 16,
          model: 'ByteDance/AnimateDiff-Lightning (16 frames @ 10 FPS · 1:1)',
          fallbackNotice: `Long-duration LTX-2.3 (4s–10s) ZeroGPU queues were full on your IP, so VidNova AI generated a real ${actualSec}s (16 frames @ 10 FPS) AI clip via ByteDance/AnimateDiff-Lightning. AnimateDiff-Lightning's temporal window is capped at 16 frames and frames are never duplicated or looped.`,
        };
      }
    } else if (directAd.errorMessage) {
      diagnostics.push(`AnimateDiff-Lightning: ${directAd.errorMessage}`);
    }
  } catch {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
  }

  // 5. Server relay attempt if backend API is available and unauthenticated browser calls failed
  if (meta.hasBackendApi && !meta.authenticatedQuota) {
    try {
      params.onStage?.('Checking VidNova server relay capacity...');
      const apiRes = await fetch('/api/video/text-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          aspectRatio: params.aspectRatio,
          duration: selectedDuration,
          style: params.style,
          seed: params.seed,
        }),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const relayJson = (await apiRes.json()) as GenerationResponse;
        if (relayJson.ok) {
          return hydrateServerSuccessResponse(
            relayJson,
            meta.hasBackendApi,
            params.onStage,
            params.signal
          );
        }
        return relayJson;
      }
    } catch {
      if (params.signal?.aborted) {
        return {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Generation cancelled by user.',
        };
      }
    }
  }

  const combinedDiag = diagnostics.join(' | ');
  const primaryErrorCode = classifyError(combinedDiag);

  return {
    ok: false,
    unavailable: true,
    errorCode: primaryErrorCode,
    message:
      primaryErrorCode === 'QUOTA_EXHAUSTED'
        ? `Free Hugging Face ZeroGPU community quota for AI Text-to-Video is temporarily exhausted on your IP.`
        : `Free open-source AI Text-to-Video backends are temporarily unreachable.`,
    detail:
      primaryErrorCode === 'QUOTA_EXHAUSTED'
        ? `${combinedDiag} Tip: Free anonymous ZeroGPU pools reset automatically, or you can configure a free read-only HF_TOKEN in your server/Vercel environment settings for dedicated ZeroGPU priority.`
        : combinedDiag,
    externalDemoUrl: 'https://huggingface.co/spaces/Upsampler/ltx-video',
  };
}

export async function generateImageToVideo(params: {
  prompt: string;
  negativePrompt?: string;
  imageBase64: string;
  mimeType: string;
  fileName: string;
  aspectRatio: AspectRatioOption;
  duration: number;
  style: VisualStyleId;
  hasPermission: boolean;
  seed?: number;
  onStage?: (stageLabel: string) => void;
  signal?: AbortSignal;
}): Promise<GenerationResponse> {
  if (!params.hasPermission) {
    return {
      ok: false,
      unavailable: false,
      errorCode: 'REQUEST_FAILED',
      message:
        'Please confirm image upload rights and external ZeroGPU processing consent before running AI Image-to-Video.',
    };
  }

  if (!isValidClipDuration(params.duration)) {
    return {
      ok: false,
      unavailable: false,
      errorCode: 'REQUEST_FAILED',
      message: 'Supported clip durations are strictly 4, 6, 8, or 10 seconds.',
    };
  }

  const selectedDuration: ClipDurationOption = normalizeClipDuration(params.duration);
  const expectedFrames = getExpectedLtxFrameCount(selectedDuration, 24);

  params.onStage?.('Checking free Image-to-Video GPU capacity...');
  const meta = await getBackendMeta();

  // Path A: Server has authenticated HF_TOKEN quota -> run server-side proxy first
  if (meta.hasBackendApi && meta.authenticatedQuota) {
    try {
      params.onStage?.(
        `Staging reference image for ${selectedDuration}s (${expectedFrames} frames @ 24 FPS) authenticated synthesis...`
      );
      const apiRes = await fetch('/api/video/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          imageBase64: params.imageBase64,
          mimeType: params.mimeType,
          fileName: params.fileName,
          aspectRatio: params.aspectRatio,
          duration: selectedDuration,
          style: params.style,
          hasPermission: params.hasPermission,
          seed: params.seed,
        }),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverJson = (await apiRes.json()) as GenerationResponse;
        if (serverJson.ok) {
          return hydrateServerSuccessResponse(
            serverJson,
            meta.hasBackendApi,
            params.onStage,
            params.signal
          );
        }
      }
    } catch {
      if (params.signal?.aborted) {
        return {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Generation cancelled by user.',
        };
      }
    }
  }

  const englishPrompt = normalizePromptClient(
    params.prompt.trim() ||
      'Natural cinematic camera movement, subtle atmospheric motion, photorealistic lighting'
  );
  const finalPrompt = `${englishPrompt}, ${STYLE_MODIFIERS[params.style]}`;
  const cleanNeg =
    params.negativePrompt?.trim() ||
    'worst quality, inconsistent motion, blurry, jittery, distorted';
  const useFixedSeed = typeof params.seed === 'number' && params.seed >= 0;
  const safeSeed = useFixedSeed ? Math.min(2147483647, Math.max(0, Math.floor(params.seed!))) : 42;
  const safeName = params.fileName || 'reference.jpg';

  const diagnostics: string[] = [];

  let imageBlob: Blob | null = null;
  try {
    const fetchBlob = await fetch(params.imageBase64);
    imageBlob = await fetchBlob.blob();
  } catch {
    return {
      ok: false,
      unavailable: false,
      errorCode: 'REQUEST_FAILED',
      message: 'Unable to read selected reference image in browser.',
    };
  }

  // 1. Primary 4s-10s Engine: Lightricks LTX-2.3 22B Distilled (standard + low-quota compact retry)
  try {
    params.onStage?.('Staging reference image on Lightricks LTX-2.3 ZeroGPU...');
    const up23 = await uploadBrowserBlobToSpace({
      spaceBase: LTX23_SPACE_BASE,
      apiPrefix: '/gradio_api',
      blob: imageBlob,
      safeName,
      signal: params.signal,
    });

    if (up23.remotePath) {
      for (const compactRetry of [false, true]) {
        const ltx23Dims = getLtx23Dimensions(
          params.aspectRatio,
          selectedDuration,
          false,
          compactRetry
        );
        params.onStage?.(
          compactRetry
            ? `Retrying ${selectedDuration}s LTX-2.3 I2V at compact ${ltx23Dims.width}×${ltx23Dims.height}...`
            : `Synthesizing ${selectedDuration}s (${expectedFrames} frames @ 24 FPS) neural Image-to-Video clip...`
        );
        const directLtx23 = await runDirectGradioQueue({
          spaceBase: LTX23_SPACE_BASE,
          apiPrefix: '/gradio_api',
          apiName: 'generate_video',
          fnIndex: 2,
          data: [
            {
              path: up23.remotePath,
              meta: { _type: 'gradio.FileData' },
              orig_name: safeName,
              mime_type: params.mimeType,
            },
            finalPrompt,
            selectedDuration,
            false,
            safeSeed,
            !useFixedSeed,
            ltx23Dims.height,
            ltx23Dims.width,
          ],
          signal: params.signal,
        });

        if (directLtx23.videoUrl) {
          params.onStage?.('Verifying MP4 binary stream and loading player...');
          const hydrated = await hydratePlayableVideoAsset({
            remoteVideoUrl: directLtx23.videoUrl,
            hasBackendApi: meta.hasBackendApi,
            signal: params.signal,
          });

          if (hydrated.playable && hydrated.playbackUrl) {
            const actualSec = hydrated.durationSeconds ?? Number((expectedFrames / 24).toFixed(2));
            return {
              ok: true,
              videoUrl: hydrated.playbackUrl,
              remoteVideoUrl: directLtx23.videoUrl,
              downloadUrl:
                hydrated.downloadUrl || buildDownloadUrl(directLtx23.videoUrl, meta.hasBackendApi),
              seed: directLtx23.seed ?? safeSeed,
              width: ltx23Dims.width,
              height: ltx23Dims.height,
              duration: selectedDuration,
              verifiedDuration: actualSec,
              fps: hydrated.fps ?? 24,
              frameCount: hydrated.frameCount ?? expectedFrames,
              model: `Lightricks/LTX-2.3 22B Distilled (${hydrated.frameCount ?? expectedFrames} frames @ 24 FPS)`,
              fallbackNotice: compactRetry
                ? `Synthesized at ZeroGPU-friendly ${ltx23Dims.width}×${ltx23Dims.height} resolution to fit remaining free GPU quota.`
                : undefined,
            };
          }
          break;
        }

        if (!compactRetry) {
          diagnostics.push(`LTX-2.3: ${directLtx23.errorMessage || 'ZeroGPU quota reached.'}`);
          if (
            directLtx23.errorCode !== 'QUOTA_EXHAUSTED' ||
            /0s left/i.test(directLtx23.errorMessage || '')
          ) {
            break;
          }
        }
      }
    } else {
      diagnostics.push(`LTX-2.3 Upload: ${up23.errorMessage || 'Unavailable'}`);
    }
  } catch (err) {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
    const msg = err instanceof Error ? err.message : 'Network error reaching LTX-2.3 ZeroGPU.';
    diagnostics.push(`LTX-2.3: ${msg}`);
  }

  // 2. Secondary 4s-8s Engine: Official Lightricks/ltx-video-distilled (clamps 10s -> 8s)
  try {
    const distTargetDuration = Math.min(selectedDuration, 8) as ClipDurationOption;
    const distExpectedFrames = getExpectedLtxFrameCount(distTargetDuration, 24);
    params.onStage?.(
      `Trying Lightricks LTX-Video Distilled (${distTargetDuration}s · ${distExpectedFrames} frames @ 24 FPS)...`
    );
    const upDist = await uploadBrowserBlobToSpace({
      spaceBase: LTX_DISTILLED_SPACE_BASE,
      apiPrefix: '/gradio_api',
      blob: imageBlob,
      safeName,
      signal: params.signal,
    });

    if (upDist.remotePath) {
      const distDims =
        LTX_DISTILLED_DIMENSIONS[params.aspectRatio] || LTX_DISTILLED_DIMENSIONS['16:9'];
      const directDistI2v = await runDirectGradioQueue({
        spaceBase: LTX_DISTILLED_SPACE_BASE,
        apiPrefix: '/gradio_api',
        apiName: 'image_to_video',
        fnIndex: 5,
        data: [
          finalPrompt,
          cleanNeg,
          {
            path: upDist.remotePath,
            meta: { _type: 'gradio.FileData' },
            orig_name: safeName,
            mime_type: params.mimeType,
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
        signal: params.signal,
      });

      if (directDistI2v.videoUrl) {
        params.onStage?.('Verifying MP4 binary stream and loading player...');
        const hydrated = await hydratePlayableVideoAsset({
          remoteVideoUrl: directDistI2v.videoUrl,
          hasBackendApi: meta.hasBackendApi,
          signal: params.signal,
        });

        if (hydrated.playable && hydrated.playbackUrl) {
          const actualSec =
            hydrated.durationSeconds ?? Number((distExpectedFrames / 24).toFixed(2));
          return {
            ok: true,
            videoUrl: hydrated.playbackUrl,
            remoteVideoUrl: directDistI2v.videoUrl,
            downloadUrl:
              hydrated.downloadUrl ||
              buildDownloadUrl(directDistI2v.videoUrl, meta.hasBackendApi),
            seed: directDistI2v.seed ?? safeSeed,
            width: distDims.width,
            height: distDims.height,
            duration: selectedDuration,
            verifiedDuration: actualSec,
            fps: hydrated.fps ?? 24,
            frameCount: hydrated.frameCount ?? distExpectedFrames,
            model: `Lightricks/LTX-Video Distilled (${hydrated.frameCount ?? distExpectedFrames} frames @ 24 FPS)`,
            fallbackNotice:
              selectedDuration > 8
                ? `Primary LTX-2.3 (10s capable) was busy, so VidNova AI used Lightricks/LTX-Video Distilled at its maximum 8.0s model limit (${distExpectedFrames} frames @ 24 FPS).`
                : undefined,
          };
        }
      } else if (directDistI2v.errorMessage) {
        diagnostics.push(`LTX-Video Distilled: ${directDistI2v.errorMessage}`);
      }
    }
  } catch {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
  }

  // 3. Tertiary Fast 4-Step I2V Engine: multimodalart/wan2-1-fast (81 frames @ 24 FPS ≈ 3.38s)
  try {
    params.onStage?.('Trying fast Wan 2.1 14B Image-to-Video (81 frames @ 24 FPS)...');
    const upWan = await uploadBrowserBlobToSpace({
      spaceBase: WAN_FAST_SPACE_BASE,
      apiPrefix: '/gradio_api',
      blob: imageBlob,
      safeName,
      signal: params.signal,
    });

    if (upWan.remotePath) {
      const wanDims = WAN_FAST_DIMENSIONS[params.aspectRatio] || WAN_FAST_DIMENSIONS['16:9'];
      const directWan = await runDirectGradioQueue({
        spaceBase: WAN_FAST_SPACE_BASE,
        apiPrefix: '/gradio_api',
        apiName: 'generate_video',
        fnIndex: 2,
        data: [
          {
            path: upWan.remotePath,
            meta: { _type: 'gradio.FileData' },
            orig_name: safeName,
            mime_type: params.mimeType,
          },
          finalPrompt,
          wanDims.height,
          wanDims.width,
          cleanNeg,
          3.3,
          1.0,
          4,
          safeSeed,
          !useFixedSeed,
        ],
        signal: params.signal,
      });

      if (directWan.videoUrl) {
        params.onStage?.('Verifying MP4 binary stream and loading player...');
        const hydrated = await hydratePlayableVideoAsset({
          remoteVideoUrl: directWan.videoUrl,
          hasBackendApi: meta.hasBackendApi,
          signal: params.signal,
        });

        if (hydrated.playable && hydrated.playbackUrl) {
          const actualSec = hydrated.durationSeconds ?? 3.38;
          return {
            ok: true,
            videoUrl: hydrated.playbackUrl,
            remoteVideoUrl: directWan.videoUrl,
            downloadUrl:
              hydrated.downloadUrl || buildDownloadUrl(directWan.videoUrl, meta.hasBackendApi),
            seed: directWan.seed ?? safeSeed,
            width: wanDims.width,
            height: wanDims.height,
            duration: selectedDuration,
            verifiedDuration: actualSec,
            fps: hydrated.fps ?? 24,
            frameCount: hydrated.frameCount ?? 81,
            model: `Wan 2.1 14B Fast (${hydrated.frameCount ?? 81} frames @ 24 FPS)`,
            fallbackNotice: `LTX ZeroGPU queues were full, so VidNova AI synthesized a real ${actualSec}s (81 frames @ 24 FPS) clip via Wan 2.1 Fast—its fixed 81-frame model window—without frame looping.`,
          };
        }
      } else if (directWan.errorMessage) {
        diagnostics.push(`Wan2.1-Fast: ${directWan.errorMessage}`);
      }
    }
  } catch {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
  }

  // 4. Server relay fallback if backend API is present
  if (meta.hasBackendApi && !meta.authenticatedQuota) {
    try {
      params.onStage?.('Checking VidNova server relay capacity...');
      const apiRes = await fetch('/api/video/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          imageBase64: params.imageBase64,
          mimeType: params.mimeType,
          fileName: params.fileName,
          aspectRatio: params.aspectRatio,
          duration: selectedDuration,
          style: params.style,
          hasPermission: params.hasPermission,
          seed: params.seed,
        }),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const relayJson = (await apiRes.json()) as GenerationResponse;
        if (relayJson.ok) {
          return hydrateServerSuccessResponse(
            relayJson,
            meta.hasBackendApi,
            params.onStage,
            params.signal
          );
        }
        return relayJson;
      }
    } catch {
      if (params.signal?.aborted) {
        return {
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Generation cancelled by user.',
        };
      }
    }
  }

  const combinedDiag = diagnostics.join(' | ');
  const directErrorCode = classifyError(combinedDiag);

  return {
    ok: false,
    unavailable: true,
    errorCode: directErrorCode,
    message:
      directErrorCode === 'QUOTA_EXHAUSTED'
        ? `Free Hugging Face ZeroGPU quota for AI Image-to-Video is currently exhausted on your IP.`
        : `AI Image-to-Video backend is temporarily unreachable.`,
    detail:
      directErrorCode === 'QUOTA_EXHAUSTED'
        ? `${combinedDiag} You can wait for your free Hugging Face IP quota to reset, or click "Switch to ${selectedDuration}s Browser Photo Animation (Non-AI)" below to render a smooth ${selectedDuration}-second H.264 MP4 camera animation locally right now.`
        : combinedDiag,
    externalDemoUrl: 'https://huggingface.co/spaces/Upsampler/ltx-video',
  };
}
