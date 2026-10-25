import type {
  AspectRatioOption,
  ProviderStatus,
  VisualStyleId,
} from '../types/studio';

const LTX_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space';

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

export interface GenerationSuccess {
  ok: true;
  videoUrl: string;
  downloadUrl: string;
  seed: number;
  width: number;
  height: number;
  duration: number;
  model: string;
}

export interface GenerationFailure {
  ok: false;
  unavailable: boolean;
  message: string;
  detail?: string;
  externalDemoUrl?: string;
}

export type GenerationResponse = GenerationSuccess | GenerationFailure;

export async function fetchProviderStatus(): Promise<ProviderStatus> {
  try {
    const res = await fetch('/api/video/status');
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return (await res.json()) as ProviderStatus;
    }
  } catch {
    // Fallback to direct Hugging Face Hub status check if deployed as static frontend
  }

  try {
    const hubRes = await fetch(
      'https://huggingface.co/api/spaces/Lightricks/ltx-video-distilled'
    );
    if (hubRes.ok) {
      const data = await hubRes.json();
      const stage = data?.runtime?.stage || 'UNKNOWN';
      return {
        available: stage === 'RUNNING',
        stage,
        hardware: data?.runtime?.hardware?.current || 'zero-a10g',
        provider: 'Hugging Face ZeroGPU (Free Community Tier)',
        model: 'Lightricks/LTX-Video Distilled (Open-Weight DiT)',
        authenticatedQuota: false,
      };
    }
  } catch {
    // Ignore network error
  }

  return {
    available: false,
    stage: 'UNREACHABLE',
    hardware: 'zero-a10g',
    provider: 'Hugging Face ZeroGPU (Free Community Tier)',
    model: 'Lightricks/LTX-Video Distilled (Open-Weight DiT)',
    authenticatedQuota: false,
  };
}

function parseDirectSse(sseText: string): {
  videoUrl?: string;
  seed?: number;
  errorMessage?: string;
} {
  const lines = sseText.split('\n');
  let currentEvent = '';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      const dataStr = line.slice(5).trim();
      if (currentEvent === 'error') {
        return {
          errorMessage:
            dataStr && dataStr !== 'null'
              ? dataStr
              : 'Free ZeroGPU queue quota reached for this session.',
        };
      }
      if (currentEvent === 'complete') {
        try {
          const parsed = JSON.parse(dataStr);
          const first = parsed?.[0];
          const url =
            first?.video?.url ||
            first?.url ||
            (first?.video?.path
              ? `${LTX_SPACE_BASE}/gradio_api/file=${first.video.path}`
              : undefined);
          if (url) {
            return {
              videoUrl: url,
              seed: typeof parsed?.[1] === 'number' ? parsed[1] : 42,
            };
          }
        } catch {
          return { errorMessage: 'Unable to parse ZeroGPU stream output.' };
        }
      }
    }
  }
  return { errorMessage: 'No video frame stream returned by free ZeroGPU worker.' };
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
  params.onStage?.('Connecting to Hugging Face ZeroGPU queue...');

  try {
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
  } catch (err) {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        message: 'Generation cancelled by user.',
      };
    }
    // If /api route is absent on a static host, fall through to direct official Gradio Space call
  }

  // Static-host direct Gradio ZeroGPU fallback
  try {
    params.onStage?.('Submitting prompt to Lightricks LTX-Video ZeroGPU...');
    const dims = ASPECT_DIMENSIONS[params.aspectRatio] || ASPECT_DIMENSIONS['16:9'];
    const finalPrompt = `${params.prompt.trim()}, ${STYLE_MODIFIERS[params.style]}`;
    const cleanNeg =
      params.negativePrompt?.trim() ||
      'worst quality, inconsistent motion, blurry, jittery, distorted, watermark';
    const useFixedSeed = typeof params.seed === 'number' && params.seed >= 0;

    const postRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/text_to_video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          finalPrompt,
          cleanNeg,
          null,
          null,
          dims.height,
          dims.width,
          'text-to-video',
          params.duration,
          9,
          useFixedSeed ? Math.floor(params.seed!) : 42,
          !useFixedSeed,
          1,
          true,
        ],
      }),
      signal: params.signal,
    });

    if (!postRes.ok) {
      return {
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: `ZeroGPU Space returned HTTP ${postRes.status}.`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      };
    }

    const { event_id: eventId } = await postRes.json();
    params.onStage?.('Synthesizing DiT video frames on ZeroGPU...');
    const sseRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/text_to_video/${eventId}`, {
      signal: params.signal,
    });
    const sseText = await sseRes.text();
    const parsed = parseDirectSse(sseText);

    if (!parsed.videoUrl) {
      return {
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: parsed.errorMessage,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      };
    }

    return {
      ok: true,
      videoUrl: parsed.videoUrl,
      downloadUrl: parsed.videoUrl,
      seed: parsed.seed ?? 42,
      width: dims.width,
      height: dims.height,
      duration: params.duration,
      model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
    };
  } catch (err) {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        message: 'Generation cancelled by user.',
      };
    }
    return {
      ok: false,
      unavailable: true,
      message:
        'AI video generation is temporarily unavailable while we connect a free processing provider.',
      detail: err instanceof Error ? err.message : 'Network error reaching ZeroGPU.',
      externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
    };
  }
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
  params.onStage?.('Staging reference image for ZeroGPU inference...');

  try {
    const apiRes = await fetch('/api/video/image-to-video', {
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
        message: 'Generation cancelled by user.',
      };
    }
  }

  // Static-host direct Gradio ZeroGPU fallback
  try {
    const fetchBlob = await fetch(params.imageBase64);
    const blob = await fetchBlob.blob();
    const form = new FormData();
    form.append('files', blob, params.fileName || 'reference.jpg');

    const upRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/upload`, {
      method: 'POST',
      body: form,
      signal: params.signal,
    });

    if (!upRes.ok) {
      return {
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: `ZeroGPU upload returned HTTP ${upRes.status}.`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      };
    }

    const upJson = await upRes.json();
    const remotePath = upJson?.[0];
    const dims = ASPECT_DIMENSIONS[params.aspectRatio] || ASPECT_DIMENSIONS['16:9'];
    const finalPrompt = `${params.prompt.trim()}, ${STYLE_MODIFIERS[params.style]}`;
    const cleanNeg =
      params.negativePrompt?.trim() ||
      'worst quality, inconsistent motion, blurry, jittery, distorted';
    const useFixedSeed = typeof params.seed === 'number' && params.seed >= 0;

    params.onStage?.('Synthesizing motion frames from reference image...');
    const postRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/image_to_video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          finalPrompt,
          cleanNeg,
          {
            path: remotePath,
            meta: { _type: 'gradio.FileData' },
            orig_name: params.fileName || 'reference.jpg',
            mime_type: params.mimeType,
          },
          null,
          dims.height,
          dims.width,
          'image-to-video',
          params.duration,
          9,
          useFixedSeed ? Math.floor(params.seed!) : 42,
          !useFixedSeed,
          1,
          true,
        ],
      }),
      signal: params.signal,
    });

    if (!postRes.ok) {
      return {
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: `ZeroGPU Space returned HTTP ${postRes.status}.`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      };
    }

    const { event_id: eventId } = await postRes.json();
    const sseRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/image_to_video/${eventId}`, {
      signal: params.signal,
    });
    const sseText = await sseRes.text();
    const parsed = parseDirectSse(sseText);

    if (!parsed.videoUrl) {
      return {
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: parsed.errorMessage,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      };
    }

    return {
      ok: true,
      videoUrl: parsed.videoUrl,
      downloadUrl: parsed.videoUrl,
      seed: parsed.seed ?? 42,
      width: dims.width,
      height: dims.height,
      duration: params.duration,
      model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
    };
  } catch (err) {
    if (params.signal?.aborted) {
      return {
        ok: false,
        unavailable: false,
        message: 'Generation cancelled by user.',
      };
    }
    return {
      ok: false,
      unavailable: true,
      message:
        'AI video generation is temporarily unavailable while we connect a free processing provider.',
      detail: err instanceof Error ? err.message : 'Network error reaching ZeroGPU.',
      externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
    };
  }
}
