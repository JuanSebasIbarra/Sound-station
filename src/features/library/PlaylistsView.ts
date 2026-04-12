import { Player } from '../../core/Player.js';

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  spotify: { label: 'From Spotify', icon: '🟢' },
  apple_music: { label: 'From Apple Music', icon: '' },
  youtube_music: { label: 'From YouTube Music', icon: '🔴' },
  local: { label: 'Local Storage', icon: '💾' },
};

/**
 * PlaylistsView
 *
 * Displays grouped pseudo-playlists from current songs, including
 * source sublabels and icons as requested.
 */
export class PlaylistsView {
  constructor(private readonly root: HTMLElement, private readonly player: Player) {
    this.bindEvents();
    this.render();
  }

  render(): void {
    const songs = this.player.playlist.toArray();
    const groups = new Map<string, number>();

    songs.forEach((song) => {
      const source = song.source ?? 'local';
      groups.set(source, (groups.get(source) ?? 0) + 1);
    });

    this.root.innerHTML = '';

    Array.from(groups.entries()).forEach(([source, count]) => {
      const meta = SOURCE_META[source] ?? SOURCE_META.local;
      const tile = document.createElement('article');
      tile.className = 'playlist-tile';
      tile.innerHTML = `
        <h3>${source.replace('_', ' ').toUpperCase()} MIX</h3>
        <small>${meta.icon} ${meta.label} · ${count} songs</small>
      `;

      tile.addEventListener('click', () => {
        const first = songs.find((song) => (song.source ?? 'local') === source);
        if (first) void this.player.play(first.id);
      });

      this.root.appendChild(tile);
    });
  }

  private bindEvents(): void {
    this.player.events.on('playlist-change', () => this.render());
  }
}
