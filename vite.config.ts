import { defineConfig } from 'vite';
import { resolve } from 'path';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

function toJson(res: import('node:http').ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function ytFetch(path: string, params: URLSearchParams): Promise<unknown> {
  const apiKey = process.env['YOUTUBE_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY in environment.');
  }

  params.set('key', apiKey);
  const response = await fetch(`${YOUTUBE_API_BASE_URL}/${path}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status}`);
  }

  return await response.json();
}

interface PlaylistVideoRenderer {
  videoId?: string;
  title?: {
    simpleText?: string;
    runs?: Array<{ text?: string }>;
  };
  shortBylineText?: {
    runs?: Array<{ text?: string }>;
  };
  thumbnail?: {
    thumbnails?: Array<{ url?: string }>;
  };
}

function readText(value: { simpleText?: string; runs?: Array<{ text?: string }> } | undefined): string {
  if (!value) return '';
  if (value.simpleText?.trim()) return value.simpleText.trim();
  return (value.runs ?? []).map((entry) => entry.text ?? '').join('').trim();
}

function findFirstString(node: unknown, key: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined;

  if (Array.isArray(node)) {
    for (const item of node) {
      const value = findFirstString(item, key);
      if (value) return value;
    }
    return undefined;
  }

  const record = node as Record<string, unknown>;
  const own = record[key];
  if (typeof own === 'string' && own.trim()) {
    return own.trim();
  }

  for (const value of Object.values(record)) {
    const nested = findFirstString(value, key);
    if (nested) return nested;
  }

  return undefined;
}

function collectPlaylistVideoRenderers(node: unknown, out: PlaylistVideoRenderer[]): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectPlaylistVideoRenderers(item, out);
    }
    return;
  }

  const record = node as Record<string, unknown>;
  const renderer = record['playlistVideoRenderer'];
  if (renderer && typeof renderer === 'object') {
    out.push(renderer as PlaylistVideoRenderer);
  }

  for (const value of Object.values(record)) {
    collectPlaylistVideoRenderers(value, out);
  }
}

function extractInitialData(html: string): unknown {
  const patterns = [
    /ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/,
    /var\s+ytInitialData\s*=\s*(\{[\s\S]*?\});/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (!match?.[1]) continue;
    try {
      return JSON.parse(match[1]);
    } catch {
      // keep trying
    }
  }

  throw new Error('Could not parse playlist page data.');
}

function pickThumbnails(renderer: PlaylistVideoRenderer): {
  default?: { url?: string };
  medium?: { url?: string };
  high?: { url?: string };
  standard?: { url?: string };
  maxres?: { url?: string };
} {
  const thumbs = renderer.thumbnail?.thumbnails ?? [];
  return {
    default: thumbs[0],
    medium: thumbs[1] ?? thumbs[0],
    high: thumbs[2] ?? thumbs[1] ?? thumbs[0],
    standard: thumbs[3] ?? thumbs[2] ?? thumbs[1] ?? thumbs[0],
    maxres: thumbs[4] ?? thumbs[3] ?? thumbs[2] ?? thumbs[1] ?? thumbs[0],
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    {
      name: 'youtube-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/youtube', async (req, res, next) => {
          try {
            const requestUrl = new URL(req.url ?? '/', 'http://localhost');
            const pathname = requestUrl.pathname;

            if (pathname === '/playlist') {
              const playlistId = requestUrl.searchParams.get('playlistId')?.trim() ?? '';

              if (!playlistId) {
                toJson(res, 400, { ok: false, message: 'Missing playlistId.' });
                return;
              }

              const page = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en`, {
                method: 'GET',
                headers: {
                  'user-agent': 'Mozilla/5.0',
                  accept: 'text/html',
                },
              });

              if (!page.ok) {
                toJson(res, 502, { ok: false, message: `YouTube playlist fetch failed (${page.status}).` });
                return;
              }

              const html = await page.text();
              const initialData = extractInitialData(html);
              const playlistTitle = findFirstString(initialData, 'title') ?? `YouTube Playlist · ${playlistId}`;

              const renderers: PlaylistVideoRenderer[] = [];
              collectPlaylistVideoRenderers(initialData, renderers);

              const seen = new Set<string>();
              const items = renderers
                .map((renderer) => {
                  const videoId = renderer.videoId?.trim();
                  if (!videoId || seen.has(videoId)) return null;
                  seen.add(videoId);

                  const title = readText(renderer.title) || 'Untitled video';
                  const artist = readText(renderer.shortBylineText) || 'Unknown Artist';

                  return {
                    snippet: {
                      title,
                      description: `${title} · ${artist}`,
                      videoOwnerChannelTitle: artist,
                      resourceId: { videoId },
                      thumbnails: pickThumbnails(renderer),
                    },
                    contentDetails: {
                      videoId,
                    },
                  };
                })
                .filter((entry) => Boolean(entry));

              toJson(res, 200, {
                ok: true,
                items,
                nextPageToken: undefined,
                playlistTitle,
              });
              return;
            }

            if (pathname === '/videos') {
              const id = requestUrl.searchParams.get('id')?.trim() ?? '';
              if (!id) {
                toJson(res, 400, { ok: false, message: 'Missing id.' });
                return;
              }

              const payload = await ytFetch('videos', new URLSearchParams({
                part: 'contentDetails,snippet',
                id,
              })) as Record<string, unknown>;

              toJson(res, 200, { ok: true, ...payload });
              return;
            }

            if (pathname === '/search') {
              const q = requestUrl.searchParams.get('q')?.trim() ?? '';
              if (!q) {
                toJson(res, 400, { ok: false, message: 'Missing q.' });
                return;
              }

              const payload = await ytFetch('search', new URLSearchParams({
                part: 'snippet',
                maxResults: '10',
                q,
                type: 'video',
                videoCategoryId: '10',
              })) as Record<string, unknown>;

              toJson(res, 200, { ok: true, ...payload });
              return;
            }

            next();
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown server error.';
            toJson(res, 500, { ok: false, message });
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@interfaces': resolve(__dirname, 'src/interfaces'),
      '@services': resolve(__dirname, 'src/services'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
