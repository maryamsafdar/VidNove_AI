import type {
  AspectRatioOption,
  ProviderStatus,
  VideoErrorCode,
  VisualStyleId,
} from '../types/studio';

const LTX_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space';
const ZEROSCOPE_SPACE_BASE = 'https://hysts-zeroscope-v2.hf.space';
const ADL_SPACE_BASE = 'https://bytedance-animatediff-lightning.hf.space';

const ASPECT_DIMENSIONS: Record<AspectRatioOption, { width: number; height: number }> = {
  '16:9': { width: 768, height: 448 },
  '9:16': { width: 448, height: 768 },
  '1:1': { width: 576, height: 576 },
  '4:3': { width: 704, height: 512 },
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

function pickAnimateDiffMotionLora(promptText: string): string {
  if (/pull|zoom[\s-]*out|wide reveal/i.test(promptText)) {
    return 'guoyww/animatediff-motion-lora-zoom-out';
  }
  if (/pan[\s-]*left/i.test(promptText)) {
    return 'guoyww/animatediff-motion-lora-pan-left';
  }
  if (/pan[\s-]*right|lateral|tracking/i.test(promptText)) {
    return 'guoyww/animatediff-motion-lora-pan-right';
  }
  if (/tilt[\s-]*up|crane|rise/i.test(promptText)) {
    return 'guoyww/animatediff-motion-lora-tilt-up';
  }
  if (/tilt[\s-]*down/i.test(promptText)) {
    return 'guoyww/animatediff-motion-lora-tilt-down';
  }
  return 'guoyww/animatediff-motion-lora-zoom-in';
}

export interface GenerationSuccess {
  ok: true;
  videoUrl: string;
  downloadUrl: string;
  seed: number;
  width: number;
  height: number;
  duration: number;
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
  if (/quota|exceeded|runs limit|rate limit|too many requests|429/i.test(raw)) {
    return 'QUOTA_EXHAUSTED';
  }
  if (/paused|sleeping|building|stopped|unreachable|502|503|504|failed to fetch|network/i.test(raw)) {
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
    // Fallback to direct Hugging Face Hub status check if deployed as static frontend (e.g. Vercel)
  }

  backendMetaCache = {
    checkedAt: Date.now(),
    hasBackendApi: false,
    authenticatedQuota: false,
  };

  try {
    const [ltxRes, adlRes] = await Promise.allSettled([
      fetch('https://huggingface.co/api/spaces/Lightricks/ltx-video-distilled'),
      fetch('https://huggingface.co/api/spaces/ByteDance/AnimateDiff-Lightning'),
    ]);

    let ltxStage = 'UNKNOWN';
    let hardware = 'zero-a10g';
    if (ltxRes.status === 'fulfilled' && ltxRes.value.ok) {
      const data = await ltxRes.value.json();
      ltxStage = data?.runtime?.stage || 'UNKNOWN';
      hardware = data?.runtime?.hardware?.current || 'zero-a10g';
    }

    let adlStage = 'UNKNOWN';
    if (adlRes.status === 'fulfilled' && adlRes.value.ok) {
      const adlData = await adlRes.value.json();
      adlStage = adlData?.runtime?.stage || 'UNKNOWN';
    }

    const ltxRunning = ltxStage === 'RUNNING';
    const adlRunning = adlStage === 'RUNNING';

    return {
      available: ltxRunning || adlRunning,
      stage: ltxRunning ? 'RUNNING' : adlRunning ? 'FALLBACK_READY' : ltxStage,
      hardware,
      provider: 'Hugging Face ZeroGPU (Free Community Tier)',
      model: 'Lightricks/LTX-Video + AnimateDiff-Lightning',
      fallbackModel: 'ByteDance/AnimateDiff-Lightning (4-Step)',
      fallbackAvailable: adlRunning,
      authenticatedQuota: false,
    };
  } catch {
    return {
      available: false,
      stage: 'UNREACHABLE',
      hardware: 'zero-a10g',
      provider: 'Hugging Face ZeroGPU (Free Community Tier)',
      model: 'Lightricks/LTX-Video + AnimateDiff-Lightning',
      fallbackModel: 'ByteDance/AnimateDiff-Lightning (4-Step)',
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
  if (hasBackendApi) {
    return `/api/video/download?url=${encodeURIComponent(videoUrl)}`;
  }
  return videoUrl;
}

async function runDirectGradioQueue(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
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

  const sseText = await sseRes.text();
  for (const rawLine of sseText.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === 'null') continue;

    let payload: {
      msg?: string;
      success?: boolean;
      title?: string;
      message?: string;
      output?: {
        data?: Array<
          | {
              video?: { url?: string; path?: string };
              url?: string;
              path?: string;
            }
          | number
        >;
        error?: string;
        title?: string;
      };
    };

    try {
      payload = JSON.parse(dataStr);
    } catch {
      continue;
    }

    if (payload.msg === 'queue_full') {
      return {
        errorCode: 'QUOTA_EXHAUSTED',
        errorMessage: 'Free community GPU queue is temporarily full.',
      };
    }

    if (payload.msg === 'unexpected_error') {
      const msg = payload.message || 'Upstream queue error.';
      return {
        errorCode: classifyError(msg),
        errorMessage: msg,
      };
    }

    if (payload.msg === 'process_completed') {
      if (payload.success === false || payload.output?.error) {
        const detail =
          payload.output?.error ||
          payload.output?.title ||
          payload.title ||
          'Free ZeroGPU worker rejected the job.';
        return {
          errorCode: classifyError(detail),
          errorMessage: detail,
        };
      }

      const outData = payload.output?.data;
      if (Array.isArray(outData) && outData.length > 0) {
        const first = outData[0];
        if (first && typeof first === 'object') {
          const filePrefix = options.apiPrefix ? `${options.apiPrefix}/file=` : '/file=';
          const url =
            first.video?.url ||
            first.url ||
            (first.video?.path ? `${options.spaceBase}${filePrefix}${first.video.path}` : undefined) ||
            (first.path ? `${options.spaceBase}${filePrefix}${first.path}` : undefined);
          if (url) {
            return {
              videoUrl: url,
              seed: typeof outData[1] === 'number' ? outData[1] : 42,
            };
          }
        }
      }

      return {
        errorCode: 'REQUEST_FAILED',
        errorMessage: 'Model finished without returning a playable MP4 video.',
      };
    }
  }

  return {
    errorCode: 'BACKEND_UNAVAILABLE',
    errorMessage: 'ZeroGPU stream closed before returning video frames.',
  };
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

  params.onStage?.('Checking free open-source GPU capacity...');
  const meta = await getBackendMeta();

  // Path A: Server has authenticated quota -> use server-side proxy first (never exposing credentials)
  if (meta.hasBackendApi && meta.authenticatedQuota) {
    try {
      params.onStage?.('Synthesizing video via authenticated server ZeroGPU pipeline...');
      const apiRes = await fetch('/api/video/text-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverJson = (await apiRes.json()) as GenerationResponse;
        if (serverJson.ok) return serverJson;
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

  // Path B (Zero-token default & Vercel static hosting):
  // 1. Try Lightricks/LTX-Video directly from visitor's browser IP first so shared backend container IPs don't block the visitor!
  const dims = ASPECT_DIMENSIONS[params.aspectRatio] || ASPECT_DIMENSIONS['16:9'];
  const clampedDuration = Math.min(4, Math.max(2, Number(params.duration) || 4));
  const englishPrompt = normalizePromptClient(trimmedPrompt);
  const finalPrompt = `${englishPrompt}, ${STYLE_MODIFIERS[params.style]}`;
  const cleanNeg =
    params.negativePrompt?.trim() ||
    'worst quality, inconsistent motion, blurry, jittery, distorted, watermark';
  const useFixedSeed = typeof params.seed === 'number' && params.seed >= 0;

  let ltxErrorDetail = '';
  let ltxErrorCode: VideoErrorCode = 'QUOTA_EXHAUSTED';

  try {
    params.onStage?.(`Submitting ${clampedDuration}s shot to Lightricks LTX-Video ZeroGPU...`);
    const directLtx = await runDirectGradioQueue({
      spaceBase: LTX_SPACE_BASE,
      apiPrefix: '/gradio_api',
      fnIndex: 4,
      data: [
        finalPrompt,
        cleanNeg,
        null,
        null,
        dims.height,
        dims.width,
        'text-to-video',
        clampedDuration,
        9,
        useFixedSeed ? Math.floor(params.seed!) : 42,
        !useFixedSeed,
        3.0,
        true,
      ],
      signal: params.signal,
    });

    if (directLtx.videoUrl) {
      return {
        ok: true,
        videoUrl: directLtx.videoUrl,
        downloadUrl: buildDownloadUrl(directLtx.videoUrl, meta.hasBackendApi),
        seed: directLtx.seed ?? (useFixedSeed ? Math.floor(params.seed!) : 42),
        width: dims.width,
        height: dims.height,
        duration: clampedDuration,
        model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
      };
    }

    ltxErrorDetail = directLtx.errorMessage || 'LTX-Video ZeroGPU quota reached.';
    ltxErrorCode = directLtx.errorCode || 'QUOTA_EXHAUSTED';
  } catch (err) {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: 'Generation cancelled by user.',
      };
    }
    ltxErrorDetail = err instanceof Error ? err.message : 'Direct LTX-Video connection failed.';
    ltxErrorCode = classifyError(ltxErrorDetail);
  }

  // 2. Tier-2 4-Second Widescreen Fallback: hysts/zeroscope-v2 (requests only 60s ZeroGPU quota — fits inside standard 60s unauthenticated browser IP window!)
  const compactPrompt = finalPrompt.slice(0, 340);
  try {
    const zsFrames = Math.max(24, clampedDuration * 8);
    const zsSeed = useFixedSeed ? Math.floor(params.seed!) : Math.floor(Math.random() * 1_000_000);
    params.onStage?.(
      `LTX-Video 120s slot full — synthesizing ${clampedDuration}s widescreen clip on Zeroscope-v2 (60s GPU)...`
    );
    const directZs = await runDirectGradioQueue({
      spaceBase: ZEROSCOPE_SPACE_BASE,
      apiPrefix: '/gradio_api',
      fnIndex: 3,
      data: [compactPrompt, zsSeed, zsFrames, 22],
      signal: params.signal,
    });

    if (directZs.videoUrl) {
      const actualSec = Number((zsFrames / 8).toFixed(1));
      return {
        ok: true,
        videoUrl: directZs.videoUrl,
        downloadUrl: buildDownloadUrl(directZs.videoUrl, meta.hasBackendApi),
        seed: zsSeed,
        width: 576,
        height: 320,
        duration: actualSec,
        model: 'Zeroscope-v2 576w (Free ZeroGPU · 16:9)',
        fallbackNotice: `Primary LTX-Video 120s GPU slot was full for your IP, so VidNova AI synthesized a genuine ${actualSec}s (576×320) widescreen clip via Zeroscope-v2.`,
      };
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

  // 3. Tier-3 Fast Distilled Fallback: Official ByteDance/AnimateDiff-Lightning
  // Uses separate ZeroGPU v1 pool (~9s per clip) both directly via CORS and via server relay
  try {
    params.onStage?.(
      'Switching to ByteDance AnimateDiff-Lightning 4-step free GPU...'
    );
    const baseModel = params.style === 'anime' ? 'ToonYou' : 'epiCRealism';
    const motionLora = pickAnimateDiffMotionLora(finalPrompt);

    const directAdl = await runDirectGradioQueue({
      spaceBase: ADL_SPACE_BASE,
      apiPrefix: '',
      fnIndex: 0,
      data: [compactPrompt, baseModel, motionLora, 4],
      signal: params.signal,
    });

    if (directAdl.videoUrl) {
      return {
        ok: true,
        videoUrl: directAdl.videoUrl,
        downloadUrl: buildDownloadUrl(directAdl.videoUrl, meta.hasBackendApi),
        seed: useFixedSeed ? Math.floor(params.seed!) : 42,
        width: 512,
        height: 512,
        duration: 1.6,
        model: `ByteDance/AnimateDiff-Lightning (${baseModel} · 4-Step Free GPU)`,
        fallbackNotice:
          ltxErrorCode === 'QUOTA_EXHAUSTED'
            ? `Primary ${clampedDuration}s LTX-Video ZeroGPU quota was full for your current IP, so VidNova AI synthesized a real 1.6s (512×512, 16-frame) neural video clip via ByteDance AnimateDiff-Lightning at zero cost.`
            : `Primary LTX-Video Space was unavailable, so VidNova AI synthesized a real 1.6s (512×512) neural video clip via ByteDance AnimateDiff-Lightning.`,
      };
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

  // 3. Final server fallback if backend API is present and browser CORS was blocked by a strict network firewall
  if (meta.hasBackendApi && !meta.authenticatedQuota) {
    try {
      params.onStage?.('Retrying via VidNova server relay...');
      const apiRes = await fetch('/api/video/text-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await apiRes.json()) as GenerationResponse;
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

  return {
    ok: false,
    unavailable: true,
    errorCode: ltxErrorCode,
    message:
      ltxErrorCode === 'QUOTA_EXHAUSTED'
        ? 'Free Hugging Face ZeroGPU community quota is temporarily exhausted for your IP.'
        : 'Free open-source AI Text-to-Video backends are temporarily unreachable.',
    detail: ltxErrorDetail,
    externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
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

  params.onStage?.('Checking free Image-to-Video GPU capacity...');
  const meta = await getBackendMeta();

  // Path A: Server has authenticated quota -> use server-side proxy first
  if (meta.hasBackendApi && meta.authenticatedQuota) {
    try {
      params.onStage?.('Staging reference image on authenticated ZeroGPU pipeline...');
      const apiRes = await fetch('/api/video/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const serverJson = (await apiRes.json()) as GenerationResponse;
        if (serverJson.ok) return serverJson;
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

  // Path B: Direct browser CORS call to Lightricks/LTX-Video using visitor's own residential IP quota
  let directErrorDetail = '';
  let directErrorCode: VideoErrorCode = 'QUOTA_EXHAUSTED';

  try {
    params.onStage?.('Staging reference image on Lightricks LTX-Video ZeroGPU...');
    const fetchBlob = await fetch(params.imageBase64);
    const blob = await fetchBlob.blob();
    const form = new FormData();
    const safeName = params.fileName || 'reference.jpg';
    form.append('files', blob, safeName);

    const upRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/upload`, {
      method: 'POST',
      body: form,
      signal: params.signal,
    });

    if (upRes.ok) {
      const upJson = (await upRes.json()) as string[];
      const remotePath = upJson?.[0];
      if (remotePath) {
        const dims = ASPECT_DIMENSIONS[params.aspectRatio] || ASPECT_DIMENSIONS['16:9'];
        const clampedDuration = Math.min(4, Math.max(2, Number(params.duration) || 4));
        const englishPrompt = normalizePromptClient(
          params.prompt.trim() ||
            'Natural cinematic camera movement, subtle atmospheric motion, photorealistic lighting'
        );
        const finalPrompt = `${englishPrompt}, ${STYLE_MODIFIERS[params.style]}`;
        const cleanNeg =
          params.negativePrompt?.trim() ||
          'worst quality, inconsistent motion, blurry, jittery, distorted';
        const useFixedSeed = typeof params.seed === 'number' && params.seed >= 0;

        params.onStage?.(
          `Synthesizing ${clampedDuration}s neural Image-to-Video clip on ZeroGPU...`
        );
        const directI2v = await runDirectGradioQueue({
          spaceBase: LTX_SPACE_BASE,
          apiPrefix: '/gradio_api',
          fnIndex: 5,
          data: [
            finalPrompt,
            cleanNeg,
            {
              path: remotePath,
              meta: { _type: 'gradio.FileData' },
              orig_name: safeName,
              mime_type: params.mimeType,
            },
            null,
            dims.height,
            dims.width,
            'image-to-video',
            clampedDuration,
            9,
            useFixedSeed ? Math.floor(params.seed!) : 42,
            !useFixedSeed,
            3.0,
            true,
          ],
          signal: params.signal,
        });

        if (directI2v.videoUrl) {
          return {
            ok: true,
            videoUrl: directI2v.videoUrl,
            downloadUrl: buildDownloadUrl(directI2v.videoUrl, meta.hasBackendApi),
            seed: directI2v.seed ?? (useFixedSeed ? Math.floor(params.seed!) : 42),
            width: dims.width,
            height: dims.height,
            duration: clampedDuration,
            model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
          };
        }

        directErrorDetail =
          directI2v.errorMessage || 'Free ZeroGPU Image-to-Video quota reached.';
        directErrorCode = directI2v.errorCode || 'QUOTA_EXHAUSTED';
      }
    } else {
      directErrorDetail = `ZeroGPU upload returned HTTP ${upRes.status}.`;
      directErrorCode = upRes.status === 429 ? 'QUOTA_EXHAUSTED' : 'BACKEND_UNAVAILABLE';
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
    directErrorDetail = err instanceof Error ? err.message : 'Network error reaching ZeroGPU.';
    directErrorCode = classifyError(directErrorDetail);
  }

  // Path C: Try server relay if available and not yet tried (in case visitor's network blocked direct CORS or server IP has fresh quota)
  if (meta.hasBackendApi && !meta.authenticatedQuota) {
    try {
      params.onStage?.('Checking VidNova server relay capacity...');
      const apiRes = await fetch('/api/video/image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: params.signal,
      });
      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const relayJson = (await apiRes.json()) as GenerationResponse;
        if (relayJson.ok) return relayJson;
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

  return {
    ok: false,
    unavailable: true,
    errorCode: directErrorCode,
    message:
      directErrorCode === 'QUOTA_EXHAUSTED'
        ? 'Free Hugging Face ZeroGPU quota for AI Image-to-Video is currently exhausted.'
        : 'AI Image-to-Video backend is temporarily unreachable.',
    detail:
      directErrorCode === 'QUOTA_EXHAUSTED'
        ? `${directErrorDetail} You can wait for your free Hugging Face IP quota to reset, or click "Switch to Instant Browser Photo Motion" below to render a smooth 4-second camera-animated clip locally right now (clearly labeled as Photo Animation, not generative AI).`
        : directErrorDetail,
    externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
  };
}
