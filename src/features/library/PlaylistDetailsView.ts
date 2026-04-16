import type { IUserPlaylist } from '../../interfaces/IUserPlaylist.js';
import type { ISong } from '../../interfaces/ISong.js';
import { Player } from '../../core/Player.js';
import { PlaylistService } from '../../services/PlaylistService.js';
import { Toast } from '../../components/common/Toast.js';
import { formatTime } from '../../utils/helpers.js';
import { PointerGestureController } from '../../hooks/PointerGestureController.js';
import { LocalFileImporter } from '../../services/LocalFileImporter.js';
import { LibraryManager } from '../../services/LibraryManager.js';

/**
 * PlaylistDetailsView
 *
 * Renders songs for the selected user playlist and handles:
 *  - play/shuffle actions
 *  - right-click context menu for local playlist songs
 *  - song properties editor (artist + album + cover + plain text lyrics)
 */
export class PlaylistDetailsView {
  private activePlaylist: IUserPlaylist | null = null;
  private editingSongId: string | null = null;
  private pendingCoverDataUrl: string | null = null;
  private readonly gesture: PointerGestureController;

  private readonly panel = document.getElementById('playlist-detail-view') as HTMLElement;
  private readonly cover = document.getElementById('playlist-details-cover') as HTMLImageElement;
  private readonly title = document.getElementById('playlist-details-title') as HTMLElement;
  private readonly subtitle = document.getElementById('playlist-details-subtitle') as HTMLElement;
  private readonly body = document.getElementById('playlist-details-body') as HTMLElement;

  private readonly playBtn = document.getElementById('playlist-details-play') as HTMLButtonElement;
  private readonly shuffleBtn = document.getElementById('playlist-details-shuffle') as HTMLButtonElement;
  private readonly addSongBtn = document.getElementById('playlist-details-add-song') as HTMLButtonElement;
  private readonly addSongInput = document.getElementById('playlist-details-local-files') as HTMLInputElement;

  private readonly propertiesOverlay = document.getElementById('song-properties-overlay') as HTMLElement;
  private readonly propertiesName = document.getElementById('song-properties-name') as HTMLElement;
  private readonly propertiesCoverPreview = document.getElementById('song-properties-cover-preview') as HTMLImageElement;
  private readonly propertiesPickCover = document.getElementById('song-properties-pick-cover') as HTMLButtonElement;
  private readonly propertiesCoverFile = document.getElementById('song-properties-cover-file') as HTMLInputElement;
  private readonly propertiesArtist = document.getElementById('song-properties-artist') as HTMLInputElement;
  private readonly propertiesAlbum = document.getElementById('song-properties-album') as HTMLInputElement;
  private readonly propertiesLyrics = document.getElementById('song-properties-lyrics') as HTMLTextAreaElement;
  private readonly propertiesCancel = document.getElementById('song-properties-cancel') as HTMLButtonElement;
  private readonly propertiesSave = document.getElementById('song-properties-save') as HTMLButtonElement;
  private readonly libraryManager = LibraryManager.getInstance();

  constructor(
    private readonly player: Player,
    private readonly playlistService: PlaylistService,
    private readonly localImporter: LocalFileImporter,
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
      void this.startPlaylistPlayback('ordered');
    });

    this.shuffleBtn.addEventListener('click', () => {
      void this.startPlaylistPlayback('shuffle');
    });

    this.addSongBtn.addEventListener('click', () => {
      if (this.activePlaylist?.source !== 'local') return;
      this.addSongInput.click();
    });

    this.addSongInput.addEventListener('change', async () => {
      if (this.activePlaylist?.source !== 'local') return;
      const files = this.addSongInput.files;
      if (!files?.length) return;

      const songs = await this.localImporter.importFiles(files);
      this.addSongInput.value = '';

      if (songs.length === 0) {
        this.toast.show('No audio files found.', 'error');
        return;
      }

      const updated = this.playlistService.addSongsToPlaylist(this.activePlaylist.id, songs);
      if (!updated) return;

      this.activePlaylist = updated;
      this.player.addMany(songs);
      this.toast.show(`${songs.length} song(s) added to playlist.`, 'success');
      this.render();
    });

    document.addEventListener('click', () => {
      this.closeAllRowMenus();
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

  private async startPlaylistPlayback(mode: 'ordered' | 'shuffle'): Promise<void> {
    const songs = this.getActiveSongs().filter((song) => song.isFileAvailable !== false);
    if (!songs.length) return;

    const queue = mode === 'shuffle' ? this.shuffleSongs(songs) : songs;
    this.player.clearPlaybackQueue();
    queue.forEach((song) => {
      this.player.addToPlaybackQueue(song.id);
    });

    await this.player.play(queue[0]?.id);
  }

  private shuffleSongs(songs: ISong[]): ISong[] {
    const copy = songs.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private render(): void {
    const playlist = this.activePlaylist;
    if (!playlist) return;

    const songs = this.getActiveSongs();
    this.title.textContent = playlist.name;
    this.subtitle.textContent = `${songs.length} songs · ${playlist.source.replace('_', ' ')}`;
    this.cover.src = playlist.coverArt || songs[0]?.albumArt || '';
    this.cover.alt = `${playlist.name} cover`;
    this.addSongBtn.classList.toggle('hidden', playlist.source !== 'local');
    this.body.innerHTML = '';

    songs.forEach((song, index) => {
      const tr = document.createElement('tr');
      const isActive = song.id === this.player.currentSong?.id;
      if (isActive) tr.classList.add('active');
      if (song.isFileAvailable === false) tr.classList.add('song-row--missing');

      const rowLead = isActive ? '▶' : `${index + 1}`;

      tr.innerHTML = `
        <td class="playlist-row-rank">${rowLead}</td>
        <td>
          <div class="playlist-row-main">
            <img class="playlist-row-thumb" src="${song.albumArt}" alt="${song.title} cover" />
            <div class="playlist-row-text">
              <strong class="playlist-row-title">${song.title}</strong>
            </div>
          </div>
        </td>
        <td class="playlist-row-album">${song.album || 'Singles'}</td>
        <td>
          <div class="playlist-row-duration-wrap">
            <span>${formatTime(song.duration)}</span>
            <button class="playlist-row-menu" aria-label="Song options">⋯</button>
            <div class="playlist-row-dropdown hidden">
              <button class="playlist-row-dropdown__item" data-action="properties">Properties</button>
              <button class="playlist-row-dropdown__item" data-action="remove">Remove from playlist</button>
              <button class="playlist-row-dropdown__item" data-action="queue">Add to queue</button>
            </div>
          </div>
        </td>
      `;

      tr.addEventListener('click', () => {
        if (song.isFileAvailable === false) {
          this.toast.show('File not found. Re-import the local file to relink it.', 'error');
          return;
        }
        void this.player.play(song.id);
      });

      const menuButton = tr.querySelector('.playlist-row-menu') as HTMLButtonElement;
      const dropdown = tr.querySelector('.playlist-row-dropdown') as HTMLElement;

      menuButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.closeAllRowMenus();
        dropdown.classList.remove('hidden');
        this.positionRowMenu(dropdown, menuButton);
      });

      const optionButtons = Array.from(tr.querySelectorAll('.playlist-row-dropdown__item')) as HTMLButtonElement[];
      optionButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const action = button.dataset['action'];
          if (action === 'properties') {
            this.editingSongId = song.id;
            this.openPropertiesModal(song.id);
          }

          if (action === 'queue') {
            this.player.addToPlaybackQueue(song.id);
            this.toast.show('Song added to queue.', 'success');
          }

          if (action === 'remove') {
            const removed = this.playlistService.removeSongFromPlaylist(playlist.id, song.id);
            if (!removed) return;

            const remainsInQueue = this.playlistService.getAllQueueSongs().some((queuedSong) => queuedSong.id === song.id);
            if (!remainsInQueue) {
              this.player.remove(song.id);
            }

            this.activePlaylist = this.playlistService.getPlaylistById(playlist.id);
            this.libraryManager.rebuildFromSongs(this.playlistService.getAllQueueSongs());
            this.toast.show('Song removed from playlist.', 'success');
            this.render();
          }

          this.closeAllRowMenus();
        });
      });

      this.body.appendChild(tr);
    });
  }

  private closeAllRowMenus(): void {
    this.body.querySelectorAll('.playlist-row-dropdown').forEach((menu) => {
      menu.classList.remove('playlist-row-dropdown--up');
      menu.classList.add('hidden');
    });
  }

  private positionRowMenu(dropdown: HTMLElement, trigger: HTMLElement): void {
    dropdown.classList.remove('playlist-row-dropdown--up');

    const margin = 10;
    const dropdownRect = dropdown.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - triggerRect.bottom - margin;

    if (spaceBelow < dropdownRect.height) {
      dropdown.classList.add('playlist-row-dropdown--up');
    }

    const updatedRect = dropdown.getBoundingClientRect();
    if (updatedRect.top < margin) {
      dropdown.classList.remove('playlist-row-dropdown--up');
    }
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
    this.propertiesArtist.value = song.artist || '';
    this.propertiesAlbum.value = song.album || '';
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
      artist: this.propertiesArtist.value.trim() || 'Unknown Artist',
      album: this.propertiesAlbum.value.trim() || 'Singles',
      lyrics: this.propertiesLyrics.value.trim(),
    };

    if (this.pendingCoverDataUrl) {
      updates.albumArt = this.pendingCoverDataUrl;
    }

    this.playlistService.updateSong(this.editingSongId, updates);
    this.player.updateSongMetadata(this.editingSongId, updates);
    this.libraryManager.rebuildFromSongs(this.player.playlist.toArray());
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
