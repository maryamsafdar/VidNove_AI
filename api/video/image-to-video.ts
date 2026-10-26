import type { IncomingMessage, ServerResponse } from 'http';
import {
  handleImageToVideoRequest,
  readJsonBody,
} from '../../src/server/videoBackendCore';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, unavailable: false, message: 'Method not allowed.' }));
    return;
  }

  try {
    const body = await readJsonBody<Record<string, unknown>>(req);
    const result = await handleImageToVideoRequest(body);
    res.statusCode = result.httpStatus;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result.body));
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: false,
        unavailable: false,
        errorCode: 'REQUEST_FAILED',
        message: err instanceof Error ? err.message : 'Invalid request payload.',
      })
    );
  }
}
