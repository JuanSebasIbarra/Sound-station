import type { IUserPlaylist } from '../../interfaces/IUserPlaylist.js';
import type { ISong } from '../../interfaces/ISong.js';
import { Player } from '../../core/Player.js';
import { PlaylistService } from '../../services/PlaylistService.js';
import { Toast } from '../../components/common/Toast.js';
import { formatTime } from '../../utils/helpers.js';
import { PointerGestureController } from '../../hooks/PointerGestureController.js';

/**
 * PlaylistDetailsView
 *
 * Renders songs for the selected user playlist and handles:
 *  - play/shuffle actions
 *  - right-click context menu for local playlist songs
 *  - song properties editor (cover + plain text lyrics)
 */
export class PlaylistDetailsView {
  private activePlaylist: IUserPlaylist | null = null;
  private editingSongId: string | null = null;
  private pendingCoverDataUrl: string | null = null;
  private readonly gesture: PointerGestureController;

  private readonly panel = document.getElementById('playlist-detail-view') as HTMLElement;
  private readonly title = document.getElementById('playlist-details-title') as HTMLElement;
  private readonly subtitle = document.getElementById('playlist-details-subtitle') as HTMLElement;
  private readonly body = document.getElementById('playlist-details-body') as HTMLElement;

  private readonly playBtn = document.getElementById('playlist-details-play') as HTMLButtonElement;
  private readonly shuffleBtn = document.getElementById('playlist-details-shuffle') as HTMLButtonElement;

  private readonly contextMenu = document.getElementById('song-context-menu') as HTMLElement;
  private readonly contextPropertiesBtn = document.getElementById('song-context-properties') as HTMLButtonElement;

  private readonly propertiesOverlay = document.getElementById('song-properties-overlay') as HTMLElement;
  private readonly propertiesName = document.getElementById('song-properties-name') as HTMLElement;
  private readonly propertiesCoverPreview = document.getElementById('song-properties-cover-preview') as HTMLImageElement;
  private readonly propertiesPickCover = document.getElementById('song-properties-pick-cover') as HTMLButtonElement;
  private readonly propertiesCoverFile = document.getElementById('song-properties-cover-file') as HTMLInputElement;
  private readonly propertiesLyrics = document.getElementById('song-properties-lyrics') as HTMLTextAreaElement;
  private readonly propertiesCancel = document.getElementById('song-properties-cancel') as HTMLButtonElement;
  private readonly propertiesSave = document.getElementById('song-properties-save') as HTMLButtonElement;

  constructor(
    private readonly player: Player,
    private readonly playlistService: PlaylistService,
    private readonly toast: Toast,
  ) {
    this.gesture = new PointerGestureController(this.panel, {
      onSwipeLeft: () => void this.player.next(),
      onSwipeRight: () => void this.player.previous(),
    });
    this.bindEvents();
  }

  showPlaylist(playlist: IUserPlaylist): void {
    this.activePlaylist = playlist;
    this.render();
  }

  destroy(): void {
    this.gesture.destroy();
  }

  refreshCurrentPlaylist(): void {
    if (!this.activePlaylist) return;
    const latest = this.playlistService.getPlaylistById(this.activePlaylist.id);
    if (!latest) return;
    this.activePlaylist = latest;
    this.render();
  }

  private bindEvents(): void {
    this.playBtn.addEventListener('click', () => {
      const songs = this.getActiveSongs();
      const first = songs[0];
      if (first) void this.player.play(first.id);
    });

    this.shuffleBtn.addEventListener('click', () => {
      const songs = this.getActiveSongs();
      if (!songs.length) return;
      const randomSong = songs[Math.floor(Math.random() * songs.length)];
      void this.player.play(randomSong.id);
    });

    this.contextPropertiesBtn.addEventListener('click', () => {
      this.contextMenu.classList.add('hidden');
      if (!this.editingSongId) return;
      this.openPropertiesModal(this.editingSongId);
    });

    document.addEventListener('click', () => {
      this.contextMenu.classList.add('hidden');
    });

    this.propertiesOverlay.addEventListener('click', (event) => {
      if (event.target === this.propertiesOverlay) this.closePropertiesModal();
    });

    this.propertiesPickCover.addEventListener('click', () => this.propertiesCoverFile.click());
    this.propertiesCoverFile.addEventListener('change', async () => {
      const file = this.propertiesCoverFile.files?.[0];
      if (!file) return;
      this.pendingCoverDataUrl = await this.fileToDataUrl(file);
      this.propertiesCoverPreview.src = this.pendingCoverDataUrl;
    });

    this.propertiesCancel.addEventListener('click', () => this.closePropertiesModal());
    this.propertiesSave.addEventListener('click', () => this.saveProperties());

    this.player.events.on('playlist-change', () => {
      if (this.activePlaylist) this.render();
    });

    this.player.events.on('current-song-update', () => {
      if (this.activePlaylist) this.render();
    });

    this.player.events.on('play', () => {
      if (this.activePlaylist) this.highlightCurrentSong();
    });
  }

  private render(): void {
    const playlist = this.activePlaylist;
    if (!playlist) return;

    const songs = this.getActiveSongs();
    this.title.textContent = playlist.name;
    this.subtitle.textContent = `${songs.length} songs · ${playlist.source.replace('_', ' ')}`;
    this.body.innerHTML = '';

    songs.forEach((song, index) => {
      const tr = document.createElement('tr');
      if (song.id === this.player.currentSong?.id) tr.classList.add('active');

      const sourceLabel = song.source ?? playlist.source;

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${song.title}</td>
        <td>${song.artist}</td>
        <td>${formatTime(song.duration)}</td>
        <td><span class="source-tag source-tag--${sourceLabel}">${sourceLabel.replace('_', ' ')}</span></td>
      `;

      tr.addEventListener('click', () => void this.player.play(song.id));

      if (playlist.source === 'local') {
        tr.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          this.editingSongId = song.id;
          this.contextMenu.style.left = `${event.clientX}px`;
          this.contextMenu.style.top = `${event.clientY}px`;
          this.contextMenu.classList.remove('hidden');
        });
      }

      this.body.appendChild(tr);
    });
  }

  private highlightCurrentSong(): void {
    const rows = Array.from(this.body.querySelectorAll('tr'));
    const songs = this.getActiveSongs();

    rows.forEach((row, index) => {
      row.classList.toggle('active', songs[index]?.id === this.player.currentSong?.id);
    });
  }

  private getActiveSongs(): ISong[] {
    if (!this.activePlaylist) return [];
    return this.activePlaylist.songIds
      .map((songId) => this.playlistService.getSongById(songId))
      .filter((song): song is ISong => Boolean(song));
  }

  private openPropertiesModal(songId: string): void {
    const song = this.playlistService.getSongById(songId);
    if (!song) return;

    this.editingSongId = songId;
    this.pendingCoverDataUrl = null;
    this.propertiesName.textContent = `${song.title} · ${song.artist}`;
    this.propertiesLyrics.value = song.lyrics ?? '';
    this.propertiesCoverPreview.src = song.albumArt;
    this.propertiesCoverFile.value = '';

    this.propertiesOverlay.classList.remove('hidden');
  }

  private closePropertiesModal(): void {
    this.propertiesOverlay.classList.add('hidden');
    this.pendingCoverDataUrl = null;
  }

  private saveProperties(): void {
    if (!this.editingSongId) return;

    const updates: Partial<ISong> = {
      lyrics: this.propertiesLyrics.value.trim(),
    };

    if (this.pendingCoverDataUrl) {
      updates.albumArt = this.pendingCoverDataUrl;
    }

    this.playlistService.updateSong(this.editingSongId, updates);
    this.player.updateSongMetadata(this.editingSongId, updates);
    this.toast.show('Song properties updated.', 'success');
    this.closePropertiesModal();
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });
  }
}
