import { json, ytFetch } from './_shared';

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() ?? '';

    if (!q) {
      return json({ ok: false, message: 'Missing q.' }, 400);
    }

    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: '10',
      q,
      type: 'video',
      videoCategoryId: '10',
    });

    const payload = await ytFetch('search', params);
    return json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    return json({ ok: false, message }, 500);
  }
}
