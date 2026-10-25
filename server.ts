import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const LTX_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space';
const LTX_SPACE_ID = 'Lightricks/ltx-video-distilled';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
  anamorphic: 'shot on 65mm anamorphic cinema lens, natural film grain, rich tonal contrast, smooth camera motion',
  documentary: '35mm editorial documentary film aesthetic, naturalistic lighting, authentic organic textures, steady camera',
  noir: 'high-contrast architectural cinema, deep obsidian shadows, warm tungsten rim light, atmospheric mist',
  anime: 'hand-painted theatrical anime feature film animation, expressive lighting, detailed atmospheric backgrounds, fluid motion',
  commercial: 'high-speed tabletop commercial cinematography, crisp studio rim lighting, shallow depth of field, pristine detail',
  naturalistic: 'photorealistic cinema, natural daylight illumination, realistic physics and fluid motion',
};

let cachedStatus: {
  checkedAt: number;
  available: boolean;
  stage: string;
  hardware: string;
  provider: string;
  model: string;
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

function parseGradioSseOutput(sseText: string): {
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
        if (!dataStr || dataStr === 'null') {
          return {
            errorMessage: 'ZeroGPU queue limit or provider timeout reached.',
          };
        }
        try {
          const parsedErr = JSON.parse(dataStr);
          return {
            errorMessage:
              typeof parsedErr === 'string'
                ? parsedErr
                : parsedErr?.message || parsedErr?.title || 'Upstream ZeroGPU generation error.',
          };
        } catch {
          return { errorMessage: dataStr };
        }
      }

      if (currentEvent === 'complete') {
        try {
          const parsed = JSON.parse(dataStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0];
            const rawUrl: string | undefined = first?.video?.url || first?.url;
            const rawPath: string | undefined = first?.video?.path || first?.path;
            const resolvedUrl =
              rawUrl ||
              (rawPath ? `${LTX_SPACE_BASE}/gradio_api/file=${rawPath}` : undefined);
            const seed = typeof parsed[1] === 'number' ? parsed[1] : undefined;
            if (resolvedUrl) {
              return { videoUrl: resolvedUrl, seed };
            }
          }
        } catch {
          return { errorMessage: 'Unable to parse ZeroGPU response payload.' };
        }
      }
    }
  }

  return {
    errorMessage: 'Free ZeroGPU worker did not return a completed video stream.',
  };
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

  // Live ZeroGPU Provider Health Check
  app.get('/api/video/status', async (_req: Request, res: Response) => {
    const now = Date.now();
    if (cachedStatus && now - cachedStatus.checkedAt < 60_000) {
      res.json(cachedStatus);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const hubRes = await fetch(`https://huggingface.co/api/spaces/${LTX_SPACE_ID}`, {
        headers: getHfHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!hubRes.ok) {
        throw new Error(`Hub status ${hubRes.status}`);
      }

      const data = (await hubRes.json()) as {
        runtime?: { stage?: string; hardware?: { current?: string } };
      };
      const stage = data.runtime?.stage || 'UNKNOWN';
      const hardware = data.runtime?.hardware?.current || 'zero-a10g';
      const available = stage === 'RUNNING';

      cachedStatus = {
        checkedAt: now,
        available,
        stage,
        hardware,
        provider: 'Hugging Face ZeroGPU (Free Community Tier)',
        model: 'Lightricks/LTX-Video Distilled (Open-Weight DiT)',
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
        model: 'Lightricks/LTX-Video Distilled (Open-Weight DiT)',
        authenticatedQuota: Boolean(getOptionalServerHfToken()),
      });
    }
  });

  // Real Text-to-Video Generation via Official Lightricks LTX-Video ZeroGPU Space
  app.post('/api/video/text-to-video', async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        negativePrompt,
        aspectRatio = '16:9',
        duration = 2,
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
          message: 'Please enter a descriptive scene prompt of at least 4 characters.',
        });
        return;
      }
      if (trimmedPrompt.length > 1200) {
        res.status(400).json({
          ok: false,
          unavailable: false,
          message: 'Prompt must be 1,200 characters or fewer.',
        });
        return;
      }

      const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['16:9'];
      const clampedDuration = Math.min(4, Math.max(2, Number(duration) || 2));
      const styleSuffix = STYLE_MODIFIERS[style] || STYLE_MODIFIERS.anamorphic;
      const finalPrompt = trimmedPrompt.toLowerCase().includes(styleSuffix.slice(0, 18).toLowerCase())
        ? trimmedPrompt
        : `${trimmedPrompt}, ${styleSuffix}`;
      const cleanNegative =
        (negativePrompt || '').trim() ||
        'worst quality, inconsistent motion, blurry, jittery, distorted, watermark, deformed';
      const useFixedSeed = typeof seed === 'number' && Number.isFinite(seed) && seed >= 0;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 110_000);

      const postRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/text_to_video`, {
        method: 'POST',
        headers: getHfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
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
            1,
            true,
          ],
        }),
        signal: controller.signal,
      });

      if (!postRes.ok) {
        clearTimeout(timeout);
        const errText = await postRes.text().catch(() => '');
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail:
            errText.slice(0, 240) ||
            `Upstream ZeroGPU Space returned HTTP ${postRes.status} (shared free queue busy or quota reached).`,
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      const { event_id: eventId } = (await postRes.json()) as { event_id?: string };
      if (!eventId) {
        clearTimeout(timeout);
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail: 'ZeroGPU queue did not issue a job event identifier.',
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      const sseRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/text_to_video/${eventId}`, {
        headers: getHfHeaders(),
        signal: controller.signal,
      });
      const sseText = await sseRes.text();
      clearTimeout(timeout);

      const parsed = parseGradioSseOutput(sseText);
      if (!parsed.videoUrl) {
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail:
            parsed.errorMessage ||
            'Shared free Hugging Face ZeroGPU quota is currently exhausted. Try again shortly or use the official Hugging Face Space with a free account.',
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      res.json({
        ok: true,
        videoUrl: parsed.videoUrl,
        downloadUrl: `/api/video/download?url=${encodeURIComponent(parsed.videoUrl)}`,
        seed: parsed.seed ?? 42,
        width: dims.width,
        height: dims.height,
        duration: clampedDuration,
        model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unexpected network error';
      res.status(503).json({
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: `Free ZeroGPU connection interrupted (${reason}).`,
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
        duration = 2,
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
          message:
            'Please confirm upload rights and external ZeroGPU processing consent before generating.',
        });
        return;
      }

      if (!imageBase64 || !mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          ok: false,
          unavailable: false,
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
          message: 'Image size must be greater than 0 bytes and at most 8 MB.',
        });
        return;
      }

      const trimmedPrompt =
        (prompt || '').trim() ||
        'Natural cinematic camera movement, subtle atmospheric motion, photorealistic lighting';
      const dims = ASPECT_DIMENSIONS[aspectRatio] || ASPECT_DIMENSIONS['16:9'];
      const clampedDuration = Math.min(4, Math.max(2, Number(duration) || 2));
      const styleSuffix = STYLE_MODIFIERS[style] || STYLE_MODIFIERS.anamorphic;
      const finalPrompt = `${trimmedPrompt}, ${styleSuffix}`;
      const cleanNegative =
        (negativePrompt || '').trim() ||
        'worst quality, inconsistent motion, blurry, jittery, distorted, deformed';
      const useFixedSeed = typeof seed === 'number' && Number.isFinite(seed) && seed >= 0;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      // Step 1: Upload transient image buffer to Gradio Space (never stored on VidNova disk)
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
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
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
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail: 'ZeroGPU upload endpoint returned an empty file reference.',
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      // Step 2: Invoke /image_to_video on Lightricks ZeroGPU
      const postRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/image_to_video`, {
        method: 'POST',
        headers: getHfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
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
            1,
            true,
          ],
        }),
        signal: controller.signal,
      });

      if (!postRes.ok) {
        clearTimeout(timeout);
        const errText = await postRes.text().catch(() => '');
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail:
            errText.slice(0, 240) ||
            `Upstream ZeroGPU Space returned HTTP ${postRes.status} (shared free queue busy or quota reached).`,
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      const { event_id: eventId } = (await postRes.json()) as { event_id?: string };
      if (!eventId) {
        clearTimeout(timeout);
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail: 'ZeroGPU queue did not issue a job event identifier.',
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      const sseRes = await fetch(`${LTX_SPACE_BASE}/gradio_api/call/image_to_video/${eventId}`, {
        headers: getHfHeaders(),
        signal: controller.signal,
      });
      const sseText = await sseRes.text();
      clearTimeout(timeout);

      const parsed = parseGradioSseOutput(sseText);
      if (!parsed.videoUrl) {
        res.status(503).json({
          ok: false,
          unavailable: true,
          message:
            'AI video generation is temporarily unavailable while we connect a free processing provider.',
          detail:
            parsed.errorMessage ||
            'Shared free Hugging Face ZeroGPU quota is currently exhausted. Try Photo Motion for instant browser animation or revisit shortly.',
          externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
        });
        return;
      }

      res.json({
        ok: true,
        videoUrl: parsed.videoUrl,
        downloadUrl: `/api/video/download?url=${encodeURIComponent(parsed.videoUrl)}`,
        seed: parsed.seed ?? 42,
        width: dims.width,
        height: dims.height,
        duration: clampedDuration,
        model: 'Lightricks/LTX-Video Distilled (ZeroGPU)',
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unexpected network error';
      res.status(503).json({
        ok: false,
        unavailable: true,
        message:
          'AI video generation is temporarily unavailable while we connect a free processing provider.',
        detail: `Free ZeroGPU connection interrupted (${reason}).`,
        externalDemoUrl: 'https://huggingface.co/spaces/Lightricks/ltx-video-distilled',
      });
    }
  });

  // Safe Whitelisted MP4 Download Proxy (prevents SSRF while enabling direct 1-click MP4 save)
  app.get('/api/video/download', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!rawUrl.startsWith(`${LTX_SPACE_BASE}/gradio_api/file=`)) {
      res.status(400).json({ error: 'Invalid video asset URL.' });
      return;
    }

    try {
      const upstream = await fetch(rawUrl, { headers: getHfHeaders() });
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
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'));
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
