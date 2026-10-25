import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const LTX_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space';
const LTX_SPACE_ID = 'Lightricks/ltx-video-distilled';

const ADL_SPACE_BASE = 'https://bytedance-animatediff-lightning.hf.space';
const ADL_SPACE_ID = 'ByteDance/AnimateDiff-Lightning';

const ZEROSCOPE_SPACE_BASE = 'https://hysts-zeroscope-v2.hf.space';
const WAN_I2V_SPACE_BASE = 'https://presalesaiautomation-imagetovideo.hf.space';

const ALLOWED_DOWNLOAD_ORIGINS = new Set([
  LTX_SPACE_BASE,
  ADL_SPACE_BASE,
  ZEROSCOPE_SPACE_BASE,
  WAN_I2V_SPACE_BASE,
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type VideoErrorCode =
  | 'MISSING_CONFIG'
  | 'QUOTA_EXHAUSTED'
  | 'BACKEND_UNAVAILABLE'
  | 'REQUEST_FAILED';

interface AspectDimensions {
  width: number;
  height: number;
}

const ASPECT_DIMENSIONS: Record<string, AspectDimensions> = {
  '16:9': { width: 768, height: 448 },
  '9:16': { width: 448, height: 768 },
  '1:1': { width: 576, height: 576 },
  '4:3': { width: 704, height: 512 },
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

let cachedStatus: {
  checkedAt: number;
  available: boolean;
  stage: string;
  hardware: string;
  provider: string;
  model: string;
  fallbackModel: string;
  fallbackAvailable: boolean;
  authenticatedQuota: boolean;
} | null = null;

function getOptionalServerHfToken(): string | null {
  const token = process.env.HF_TOKEN?.trim();
  // Only attach if a genuine Hugging Face access token ("hf_...") is configured server-side.
  if (token && token.startsWith('hf_') && token.length >= 10) {
    return token;
  }
  return null;
}

function getHfHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const validToken = getOptionalServerHfToken();
  if (validToken) {
    headers['Authorization'] = `Bearer ${validToken}`;
  }
  return headers;
}

function classifyUpstreamError(rawMessage: string): VideoErrorCode {
  if (/quota|exceeded|runs limit|rate limit|too many requests|429/i.test(rawMessage)) {
    return 'QUOTA_EXHAUSTED';
  }
  if (/paused|sleeping|building|stopped|unreachable|502|503|504|fetch failed|abort/i.test(rawMessage)) {
    return 'BACKEND_UNAVAILABLE';
  }
  return 'REQUEST_FAILED';
}

async function runGradioQueueJob(options: {
  spaceBase: string;
  apiPrefix: '/gradio_api' | '';
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

  if (!joinRes.ok) {
    const errBody = await joinRes.text().catch(() => '');
    const msg =
      errBody.slice(0, 260) ||
      `Upstream Space queue returned HTTP ${joinRes.status}.`;
    return {
      errorCode: joinRes.status === 429 ? 'QUOTA_EXHAUSTED' : classifyUpstreamError(msg),
      errorMessage: msg,
    };
  }

  const sseRes = await fetch(dataUrl, {
    headers: getHfHeaders(),
    signal: options.signal,
  });

  if (!sseRes.ok) {
    return {
      errorCode: 'BACKEND_UNAVAILABLE',
      errorMessage: `Upstream Space event stream returned HTTP ${sseRes.status}.`,
    };
  }

  const sseText = await sseRes.text();
  const lines = sseText.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const jsonStr = line.slice(5).trim();
    if (!jsonStr || jsonStr === 'null') continue;

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
      payload = JSON.parse(jsonStr);
    } catch {
      continue;
    }

    if (payload.msg === 'queue_full') {
      return {
        errorCode: 'QUOTA_EXHAUSTED',
        errorMessage: 'Free community GPU queue is temporarily full. Please retry in a moment.',
      };
    }

    if (payload.msg === 'unexpected_error') {
      const errText = payload.message || 'Upstream Space reported an unexpected queue error.';
      return {
        errorCode: classifyUpstreamError(errText),
        errorMessage: errText,
      };
    }

    if (payload.msg === 'process_completed') {
      if (payload.success === false || payload.output?.error) {
        const errDetail =
          payload.output?.error ||
          payload.output?.title ||
          payload.title ||
          'Upstream ZeroGPU task ended without output.';
        return {
          errorCode: classifyUpstreamError(errDetail),
          errorMessage: errDetail,
        };
      }

      const outData = payload.output?.data;
      if (Array.isArray(outData) && outData.length > 0) {
        const first = outData[0];
        if (first && typeof first === 'object') {
          const directUrl = first.video?.url || first.url;
          const rawPath = first.video?.path || first.path;
          const filePrefix = options.apiPrefix ? `${options.apiPrefix}/file=` : '/file=';
          const resolvedUrl =
            directUrl || (rawPath ? `${options.spaceBase}${filePrefix}${rawPath}` : undefined);
          const returnedSeed = typeof outData[1] === 'number' ? outData[1] : undefined;
          if (resolvedUrl) {
            return {
              videoUrl: resolvedUrl,
              seed: returnedSeed,
            };
          }
        }
      }

      return {
        errorCode: 'REQUEST_FAILED',
        errorMessage: 'Upstream model completed without returning a playable MP4 stream (prompt may have triggered safety filter).',
      };
    }
  }

  return {
    errorCode: 'BACKEND_UNAVAILABLE',
    errorMessage: 'Upstream GPU stream closed before video synthesis finished.',
  };
}

function buildUserFacingErrorMessage(code: VideoErrorCode, modeLabel: string): string {
  switch (code) {
    case 'MISSING_CONFIG':
      return `${modeLabel} configuration is incomplete.`;
    case 'QUOTA_EXHAUSTED':
      return `Free Hugging Face ZeroGPU quota is currently exhausted for this shared IP.`;
    case 'BACKEND_UNAVAILABLE':
      return `The free open-source ${modeLabel} GPU backend is temporarily unreachable or waking up.`;
    case 'REQUEST_FAILED':
    default:
      return `${modeLabel} request could not be completed by the upstream provider.`;
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Dynamic SEO endpoints using APP_URL when available
  app.get('/robots.txt', (req: Request, res: Response) => {
    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
    res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
    const routes = [
      { path: '/', priority: '1.0', freq: 'weekly' },
      { path: '/studio', priority: '0.95', freq: 'weekly' },
      { path: '/explore', priority: '0.85', freq: 'weekly' },
      { path: '/text-to-video', priority: '0.85', freq: 'monthly' },
      { path: '/image-to-video', priority: '0.85', freq: 'monthly' },
      { path: '/how-it-works', priority: '0.80', freq: 'monthly' },
      { path: '/faq', priority: '0.75', freq: 'monthly' },
      { path: '/contact', priority: '0.60', freq: 'yearly' },
      { path: '/privacy', priority: '0.50', freq: 'yearly' },
      { path: '/terms', priority: '0.50', freq: 'yearly' },
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <changefreq>${r.freq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  // Live ZeroGPU Multi-Provider Health Check
  app.get('/api/video/status', async (_req: Request, res: Response) => {
    const now = Date.now();
    if (cachedStatus && now - cachedStatus.checkedAt < 60_000) {
      res.json(cachedStatus);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const [ltxRes, adlRes] = await Promise.allSettled([
        fetch(`https://huggingface.co/api/spaces/${LTX_SPACE_ID}`, {
          headers: getHfHeaders(),
          signal: controller.signal,
        }),
        fetch(`https://huggingface.co/api/spaces/${ADL_SPACE_ID}`, {
          headers: getHfHeaders(),
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timeout);

      let ltxStage = 'UNKNOWN';
      let hardware = 'zero-a10g';
      if (ltxRes.status === 'fulfilled' && ltxRes.value.ok) {
        const data = (await ltxRes.value.json()) as {
          runtime?: { stage?: string; hardware?: { current?: string } };
        };
        ltxStage = data.runtime?.stage || 'UNKNOWN';
        hardware = data.runtime?.hardware?.current || 'zero-a10g';
      }

      let adlStage = 'UNKNOWN';
      if (adlRes.status === 'fulfilled' && adlRes.value.ok) {
        const adlData = (await adlRes.value.json()) as {
          runtime?: { stage?: string };
        };
        adlStage = adlData.runtime?.stage || 'UNKNOWN';
      }

      const ltxRunning = ltxStage === 'RUNNING';
      const adlRunning = adlStage === 'RUNNING';

      cachedStatus = {
        checkedAt: now,
        available: ltxRunning || adlRunning,
        stage: ltxRunning ? 'RUNNING' : adlRunning ? 'FALLBACK_READY' : ltxStage,
        hardware,
        provider: 'Hugging Face ZeroGPU (Free Community Tier)',
        model: 'Lightricks/LTX-Video + AnimateDiff-Lightning',
        fallbackModel: 'ByteDance/AnimateDiff-Lightning (4-Step)',
        fallbackAvailable: adlRunning,
        authenticatedQuota: Boolean(getOptionalServerHfToken()),
      };
      res.json(cachedStatus);
    } catch {
      res.json({
        checkedAt: now,
        available: false,
        stage: 'UNREACHABLE',
        hardware: 'zero-a10g',
        provider: 'Hugging Face ZeroGPU (Free Community Tier)',
        model: 'Lightricks/LTX-Video + AnimateDiff-Lightning',
        fallbackModel: 'ByteDance/AnimateDiff-Lightning (4-Step)',
        fallbackAvailable: false,
        authenticatedQuota: Boolean(getOptionalServerHfToken()),
      });
    }
  });

  // Real Text-to-Video Generation (Primary: Lightricks LTX-Video 2-4s -> Free Fallback: ByteDance AnimateDiff-Lightning)
  app.post('/api/video/text-to-video', async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        negativePrompt,
        aspectRatio = '16:9',
        duration = 4,
        style = 'anamorphic',
        seed,
      } = req.body as {
        prompt?: string;
        negativePrompt?: string;
        aspectRatio?: string;
        duration?: number;
        style?: string;
        seed?: number;
      };

      const trimmedPrompt = (prompt || '').trim();
      if (trimmedPrompt.length < 4) {
        res.status(400).json({
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Please enter a descriptive scene prompt of at least 4 characters.',
        });
        return;
      }
      if (trimmedPrompt.length > 1200) {
        res.status(400).json({
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Prompt must be 1,200 characters or fewer.',
        });
        return;
      }

      const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['16:9'];
      const clampedDuration = Math.min(4, Math.max(2, Number(duration) || 4));
      const styleSuffix = STYLE_MODIFIERS[style] || STYLE_MODIFIERS.anamorphic;
      const englishPrompt = normalizePromptWithRomanUrdu(trimmedPrompt);
      const finalPrompt = englishPrompt.toLowerCase().includes(styleSuffix.slice(0, 18).toLowerCase())
        ? englishPrompt
        : `${englishPrompt}, ${styleSuffix}`;
      const cleanNegative =
        (negativePrompt || '').trim() ||
        'worst quality, inconsistent motion, blurry, jittery, distorted, watermark, deformed';
      const useFixedSeed = typeof seed === 'number' && Number.isFinite(seed) && seed >= 0;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 115_000);

      // 1. Primary Attempt: Official Lightricks/ltx-video-distilled (2s - 4s DiT synthesis)
      const ltxResult = await runGradioQueueJob({
        spaceBase: LTX_SPACE_BASE,
        apiPrefix: '/gradio_api',
        fnIndex: 4,
        data: [
          finalPrompt,
          cleanNegative,
          null,
          null,
          dims.height,
          dims.width,
          'text-to-video',
          clampedDuration,
          9,
          useFixedSeed ? Math.floor(seed!) : 42,
          !useFixedSeed,
          3.0,
          true,
        ],
        signal: controller.signal,
      }).catch((err: unknown) => ({
        videoUrl: undefined,
        seed: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'LTX-Video connection failed.',
      }));

      if (ltxResult.videoUrl) {
        clearTimeout(timeout);
        res.json({
          ok: true,
          videoUrl: ltxResult.videoUrl,
          downloadUrl: `/api/video/download?url=${encodeURIComponent(ltxResult.videoUrl)}`,
          seed: ltxResult.seed ?? (useFixedSeed ? Math.floor(seed!) : 42),
          width: dims.width,
          height: dims.height,
          duration: clampedDuration,
          model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
        });
        return;
      }

      // 2. Tier-2 4-Second Widescreen Fallback: hysts/zeroscope-v2 (requests only 60s ZeroGPU vs LTX 120s, outputs 24-32 frames @ 8fps = 3-4s)
      const zsSeed = useFixedSeed ? Math.floor(seed!) : Math.floor(Math.random() * 1_000_000);
      const zsFrames = Math.max(24, clampedDuration * 8);
      const compactPrompt = finalPrompt.slice(0, 340);

      const zsResult = await runGradioQueueJob({
        spaceBase: ZEROSCOPE_SPACE_BASE,
        apiPrefix: '/gradio_api',
        fnIndex: 3,
        data: [compactPrompt, zsSeed, zsFrames, 22],
        signal: controller.signal,
      }).catch((err: unknown) => ({
        videoUrl: undefined,
        seed: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'Zeroscope-v2 connection failed.',
      }));

      if (zsResult.videoUrl) {
        clearTimeout(timeout);
        const actualSec = Number((zsFrames / 8).toFixed(1));
        res.json({
          ok: true,
          videoUrl: zsResult.videoUrl,
          downloadUrl: `/api/video/download?url=${encodeURIComponent(zsResult.videoUrl)}`,
          seed: zsSeed,
          width: 576,
          height: 320,
          duration: actualSec,
          model: 'Zeroscope-v2 576w (Free ZeroGPU · 16:9)',
          fallbackNotice: `Primary LTX-Video 120s GPU slot was busy, so VidNova AI synthesized a genuine ${actualSec}s (576×320) widescreen clip via Zeroscope-v2.`,
        });
        return;
      }

      // 3. Tier-3 Fast Distilled Fallback: Official ByteDance/AnimateDiff-Lightning
      const baseModel = style === 'anime' ? 'ToonYou' : 'epiCRealism';
      const motionLora = pickAnimateDiffMotionLora(finalPrompt);

      const adlResult = await runGradioQueueJob({
        spaceBase: ADL_SPACE_BASE,
        apiPrefix: '',
        fnIndex: 0,
        data: [compactPrompt, baseModel, motionLora, 4],
        signal: controller.signal,
      }).catch((err: unknown) => ({
        videoUrl: undefined,
        seed: undefined,
        errorCode: 'BACKEND_UNAVAILABLE' as VideoErrorCode,
        errorMessage: err instanceof Error ? err.message : 'AnimateDiff-Lightning connection failed.',
      }));

      clearTimeout(timeout);

      if (adlResult.videoUrl) {
        res.json({
          ok: true,
          videoUrl: adlResult.videoUrl,
          downloadUrl: `/api/video/download?url=${encodeURIComponent(adlResult.videoUrl)}`,
          seed: useFixedSeed ? Math.floor(seed!) : 42,
          width: 512,
          height: 512,
          duration: 1.6,
          model: `ByteDance/AnimateDiff-Lightning (${baseModel} · 4-Step Free GPU)`,
          fallbackNotice:
            ltxResult.errorCode === 'QUOTA_EXHAUSTED'
              ? `Primary ${clampedDuration}s LTX-Video ZeroGPU quota was full on this shared IP, so VidNova AI synthesized a real 1.6s (512×512, 16-frame) neural video clip via ByteDance AnimateDiff-Lightning at zero cost.`
              : `Primary LTX-Video queue was unavailable, so VidNova AI synthesized a real 1.6s (512×512) neural video clip via ByteDance AnimateDiff-Lightning.`,
        });
        return;
      }

      const finalCode = ltxResult.errorCode || adlResult.errorCode || 'BACKEND_UNAVAILABLE';
      const httpStatus = finalCode === 'QUOTA_EXHAUSTED' ? 429 : 503;

      res.status(httpStatus).json({
        ok: false,
        unavailable: true,
        errorCode: finalCode,
        message: buildUserFacingErrorMessage(finalCode, 'AI Text-to-Video'),
        detail: `LTX-Video: ${ltxResult.errorMessage || 'Unavailable'} | AnimateDiff-Lightning: ${
          adlResult.errorMessage || 'Unavailable'
        }`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unexpected network error';
      const code = classifyUpstreamError(reason);
      res.status(code === 'QUOTA_EXHAUSTED' ? 429 : 503).json({
        ok: false,
        unavailable: true,
        errorCode: code,
        message: buildUserFacingErrorMessage(code, 'AI Text-to-Video'),
        detail: `Connection interrupted (${reason}).`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      });
    }
  });

  // Real Image-to-Video Generation via Official Lightricks LTX-Video ZeroGPU Space
  app.post('/api/video/image-to-video', async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        negativePrompt,
        imageBase64,
        mimeType,
        fileName = 'frame.jpg',
        aspectRatio = '16:9',
        duration = 4,
        style = 'anamorphic',
        hasPermission = false,
        seed,
      } = req.body as {
        prompt?: string;
        negativePrompt?: string;
        imageBase64?: string;
        mimeType?: string;
        fileName?: string;
        aspectRatio?: string;
        duration?: number;
        style?: string;
        hasPermission?: boolean;
        seed?: number;
      };

      if (!hasPermission) {
        res.status(400).json({
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message:
            'Please confirm upload rights and external ZeroGPU processing consent before generating.',
        });
        return;
      }

      if (!imageBase64 || !mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Please provide a valid JPG, PNG, or WebP image file.',
        });
        return;
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const imgBuffer = Buffer.from(cleanBase64, 'base64');

      if (imgBuffer.byteLength === 0 || imgBuffer.byteLength > MAX_IMAGE_BYTES) {
        res.status(400).json({
          ok: false,
          unavailable: false,
          errorCode: 'REQUEST_FAILED',
          message: 'Image size must be greater than 0 bytes and at most 8 MB.',
        });
        return;
      }

      const trimmedPrompt =
        (prompt || '').trim() ||
        'Natural cinematic camera movement, subtle atmospheric motion, photorealistic lighting';
      const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['16:9'];
      const clampedDuration = Math.min(4, Math.max(2, Number(duration) || 4));
      const styleSuffix = STYLE_MODIFIERS[style] || STYLE_MODIFIERS.anamorphic;
      const englishPrompt = normalizePromptWithRomanUrdu(trimmedPrompt);
      const finalPrompt = `${englishPrompt}, ${styleSuffix}`;
      const cleanNegative =
        (negativePrompt || '').trim() ||
        'worst quality, inconsistent motion, blurry, jittery, distorted, deformed';
      const useFixedSeed = typeof seed === 'number' && Number.isFinite(seed) && seed >= 0;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      // Step 1: Upload transient image buffer to Lightricks Gradio Space (never stored on VidNova disk)
      const formData = new FormData();
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'reference.jpg';
      formData.append('files', new Blob([imgBuffer], { type: mimeType }), safeName);

      const uploadRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/upload`, {
        method: 'POST',
        headers: getHfHeaders(),
        body: formData,
        signal: controller.signal,
      });

      if (!uploadRes.ok) {
        clearTimeout(timeout);
        const code: VideoErrorCode =
          uploadRes.status === 429 ? 'QUOTA_EXHAUSTED' : 'BACKEND_UNAVAILABLE';
        res.status(code === 'QUOTA_EXHAUSTED' ? 429 : 503).json({
          ok: false,
          unavailable: true,
          errorCode: code,
          message: buildUserFacingErrorMessage(code, 'AI Image-to-Video'),
          detail: `Unable to stage reference frame on ZeroGPU Space (HTTP ${uploadRes.status}).`,
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      const uploadedPaths = (await uploadRes.json()) as string[];
      const remotePath = uploadedPaths?.[0];
      if (!remotePath) {
        clearTimeout(timeout);
        res.status(503).json({
          ok: false,
          unavailable: true,
          errorCode: 'BACKEND_UNAVAILABLE',
          message: buildUserFacingErrorMessage('BACKEND_UNAVAILABLE', 'AI Image-to-Video'),
          detail: 'ZeroGPU upload endpoint returned an empty file reference.',
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      // Step 2: Invoke /image_to_video (fn_index 5) on Lightricks ZeroGPU via Queue API
      const ltxI2v = await runGradioQueueJob({
        spaceBase: LTX_SPACE_BASE,
        apiPrefix: '/gradio_api',
        fnIndex: 5,
        data: [
          finalPrompt,
          cleanNegative,
          {
            path: remotePath,
            meta: { _type: 'gradio.FileData' },
            orig_name: safeName,
            mime_type: mimeType,
          },
          null,
          dims.height,
          dims.width,
          'image-to-video',
          clampedDuration,
          9,
          useFixedSeed ? Math.floor(seed!) : 42,
          !useFixedSeed,
          3.0,
          true,
        ],
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (ltxI2v.videoUrl) {
        res.json({
          ok: true,
          videoUrl: ltxI2v.videoUrl,
          downloadUrl: `/api/video/download?url=${encodeURIComponent(ltxI2v.videoUrl)}`,
          seed: ltxI2v.seed ?? (useFixedSeed ? Math.floor(seed!) : 42),
          width: dims.width,
          height: dims.height,
          duration: clampedDuration,
          model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
        });
        return;
      }

      const errCode = ltxI2v.errorCode || 'QUOTA_EXHAUSTED';
      const httpStatus = errCode === 'QUOTA_EXHAUSTED' ? 429 : 503;

      res.status(httpStatus).json({
        ok: false,
        unavailable: true,
        errorCode: errCode,
        message: buildUserFacingErrorMessage(errCode, 'AI Image-to-Video'),
        detail:
          errCode === 'QUOTA_EXHAUSTED'
            ? `${
                ltxI2v.errorMessage || 'ZeroGPU free runs limit reached.'
              } Tip: Switch to "Photo Motion (Browser Photo Animation)" for instant, unlimited 4-second local camera animation with zero token or paid API.`
            : ltxI2v.errorMessage || 'Upstream Image-to-Video worker did not complete.',
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unexpected network error';
      const code = classifyUpstreamError(reason);
      res.status(code === 'QUOTA_EXHAUSTED' ? 429 : 503).json({
        ok: false,
        unavailable: true,
        errorCode: code,
        message: buildUserFacingErrorMessage(code, 'AI Image-to-Video'),
        detail: `Free ZeroGPU connection interrupted (${reason}).`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      });
    }
  });

  // Safe Whitelisted MP4 Download Proxy (prevents SSRF while enabling direct 1-click MP4 save)
  app.get('/api/video/download', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid video asset URL.' });
      return;
    }

    const isAllowedOrigin = ALLOWED_DOWNLOAD_ORIGINS.has(parsedUrl.origin);
    const isGradioFilePath =
      parsedUrl.pathname.startsWith('/gradio_api/file=') ||
      parsedUrl.pathname.startsWith('/file=');

    if (!isAllowedOrigin || !isGradioFilePath) {
      res.status(400).json({ error: 'Disallowed upstream video asset host or path.' });
      return;
    }

    try {
      const upstream = await fetch(parsedUrl.toString(), { headers: getHfHeaders() });
      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: 'Upstream video file expired or unavailable.' });
        return;
      }

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vidnova-ai-${Date.now()}.mp4"`
      );
      const arrayBuf = await upstream.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    } catch {
      res.status(502).json({ error: 'Failed to download generated MP4 stream.' });
    }
  });

  // Vite middleware in development, static dist serving in production
  const isProd =
    process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VidNova AI server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start VidNova AI server:', err);
  process.exit(1);
});
