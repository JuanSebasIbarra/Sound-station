declare namespace YT {
  class Player {
    constructor(el: string | HTMLElement, opts: PlayerOptions);
    loadVideoById(id: string): void;
    pauseVideo(): void;
    playVideo(): void;
    seekTo(s: number, b: boolean): void;
    setVolume(v: number): void;
    getCurrentTime(): number;
    getDuration(): number;
  }

  interface PlayerOptions {
    videoId?: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
    };
  }

  enum PlayerState {
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

interface Window {
  YT: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
