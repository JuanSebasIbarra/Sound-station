const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

export interface JsonResponse {
  ok: boolean;
  message?: string;
  [key: string]: unknown;
}

export function getApiKey(): string {
  const apiKey = process.env['YOUTUBE_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable.');
  }
  return apiKey;
}

export function json(body: JsonResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function ytFetch(path: string, params: URLSearchParams): Promise<unknown> {
  const apiKey = getApiKey();
  params.set('key', apiKey);

  const response = await fetch(`${YOUTUBE_API_BASE_URL}/${path}?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  return await response.json();
}
