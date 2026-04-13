import { Player } from '../../core/Player.js';
import { PlaylistService } from '../../services/PlaylistService.js';
import { LibraryManager } from '../../services/LibraryManager.js';
import { Toast } from '../../components/common/Toast.js';

export class ArtistsLibraryView {
  private selectedArtistName = '';
  private selectedAlbumIndex = 0;
  private readonly flippedAlbumNames = new Set<string>();

  private readonly artistsList = document.getElementById('artists-list') as HTMLElement;
  private readonly discographyTitle = document.getElementById('artist-discography-title') as HTMLElement;
  private readonly flowRoot = document.getElementById('artist-album-coverflow') as HTMLElement;
  private readonly albumMeta = document.getElementById('artist-album-meta') as HTMLElement;
  private readonly prevButton = document.getElementById('btn-artist-album-prev') as HTMLButtonElement;
  private readonly nextButton = document.getElementById('btn-artist-album-next') as HTMLButtonElement;
  private readonly saveButton = document.getElementById('btn-save-selected-album') as HTMLButtonElement;
  private readonly playButton = document.getElementById('btn-play-selected-album') as HTMLButtonElement;

  constructor(
    private readonly libraryManager: LibraryManager,
    private readonly playlistService: PlaylistService,
    private readonly player: Player,
    private readonly toast: Toast,
  ) {
    this.bindEvents();
    this.render();
  }

  render(): void {
    const artists = this.libraryManager.getArtists();

    if (!artists.length) {
      this.artistsList.innerHTML = '<p class="playlist-sidebar__subtitle">No artists in history yet. Play a song first.</p>';
      this.flowRoot.innerHTML = '<p class="playlist-sidebar__subtitle">Discography will appear here.</p>';
      this.discographyTitle.textContent = 'Discography';
      this.albumMeta.textContent = 'No album selected';
      return;
    }

    if (!this.selectedArtistName || !artists.some((artist) => artist.name === this.selectedArtistName)) {
      this.selectedArtistName = artists[0]!.name;
      this.selectedAlbumIndex = 0;
    }

    this.renderArtistList();
    this.renderCoverFlow();
  }

  openArtist(artistName: string): void {
    this.selectedArtistName = artistName;
    this.selectedAlbumIndex = 0;
    this.flippedAlbumNames.clear();
    this.render();
  }

  private bindEvents(): void {
    this.prevButton.addEventListener('click', () => {
      const albums = this.getSelectedAlbums();
      if (albums.length === 0) return;
      this.selectedAlbumIndex = (this.selectedAlbumIndex - 1 + albums.length) % albums.length;
      this.flippedAlbumNames.clear();
      this.renderCoverFlow();
    });

    this.nextButton.addEventListener('click', () => {
      const albums = this.getSelectedAlbums();
      if (albums.length === 0) return;
      this.selectedAlbumIndex = (this.selectedAlbumIndex + 1) % albums.length;
      this.flippedAlbumNames.clear();
      this.renderCoverFlow();
    });

    this.playButton.addEventListener('click', () => {
      const currentAlbum = this.getSelectedAlbums()[this.selectedAlbumIndex];
      const firstSong = currentAlbum?.toArray()[0];
      if (!firstSong) return;
      void this.player.play(firstSong.id);
    });

    this.saveButton.addEventListener('click', () => this.saveAlbumFromQueue());
  }

  private renderArtistList(): void {
    const artists = this.libraryManager.getArtists();
    this.artistsList.innerHTML = '';

    artists.forEach((artist) => {
      const button = document.createElement('button');
      button.className = `artist-list-item${artist.name === this.selectedArtistName ? ' artist-list-item--active' : ''}`;
      button.textContent = `${artist.name} (${artist.getAlbums().length})`;
      button.addEventListener('click', () => {
        this.selectedArtistName = artist.name;
        this.selectedAlbumIndex = 0;
        this.flippedAlbumNames.clear();
        this.render();
      });
      this.artistsList.appendChild(button);
    });
  }

  private renderCoverFlow(): void {
    const artist = this.libraryManager.getArtist(this.selectedArtistName);
    if (!artist) return;

    const albums = artist.getAlbums();
    this.discographyTitle.textContent = `${artist.name} · Discography`;

    if (albums.length === 0) {
      this.flowRoot.innerHTML = '<p class="playlist-sidebar__subtitle">No saved albums for this artist yet.</p>';
      this.albumMeta.textContent = 'No album selected';
      return;
    }

    if (this.selectedAlbumIndex >= albums.length) this.selectedAlbumIndex = 0;

    this.flowRoot.innerHTML = '';
    albums.forEach((album, index) => {
      const delta = index - this.selectedAlbumIndex;
      if (Math.abs(delta) > 2) return;

      const card = document.createElement('button');
      card.type = 'button';
      const positionClass = delta === 0
        ? 'cf-album--center'
        : delta < 0
          ? `cf-album--left-${Math.abs(delta)}`
          : `cf-album--right-${delta}`;
      const isFlipped = this.flippedAlbumNames.has(album.name);
      card.className = `cf-album ${positionClass}${isFlipped ? ' cf-album--flipped' : ''}`;

      const trackItems = album.toArray()
        .map((song) => `<li><span>${song.title}</span><small>${this.formatDuration(song.duration)}</small></li>`)
        .join('');

      card.innerHTML = `
        <div class="cf-album__inner">
          <div class="cf-album__face cf-album__face--front">
            <img class="cf-album__cover" src="${album.toArray()[0]?.albumArt || ''}" alt="${album.name} cover" />
          </div>
          <div class="cf-album__face cf-album__face--back">
            <h4>${album.name}</h4>
            <ol class="cf-album__tracks">${trackItems}</ol>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.selectedAlbumIndex !== index) {
          this.selectedAlbumIndex = index;
          this.flippedAlbumNames.clear();
        } else if (this.flippedAlbumNames.has(album.name)) {
          this.flippedAlbumNames.delete(album.name);
        } else {
          this.flippedAlbumNames.add(album.name);
        }
        this.renderCoverFlow();
      });
      this.flowRoot.appendChild(card);
    });

    const current = albums[this.selectedAlbumIndex]!;
    this.albumMeta.textContent = `${current.name} · ${current.toArray().length} songs`;
  }

  private getSelectedAlbums() {
    return this.libraryManager.getArtist(this.selectedArtistName)?.getAlbums() ?? [];
  }

  private formatDuration(durationSeconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(durationSeconds || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  private saveAlbumFromQueue(): void {
    const artistName = this.selectedArtistName;
    if (!artistName) return;

    const queueSongs = this.playlistService.getAllQueueSongs().filter((song) => song.artist === artistName);
    const currentSong = this.player.currentSong;
    const albumName = currentSong?.artist === artistName ? currentSong.album : queueSongs[0]?.album;

    if (!albumName) {
      this.toast.show('No album available to save for this artist.', 'error');
      return;
    }

    const albumSongs = queueSongs.filter((song) => (song.album || 'Singles') === albumName);
    if (albumSongs.length === 0) {
      this.toast.show('Album songs are not available in the queue.', 'error');
      return;
    }

    this.libraryManager.saveAlbum(artistName, albumName, albumSongs);
    this.toast.show(`Saved album "${albumName}" for ${artistName}.`, 'success');
    this.render();
  }
}
