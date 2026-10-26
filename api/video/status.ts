import type { IncomingMessage, ServerResponse } from 'http';
import { getProviderStatusData } from '../../src/server/videoBackendCore';

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

  const status = await getProviderStatusData();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(status));
}
