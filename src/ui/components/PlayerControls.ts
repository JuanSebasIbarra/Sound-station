import { Player } from '../../core/Player.js';
import type { RepeatMode } from '../../interfaces/IEventEmitter.js';

/**
 * PlayerControls – wires up the play/pause, next, previous,
 * shuffle, repeat, and volume buttons to the Player Singleton.
 */
export class PlayerControls {
  private readonly player: Player;

  private readonly btnPlay:    HTMLElement;
  private readonly btnPrev:    HTMLElement;
  private readonly btnNext:    HTMLElement;
  private readonly btnShuffle: HTMLElement;
  private readonly btnRepeat:  HTMLElement;
  private readonly btnMute:    HTMLElement;
  private readonly volumeBar:  HTMLElement;
  private readonly volumeFill: HTMLElement;
  private readonly iconPlay:   SVGElement;
  private readonly iconPause:  SVGElement;

  constructor(player: Player) {
    this.player = player;

    this.btnPlay    = document.getElementById('btn-play')!;
    this.btnPrev    = document.getElementById('btn-prev')!;
    this.btnNext    = document.getElementById('btn-next')!;
    this.btnShuffle = document.getElementById('btn-shuffle')!;
    this.btnRepeat  = document.getElementById('btn-repeat')!;
    this.btnMute    = document.getElementById('btn-mute')!;
    this.volumeBar  = document.getElementById('volume-bar')!;
    this.volumeFill = document.getElementById('volume-fill')!;
    this.iconPlay   = this.btnPlay.querySelector<SVGElement>('.icon-play')!;
    this.iconPause  = this.btnPlay.querySelector<SVGElement>('.icon-pause')!;

    this._bindButtons();
    this._bindVolumeBar();
    this._bindPlayerEvents();
    this._bindKeyboard();
  }

  // ── Button wiring ─────────────────────────────────────────────

  private _bindButtons(): void {
    this.btnPlay.addEventListener('click', () => this.player.togglePlay());
    this.btnPrev.addEventListener('click', () => void this.player.previous());
    this.btnNext.addEventListener('click', () => void this.player.next());

    this.btnShuffle.addEventListener('click', () => {
      this.player.toggleShuffle();
    });

    this.btnRepeat.addEventListener('click', () => {
      this.player.cycleRepeat();
    });

    this.btnMute.addEventListener('click', () => {
      this.player.toggleMute();
      this._updateVolumeIcon();
    });
  }

  // ── Volume slider (PointerEvents) ────────────────────────────

  private _bindVolumeBar(): void {
    let isDragging = false;

    const setVol = (e: PointerEvent): void => {
      const rect = this.volumeBar.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.player.setVolume(frac);
      this.volumeFill.style.width = `${frac * 100}%`;
    };

    this.volumeBar.addEventListener('pointerdown', (e) => {
      isDragging = true;
      this.volumeBar.setPointerCapture(e.pointerId);
      setVol(e);
    });

    this.volumeBar.addEventListener('pointermove', (e) => {
      if (isDragging) setVol(e);
    });

    this.volumeBar.addEventListener('pointerup',     () => { isDragging = false; });
    this.volumeBar.addEventListener('pointercancel', () => { isDragging = false; });

    // Keyboard
    this.volumeBar.addEventListener('keydown', (e) => {
      const step = 0.05;
      if (e.key === 'ArrowRight') this.player.setVolume(this.player.volume + step);
      if (e.key === 'ArrowLeft')  this.player.setVolume(this.player.volume - step);
      this._syncVolumeUI();
    });
  }

  // ── React to Player events ────────────────────────────────────

  private _bindPlayerEvents(): void {
    this.player.events.on('play', () => {
      this.iconPlay.classList.add('hidden');
      this.iconPause.classList.remove('hidden');
      this.btnPlay.setAttribute('aria-label', 'Pause');
    });

    this.player.events.on('pause', () => {
      this._showPlayIcon();
    });

    this.player.events.on('stop', () => {
      this._showPlayIcon();
    });

    this.player.events.on<{ active: boolean }>('shuffle-change', ({ active }) => {
      this.btnShuffle.classList.toggle('active', active);
    });

    this.player.events.on<{ mode: RepeatMode }>('repeat-change', ({ mode }) => {
      this.btnRepeat.classList.remove('active', 'active-one');
      if (mode === 'all') this.btnRepeat.classList.add('active');
      if (mode === 'one') this.btnRepeat.classList.add('active', 'active-one');
    });

    this.player.events.on<{ level: number }>('volume', ({ level }) => {
      this.volumeFill.style.width = `${level * 100}%`;
      this._updateVolumeIcon();
    });
  }

  // ── Global keyboard shortcuts ─────────────────────────────────

  private _bindKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      // Don't fire on inputs
      if ((e.target as HTMLElement).matches('input, textarea')) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.player.togglePlay();
          break;
        case 'ArrowRight':
          if (e.shiftKey) { void this.player.next(); }
          else { this.player.seek(this.player.currentTime + 5); }
          break;
        case 'ArrowLeft':
          if (e.shiftKey) { void this.player.previous(); }
          else { this.player.seek(this.player.currentTime - 5); }
          break;
        case 'KeyM':
          this.player.toggleMute();
          this._updateVolumeIcon();
          break;
        case 'KeyS':
          this.player.toggleShuffle();
          break;
        case 'KeyR':
          this.player.cycleRepeat();
          break;
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private _showPlayIcon(): void {
    this.iconPlay.classList.remove('hidden');
    this.iconPause.classList.add('hidden');
    this.btnPlay.setAttribute('aria-label', 'Play');
  }

  private _syncVolumeUI(): void {
    this.volumeFill.style.width = `${this.player.volume * 100}%`;
    this._updateVolumeIcon();
  }

  private _updateVolumeIcon(): void {
    const iconEl = document.getElementById('icon-volume');
    if (!iconEl) return;

    const vol = this.player.isMuted ? 0 : this.player.volume;

    if (vol === 0) {
      iconEl.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
    } else if (vol < 0.5) {
      iconEl.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
    } else {
      iconEl.innerHTML = `
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
    }
  }
}
