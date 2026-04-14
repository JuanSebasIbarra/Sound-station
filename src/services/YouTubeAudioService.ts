import { PIPED_INSTANCES } from '../config/youtube-instances.js';

interface PipedAudioStream {
  url: string;
  format?: string;
  bitrate?: number;
  mimeType?: string;
}

interface PipedStreamResponse {
  audioStreams?: PipedAudioStream[];
}

export class YouTubeAudioService {
  private static instance: YouTubeAudioService | null = null;
  private currentAbortController: AbortController | null = null;

  static getInstance(): YouTubeAudioService {
    if (!YouTubeAudioService.instance) {
      YouTubeAudioService.instance = new YouTubeAudioService();
    }
    return YouTubeAudioService.instance;
  }

  async getDirectAudioUrl(videoId: string): Promise<string | null> {
    if (!videoId.trim()) return null;

    for (const base of PIPED_INSTANCES) {
      const audioUrl = await this.fetchFromPipedInstance(base, videoId);
      if (audioUrl) return audioUrl;
    }

    return null;
  }

  cancelPendingRequests(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  private async fetchFromPipedInstance(baseUrl: string, videoId: string): Promise<string | null> {
    this.currentAbortController?.abort();
    this.currentAbortController = new AbortController();

    const timer = setTimeout(() => this.currentAbortController?.abort(), 8000);

    try {
      const response = await fetch(`${baseUrl}/streams/${videoId}`, {
        signal: this.currentAbortController.signal,
      });

      if (!response.ok) return null;
      const payload: PipedStreamResponse = await response.json();
      const streams = payload.audioStreams ?? [];
      if (streams.length === 0) return null;

      const preferred = streams.find((stream) => {
        const fmt = (stream.format ?? stream.mimeType ?? '').toLowerCase();
        return fmt.includes('opus') || fmt.includes('webm') || fmt.includes('m4a');
      });

      return preferred?.url ?? streams[0]?.url ?? null;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn(`[YouTubeAudioService] ${baseUrl} failed:`, error.message);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
