import type { ISong } from '../../interfaces/ISong.js';
import { Player } from '../../core/Player.js';

interface AlbumGroup {
  name: string;
  songs: ISong[];
  coverArt: string;
}

/**
 * AlbumHeaderView
 *
 * Dashboard "header" style browser to inspect albums and quickly play songs.
 */
export class AlbumHeaderView {
  private selectedAlbumName: string | null = null;

  constructor(
    private readonly albumsRoot: HTMLElement,
    private readonly songsRoot: HTMLElement,
    private readonly player: Player,
    private readonly options?: {
      onRemoveAlbum?: (albumName: string) => void;
      onOpenAlbumProperties?: (albumName: string, songs: ISong[]) => void;
    },
  ) {
    this.bindPlayerEvents();
    this.render();
  }

  private bindPlayerEvents(): void {
    this.player.events.on('playlist-change', () => this.render());
    this.player.events.on('play', () => this.highlightCurrentSong());
    this.player.events.on('next', () => this.highlightCurrentSong());
    this.player.events.on('previous', () => this.highlightCurrentSong());
  }

  private render(): void {
    const albums = this.buildAlbumGroups();

    if (!albums.length) {
      this.albumsRoot.innerHTML = '<p class="albums-empty">Aún no tienes álbumes cargados. Importa canciones para comenzar.</p>';
      this.songsRoot.innerHTML = '';
      this.selectedAlbumName = null;
      return;
    }

    if (!this.selectedAlbumName || !albums.some((album) => album.name === this.selectedAlbumName)) {
      this.selectedAlbumName = albums[0]!.name;
    }

    this.renderAlbumTabs(albums);
    this.renderAlbumSongs(albums.find((album) => album.name === this.selectedAlbumName)!);
  }

  private buildAlbumGroups(): AlbumGroup[] {
    const songs = this.player.playlist.toArray();
    const groups = new Map<string, AlbumGroup>();

    songs.forEach((song) => {
      const albumName = song.album?.trim() || 'Singles';
      const group = groups.get(albumName);
      if (group) {
        group.songs.push(song);
        return;
      }

      groups.set(albumName, {
        name: albumName,
        songs: [song],
        coverArt: song.albumArt,
      });
    });

    return Array.from(groups.values());
  }

  private renderAlbumTabs(albums: AlbumGroup[]): void {
    this.albumsRoot.innerHTML = '';

    albums.forEach((album) => {
      const chip = document.createElement('article');
      chip.className = `album-chip${album.name === this.selectedAlbumName ? ' album-chip--active' : ''}`;
      chip.innerHTML = `
        <img src="${album.coverArt}" alt="${album.name} cover" />
        <button class="album-chip__select" aria-label="Open album ${album.name}">
          <span>${album.name}</span>
          <small>${album.songs.length} songs</small>
        </button>
        <button class="album-chip__queue" aria-label="Add album to queue" title="Add album to queue">≡+</button>
        <button class="album-chip__properties" aria-label="Open album properties" title="Album properties">⋯</button>
        <button class="album-chip__remove" aria-label="Remove album from playback" title="Remove album from playback">✕</button>
      `;

      const selectBtn = chip.querySelector('.album-chip__select') as HTMLButtonElement;
      const queueBtn = chip.querySelector('.album-chip__queue') as HTMLButtonElement;
      const propertiesBtn = chip.querySelector('.album-chip__properties') as HTMLButtonElement;
      const removeBtn = chip.querySelector('.album-chip__remove') as HTMLButtonElement;

      selectBtn.addEventListener('click', () => {
        this.selectedAlbumName = album.name;
        this.renderAlbumTabs(albums);
        this.renderAlbumSongs(album);
      });

      queueBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        album.songs.forEach((song) => {
          this.player.addToPlaybackQueue(song.id);
        });
      });

      removeBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.options?.onRemoveAlbum?.(album.name);
      });

      propertiesBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.options?.onOpenAlbumProperties?.(album.name, album.songs);
      });

      this.albumsRoot.appendChild(chip);
    });
  }

  private renderAlbumSongs(album: AlbumGroup): void {
    this.songsRoot.innerHTML = `
      <div class="album-songs-head">
        <strong>${album.name}</strong>
        <button class="glossy-btn glossy-btn--small" id="album-play-all">▶ Play album</button>
      </div>
      <div class="album-songs-track"></div>
    `;

    const songsTrack = this.songsRoot.querySelector('.album-songs-track') as HTMLElement;
    const playAll = this.songsRoot.querySelector('#album-play-all') as HTMLButtonElement;

    playAll.addEventListener('click', () => {
      const first = album.songs[0];
      if (first) void this.player.play(first.id);
    });

    album.songs.forEach((song, index) => {
      const row = document.createElement('button');
      row.className = `album-song-row${song.id === this.player.currentSong?.id ? ' album-song-row--active' : ''}`;
      row.dataset['songId'] = song.id;
      row.innerHTML = `
        <span>${index + 1}. ${song.title}</span>
        <small>${song.artist}</small>
      `;
      row.addEventListener('click', () => void this.player.play(song.id));
      songsTrack.appendChild(row);
    });
  }

  private highlightCurrentSong(): void {
    const rows = Array.from(this.songsRoot.querySelectorAll('.album-song-row'));
    const currentId = this.player.currentSong?.id;
    rows.forEach((row) => {
      row.classList.toggle('album-song-row--active', row.getAttribute('data-song-id') === currentId);
    });
  }
}
