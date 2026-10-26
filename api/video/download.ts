import type { IncomingMessage, ServerResponse } from 'http';
import { fetchWhitelistedVideoBuffer } from '../../src/server/videoBackendCore';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed.' }));
    return;
  }

  const parsedReqUrl = new URL(req.url || '/', 'http://localhost');
  const rawUrl = parsedReqUrl.searchParams.get('url') || '';
  const inlineParam = parsedReqUrl.searchParams.get('inline');
  const inline = inlineParam === '1' || inlineParam === 'true';

  const dl = await fetchWhitelistedVideoBuffer(rawUrl);
  if (!dl.ok) {
    res.statusCode = dl.httpStatus;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: dl.error }));
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', dl.contentType);
  res.setHeader('Content-Length', String(dl.buffer.byteLength));
  res.setHeader(
    'Content-Disposition',
    inline ? 'inline' : `attachment; filename="vidnova-ai-${Date.now()}.mp4"`
  );
  res.end(dl.buffer);
}
