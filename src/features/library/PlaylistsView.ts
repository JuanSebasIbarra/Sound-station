import type { IUserPlaylist } from '../../interfaces/IUserPlaylist.js';
import { PlaylistService } from '../../services/PlaylistService.js';
import { ModalComponent } from '../../components/common/ModalComponent.js';
import { Toast } from '../../components/common/Toast.js';

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  spotify: { label: 'From Spotify', icon: '🟢' },
  apple_music: { label: 'From Apple Music', icon: '' },
  youtube_music: { label: 'From YouTube Music', icon: '🔴' },
  local: { label: 'Local Storage', icon: '💾' },
};

/**
 * PlaylistsView
 *
 * Displays user playlists persisted in PlaylistService.
 */
export class PlaylistsView {
  constructor(
    private readonly root: HTMLElement,
    private readonly playlistService: PlaylistService,
    private readonly onOpenPlaylist: (playlist: IUserPlaylist) => void,
    private readonly modal: ModalComponent,
    private readonly toast: Toast,
    private readonly onQueuePlaylist?: (playlist: IUserPlaylist) => void,
    private readonly onPlaylistsChanged?: () => void,
  ) {
    this.render();
  }

  render(): void {
    const playlists = this.playlistService.getPlaylists();

    this.root.innerHTML = '';

    playlists.forEach((playlist) => {
      const meta = SOURCE_META[playlist.source] ?? SOURCE_META.local;
      const tile = document.createElement('article');
      tile.className = 'playlist-tile';
      tile.innerHTML = `
        <img class="playlist-tile__thumb" src="${playlist.coverArt}" alt="${playlist.name} cover" />
        <div class="playlist-tile__body">
          <h3>${playlist.name}</h3>
          <small>${meta.icon} ${meta.label} · ${playlist.songIds.length} songs</small>
        </div>
      `;

      const queueButton = document.createElement('button');
      queueButton.className = 'playlist-card-queue-btn';
      queueButton.title = 'Add playlist to queue';
      queueButton.textContent = '≡+';

      queueButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onQueuePlaylist?.(playlist);
      });

      const deleteButton = document.createElement('button');
      deleteButton.className = 'sidebar-playlist-delete';
      deleteButton.title = 'Delete playlist';
      deleteButton.textContent = '✕';

      deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        const ok = await this.modal.confirm({
          title: 'Delete Playlist',
          message: `Delete "${playlist.name}" permanently?`,
          confirmText: 'Delete',
          cancelText: 'Keep',
        });

        if (!ok) return;
        this.playlistService.deletePlaylist(playlist.id);
        this.toast.show(`Playlist "${playlist.name}" deleted.`, 'success');
        this.render();
        this.onPlaylistsChanged?.();
      });

  tile.appendChild(queueButton);
      tile.appendChild(deleteButton);

      tile.addEventListener('click', () => {
        this.onOpenPlaylist(playlist);
      });

      this.root.appendChild(tile);
    });
  }
}
