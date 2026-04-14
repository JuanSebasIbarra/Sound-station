import { json } from './_shared';

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

function extractInitialData(html: string): unknown {
  const anchors = ['ytInitialData =', 'var ytInitialData =', 'window["ytInitialData"] ='];

  for (const anchor of anchors) {
    const anchorIndex = html.indexOf(anchor);
    if (anchorIndex < 0) continue;

    const startIndex = html.indexOf('{', anchorIndex);
    if (startIndex < 0) continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < html.length; index += 1) {
      const ch = html[index];
      if (!ch) continue;

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (ch === '\\') {
          escaped = true;
          continue;
        }

        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') {
        depth += 1;
        continue;
      }

      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const jsonPayload = html.slice(startIndex, index + 1);
          try {
            return JSON.parse(jsonPayload);
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error('Could not parse playlist page data.');
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const playlistId = url.searchParams.get('playlistId')?.trim() ?? '';

    if (!playlistId) {
      return json({ ok: false, message: 'Missing playlistId.' }, 400);
    }

    const response = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en`, {
      method: 'GET',
      headers: {
        'user-agent': 'Mozilla/5.0',
        accept: 'text/html',
      },
    });

    if (!response.ok) {
      return json({ ok: false, message: `YouTube playlist fetch failed (${response.status}).` }, 502);
    }

    const html = await response.text();
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

    return json({
      ok: true,
      items,
      nextPageToken: undefined,
      playlistTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error.';
    return json({ ok: false, message }, 500);
  }
}
