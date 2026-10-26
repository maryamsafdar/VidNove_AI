import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  fetchWhitelistedVideoBuffer,
  getProviderStatusData,
  handleImageToVideoRequest,
  handleTextToVideoRequest,
} from './src/server/videoBackendCore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

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

  app.get('/api/video/status', async (_req: Request, res: Response) => {
    const status = await getProviderStatusData();
    res.json(status);
  });

  app.post('/api/video/text-to-video', async (req: Request, res: Response) => {
    const result = await handleTextToVideoRequest((req.body || {}) as Record<string, unknown>);
    res.status(result.httpStatus).json(result.body);
  });

  app.post('/api/video/image-to-video', async (req: Request, res: Response) => {
    const result = await handleImageToVideoRequest((req.body || {}) as Record<string, unknown>);
    res.status(result.httpStatus).json(result.body);
  });

  app.get('/api/video/download', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const inline = req.query.inline === '1' || req.query.inline === 'true';
    const dl = await fetchWhitelistedVideoBuffer(rawUrl);

    if (!dl.ok) {
      res.status(dl.httpStatus).json({ error: dl.error });
      return;
    }

    res.setHeader('Content-Type', dl.contentType);
    res.setHeader('Content-Length', String(dl.buffer.byteLength));
    res.setHeader(
      'Content-Disposition',
      inline ? 'inline' : `attachment; filename="vidnova-ai-${Date.now()}.mp4"`
    );
    res.send(dl.buffer);
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
