import type { IPlaylistImporter } from '../interfaces/IPlaylistImporter.js';
import type { ISong } from '../interfaces/ISong.js';
import { generateId } from '../utils/helpers.js';

interface InvidiousVideo {
  title: string;
  videoId: string;
  author: string;
  lengthSeconds: number;
  videoThumbnails: Array<{ quality: string; url: string }>;
}

interface InvidiousPlaylist {
  title: string;
  author: string;
  videos: InvidiousVideo[];
}

interface PipedStream {
  title: string;
  url: string;
  uploaderName: string;
  duration: number;
  thumbnail: string;
}

interface PipedPlaylist {
  name: string;
  thumbnailUrl: string;
  relatedStreams: PipedStream[];
  nextpage?: string | null;
}

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://iv.ggtyler.dev',
  'https://invidious.perennialte.ch',
  'https://invidious.darkness.services',
  'https://yt.drgnz.club',
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.garudalinux.org',
  'https://api.piped.privacydev.net',
  'https://pipedapi.coldify.de',
];

function parseVideoId(input: string): string | null {
  if (!input) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  const m = input.match(/(?:v=|\byoutu\.be\/|\/watch\?v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function parsePlaylistId(input: string): string {
  const m = input.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

function bestInvidiousThumb(thumbs: InvidiousVideo['videoThumbnails']): string {
  const preferred = ['maxres', 'sddefault', 'high', 'medium', 'default'];
  for (const q of preferred) {
    const t = thumbs.find((thumb) => thumb.quality === q);
    if (t?.url) return t.url;
  }
  return thumbs[0]?.url ?? '';
}

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function invidiousVideoToSong(v: InvidiousVideo, playlist: string): ISong {
  return {
    id: generateId(),
    title: v.title,
    artist: v.author,
    album: playlist,
    duration: v.lengthSeconds,
    albumArt: bestInvidiousThumb(v.videoThumbnails),
    description: `"${v.title}" by ${v.author} -- YouTube`,
    source: 'youtube_music',
    audioUrl: v.videoId,
  };
}

function pipedStreamToSong(s: PipedStream, playlist: string): ISong {
  const videoId = parseVideoId(s.url) ?? s.url;
  return {
    id: generateId(),
    title: s.title,
    artist: s.uploaderName,
    album: playlist,
    duration: s.duration,
    albumArt: s.thumbnail,
    description: `"${s.title}" by ${s.uploaderName} -- YouTube`,
    source: 'youtube_music',
    audioUrl: videoId,
  };
}

async function fetchFromInvidious(playlistId: string): Promise<ISong[]> {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/playlists/${playlistId}`);
      if (!res.ok) continue;
      const data: InvidiousPlaylist = await res.json();
      if (!data.videos?.length) continue;
      return data.videos.map((v) => invidiousVideoToSong(v, data.title ?? playlistId));
    } catch (err) {
      console.warn(`[YTImporter] Invidious ${base}:`, (err as Error).message);
    }
  }
  throw new Error('All Invidious instances failed');
}

async function fetchFromPiped(playlistId: string): Promise<ISong[]> {
  for (const base of PIPED_INSTANCES) {
    try {
      const songs: ISong[] = [];
      const firstRes = await fetchWithTimeout(`${base}/playlists/${playlistId}`);
      if (!firstRes.ok) continue;

      const firstPage: PipedPlaylist = await firstRes.json();
      if (firstPage.relatedStreams?.length) {
        songs.push(...firstPage.relatedStreams.map((s) => pipedStreamToSong(s, firstPage.name ?? playlistId)));
      }

      let nextpage = firstPage.nextpage ?? null;
      let guard = 0;
      while (nextpage && guard < 6) {
        guard += 1;
        const pageRes = await fetchWithTimeout(`${base}/nextpage/playlists/${playlistId}?nextpage=${encodeURIComponent(nextpage)}`);
        if (!pageRes.ok) break;

        const page: PipedPlaylist = await pageRes.json();
        if (page.relatedStreams?.length) {
          songs.push(...page.relatedStreams.map((s) => pipedStreamToSong(s, firstPage.name ?? playlistId)));
        }
        nextpage = page.nextpage ?? null;
      }

      if (songs.length) return songs;
    } catch (err) {
      console.warn(`[YTImporter] Piped ${base}:`, (err as Error).message);
    }
  }

  throw new Error('All Piped instances failed');
}

export class YouTubeMusicImporter implements IPlaylistImporter {
  readonly name = 'YouTube Music';

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    return true;
  }

  async importPlaylist(playlistIdOrUrl: string): Promise<ISong[]> {
    const playlistId = parsePlaylistId(playlistIdOrUrl);
    if (!playlistId) {
      throw new Error('A YouTube playlist id is required.');
    }

    try {
      return await fetchFromInvidious(playlistId);
    } catch (invidiousError) {
      console.warn('[YTImporter] Invidious failed, trying Piped...', invidiousError);
      return await fetchFromPiped(playlistId);
    }
  }

  async search(_query: string): Promise<ISong[]> {
    return [];
  }
}
