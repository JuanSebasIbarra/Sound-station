import type { IPlaylistImporter } from '../interfaces/IPlaylistImporter.js';
import type { ISong } from '../interfaces/ISong.js';
import { generateGradientArt, generateId } from '../utils/helpers.js';

interface YouTubePlaylistItemsResponse {
  ok?: boolean;
  message?: string;
  items?: YouTubePlaylistItem[];
  nextPageToken?: string;
}

interface YouTubePlaylistItem {
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    videoOwnerChannelTitle?: string;
    resourceId?: {
      videoId?: string;
    };
    thumbnails?: YouTubeThumbnailSet;
  };
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
}

interface YouTubeThumbnailSet {
  default?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
  standard?: YouTubeThumbnail;
  maxres?: YouTubeThumbnail;
}

interface YouTubeThumbnail {
  url?: string;
}

interface YouTubeSongSeed {
  videoId: string;
  title: string;
  artist: string;
  album: string;
  description: string;
  duration: number;
  albumArt: string;
  year?: number;
}

const YOUTUBE_PROXY_BASE_URL = '/api/youtube';
const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v=';

export class YouTubeMusicImporter implements IPlaylistImporter {
  readonly name = 'YouTube Music';

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    // Intentionally no-op: credentials are handled only on the backend.
    return true;
  }

  async importPlaylist(playlistId: string): Promise<ISong[]> {
    const normalizedPlaylistId = this._extractPlaylistId(playlistId);
    if (!normalizedPlaylistId) {
      throw new Error('A YouTube playlist id is required.');
    }

    const seeds = await this._fetchPlaylistSeeds(normalizedPlaylistId);
    return seeds.map((seed) => this._toSong(seed));
  }

  async search(query: string): Promise<ISong[]> {
    void query;
    return [];
  }

  private async _fetchPlaylistSeeds(playlistId: string): Promise<YouTubeSongSeed[]> {
    const params = new URLSearchParams({ playlistId });
    const response = await this._fetchJson<YouTubePlaylistItemsResponse>(`${YOUTUBE_PROXY_BASE_URL}/playlist?${params.toString()}`);
    const playlistTitle = (response as YouTubePlaylistItemsResponse & { playlistTitle?: string }).playlistTitle?.trim() || `YouTube Playlist · ${playlistId}`;

    const seeds: YouTubeSongSeed[] = [];
    for (const item of response.items ?? []) {
        const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
        if (!videoId) continue;

        const snippet = item.snippet;
        const title = snippet?.title?.trim() || 'Untitled video';
        const artist = snippet?.videoOwnerChannelTitle?.trim() || 'Unknown Artist';
        const publishedAt = snippet?.publishedAt ?? item.contentDetails?.videoPublishedAt;

        seeds.push({
          videoId,
          title,
          artist,
          album: playlistTitle,
          description: snippet?.description?.trim() || `YouTube video: ${title}`,
          duration: 0,
          albumArt: this._pickThumbnail(snippet?.thumbnails, `${title}${artist}${playlistId}`),
          ...(this._parseYear(publishedAt) !== undefined ? { year: this._parseYear(publishedAt) } : {}),
        });
    }

    return seeds;
  }

  private _toSong(seed: YouTubeSongSeed): ISong {
    return {
      id: generateId(),
      title: seed.title,
      artist: seed.artist,
      album: seed.album,
      duration: seed.duration,
      albumArt: seed.albumArt,
      description: seed.description,
      source: 'youtube_music',
      year: seed.year,
      audioUrl: `${YOUTUBE_WATCH_URL}${seed.videoId}`,
    };
  }

  private _pickThumbnail(thumbnails: YouTubeThumbnailSet | undefined, fallbackSeed: string): string {
    return thumbnails?.maxres?.url
      ?? thumbnails?.standard?.url
      ?? thumbnails?.high?.url
      ?? thumbnails?.medium?.url
      ?? thumbnails?.default?.url
      ?? generateGradientArt(fallbackSeed);
  }

  private _parseYear(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const year = Number.parseInt(value.slice(0, 4), 10);
    return Number.isFinite(year) ? year : undefined;
  }

  private _extractPlaylistId(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
      const url = new URL(trimmed);
      return url.searchParams.get('list')?.trim() ?? trimmed;
    } catch {
      return trimmed;
    }
  }

  private async _fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as T & {
      ok?: boolean;
      message?: string;
      error?: { message?: string };
    };

    if (payload.ok === false) {
      throw new Error(payload.message ?? 'YouTube proxy request failed.');
    }

    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }

    return payload;
  }
}
