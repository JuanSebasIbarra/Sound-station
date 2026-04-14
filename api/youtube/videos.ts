import { json, ytFetch } from './_shared';

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id')?.trim() ?? '';

    if (!id) {
      return json({ ok: false, message: 'Missing id.' }, 400);
    }

    const params = new URLSearchParams({
      part: 'contentDetails,snippet',
      id,
    });

    const payload = await ytFetch('videos', params);
    return json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    return json({ ok: false, message }, 500);
  }
}
