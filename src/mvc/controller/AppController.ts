import { Player } from '../../core/Player.js';

import { SpotifyImporter } from '../../services/SpotifyImporter.js';
import { AppleMusicImporter } from '../../services/AppleMusicImporter.js';
import { YouTubeMusicImporter } from '../../services/YouTubeMusicImporter.js';
import { LocalFileImporter } from '../../services/LocalFileImporter.js';

import { DashboardShell } from '../../components/layout/DashboardShell.js';
import { NavigationController } from '../../components/layout/NavigationController.js';
import { Toast } from '../../components/common/Toast.js';
import { ModalComponent } from '../../components/common/ModalComponent.js';
import { PlaylistView } from '../../features/playlist/PlaylistView.js';
import { CoverFlowView } from '../../features/playlist/CoverFlowView.js';
import { PlayerBar } from '../../features/player/PlayerBar.js';
import { PlaybackQueueView } from '../../features/player/PlaybackQueueView.js';
import { PlaylistsView } from '../../features/library/PlaylistsView.js';
import { AlbumHeaderView } from '../../features/library/AlbumHeaderView.js';
import { LocalLibraryImportView } from '../../features/library/LocalLibraryImportView.js';
import { PlaylistSidebarView } from '../../features/library/PlaylistSidebarView.js';
import { PlaylistDetailsView } from '../../features/library/PlaylistDetailsView.js';
import { PlaylistService } from '../../services/PlaylistService.js';
import { StorageService } from '../../services/StorageService.js';
import { LibraryManager } from '../../services/LibraryManager.js';
import { ArtistsLibraryView } from '../../features/library/ArtistsLibraryView.js';

/**
 * AppController
 *
 * MVC Controller layer entry point. It orchestrates app services,
 * views, and event wiring while keeping the main entry file minimal.
 */
export async function runAppController(): Promise<void> {
  const player = Player.getInstance();
  const shell = new DashboardShell();
  const navigation = new NavigationController();
  const toast = new Toast(document.getElementById('toast-container') as HTMLElement);
  const confirmModal = new ModalComponent();
  const storageService = new StorageService();
  const playlistService = new PlaylistService(storageService);
  const localImporter = new LocalFileImporter(storageService);
  const libraryManager = LibraryManager.getInstance(storageService);
  const sidebarPanel = document.querySelector('.playlist-sidebar') as HTMLElement;

  await playlistService.initialize();
  await libraryManager.initialize();

  const albumPropertiesOverlay = document.getElementById('album-properties-overlay') as HTMLElement;
  const albumPropertiesCurrent = document.getElementById('album-properties-current') as HTMLElement;
  const albumPropertiesArtist = document.getElementById('album-properties-artist') as HTMLInputElement;
  const albumPropertiesCollaborators = document.getElementById('album-properties-collaborators') as HTMLInputElement;
  const albumPropertiesAlbum = document.getElementById('album-properties-album') as HTMLInputElement;
  const albumPropertiesCancel = document.getElementById('album-properties-cancel') as HTMLButtonElement;
  const albumPropertiesSave = document.getElementById('album-properties-save') as HTMLButtonElement;

  let albumEditingName = '';

  await playlistService.relinkLocalPlaylistsFromM3U();

  const importers = {
    spotify: new SpotifyImporter(),
    apple: new AppleMusicImporter(),
    youtube: new YouTubeMusicImporter(),
  };

  player.clearPlaylist();
  player.addMany(playlistService.getAllQueueSongs());

  const syncQueueWithPersisted = (): void => {
    player.clearPlaylist();
    player.addMany(playlistService.getAllQueueSongs());
  };

  const coverFlowView = new CoverFlowView(
    document.getElementById('coverflow-stage') as HTMLElement,
    document.getElementById('cf-title') as HTMLElement,
    document.getElementById('cf-artist') as HTMLElement,
    player,
  );

  new PlayerBar(player);
  new PlaybackQueueView(player);
  const playlistDetailsView = new PlaylistDetailsView(player, playlistService, localImporter, toast);
  const artistsLibraryView = new ArtistsLibraryView(libraryManager, playlistService, player, toast);

  player.events.on<{ songId: string }>('play', ({ songId }) => {
    const song = playlistService.getSongById(songId);
    if (!song) return;

    playlistService.restoreSongToRecentlyPlayed(songId);
    const currentIndex = player.playlist.indexOf(songId);
    if (currentIndex > 0) {
      player.moveSong(songId, 0);
    }

    libraryManager.recordSongPlay(song);
    artistsLibraryView.render();
    renderDashboardArtists();
  });

  player.events.on<{ songId: string }>('playback-error', ({ songId }) => {
    const song = playlistService.getSongById(songId);
    const label = song?.title ?? 'track';
    toast.show(`File Not Found: ${label}. Re-import to relink.`, 'error');
  });

  const closeAlbumPropertiesModal = (): void => {
    albumPropertiesOverlay.classList.add('hidden');
    albumEditingName = '';
  };

  const openAlbumPropertiesModal = (albumName: string): void => {
    const songs = playlistService.getSongsForAlbum(albumName);
    const firstSong = songs[0];
    albumEditingName = albumName;
    albumPropertiesCurrent.textContent = `Editing: ${albumName}`;
    albumPropertiesArtist.value = firstSong?.artist ?? '';
    albumPropertiesCollaborators.value = (firstSong?.collaborators ?? []).join(', ');
    albumPropertiesAlbum.value = firstSong?.album ?? albumName;
    albumPropertiesOverlay.classList.remove('hidden');
  };

  albumPropertiesCancel.addEventListener('click', closeAlbumPropertiesModal);
  albumPropertiesOverlay.addEventListener('click', (event) => {
    if (event.target === albumPropertiesOverlay) closeAlbumPropertiesModal();
  });

  albumPropertiesSave.addEventListener('click', () => {
    if (!albumEditingName) return;

    const updatedSongs = playlistService.updateAlbumMetadata(albumEditingName, {
      artistName: albumPropertiesArtist.value,
      albumName: albumPropertiesAlbum.value,
      collaborators: albumPropertiesCollaborators.value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    });

    if (updatedSongs.length === 0) {
      toast.show('No songs found for album update.', 'error');
      return;
    }

    updatedSongs.forEach((song) => {
      player.updateSongMetadata(song.id, {
        artist: song.artist,
        album: song.album,
        collaborators: song.collaborators,
      });
    });

    syncArtistsWithVisibleSongs();
    playlistDetailsView.refreshCurrentPlaylist();
    toast.show('Album metadata updated.', 'success');
    closeAlbumPropertiesModal();
  });

  const openArtistRoute = (artistName: string): void => {
    navigation.showArtists();
    artistsLibraryView.openArtist(artistName);
  };

  const syncArtistsWithVisibleSongs = (): void => {
    const visibleSongs = player.playlist
      .toArray()
      .filter((song) => !playlistService.isSongDismissedFromRecentlyPlayed(song.id));

    libraryManager.rebuildFromSongs(visibleSongs);
    artistsLibraryView.render();
    renderDashboardArtists();
  };

  const renderDashboardArtists = (): void => {
    const artists = libraryManager.getArtists();
    shell.dashboardArtistsList.innerHTML = '';

    if (artists.length === 0) {
      shell.dashboardArtistsList.innerHTML = '<p class="playlist-sidebar__subtitle">No artists yet. Play any song to populate this section.</p>';
      return;
    }

    artists.slice(0, 12).forEach((artist) => {
      const card = document.createElement('article');
      card.className = 'dashboard-artist-item';
      card.innerHTML = `
        <button class="dashboard-artist-item__queue" title="Add artist songs to queue">≡+</button>
        <button class="dashboard-artist-item__open">
          <strong>${artist.name}</strong>
          <small>${artist.getAlbums().length} albums</small>
        </button>
      `;

      const openBtn = card.querySelector('.dashboard-artist-item__open') as HTMLButtonElement;
      const queueBtn = card.querySelector('.dashboard-artist-item__queue') as HTMLButtonElement;

      openBtn.addEventListener('click', () => openArtistRoute(artist.name));
      queueBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const songs = player.playlist.toArray().filter((song) => song.artist === artist.name);
        songs.forEach((song) => {
          player.addToPlaybackQueue(song.id);
        });
        if (songs.length > 0) {
          toast.show(`Added ${songs.length} song(s) to queue.`, 'success');
        }
      });

      shell.dashboardArtistsList.appendChild(card);
    });
  };

  const applyHeaderSearchFilter = (): void => {
    const term = shell.headerSearchInput.value.trim().toLowerCase();
    const selectors = [
      '.song-card',
      '.album-chip',
      '.dashboard-artist-item',
      '.playlist-tile',
      '.queue-row',
      '.sidebar-playlist-item',
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (!term) {
          element.classList.remove('hidden');
          return;
        }
        const haystack = (element.textContent ?? '').toLowerCase();
        element.classList.toggle('hidden', !haystack.includes(term));
      });
    });
  };

  renderDashboardArtists();

  new AlbumHeaderView(shell.albumsHeaderTrack, shell.albumsSongsList, player, {
    onRemoveAlbum: (albumName) => {
      const removedCount = playlistService.removeAlbumFromQueue(albumName);
      if (removedCount === 0) return;
      syncQueueWithPersisted();
      syncArtistsWithVisibleSongs();
      playlistDetailsView.refreshCurrentPlaylist();
      toast.show(`Album removed from playback (${removedCount} songs).`, 'success');
    },
    onOpenAlbumProperties: (albumName) => {
      openAlbumPropertiesModal(albumName);
    },
  });

  const playlistView = new PlaylistView(shell.recentlyPlayedTrack, player, {
    isSongVisible: (song) => !playlistService.isSongDismissedFromRecentlyPlayed(song.id),
    onRemoveSong: (songId) => {
      const removed = playlistService.dismissSongFromRecentlyPlayed(songId);
      if (!removed) return;
      syncArtistsWithVisibleSongs();
      toast.show('Removed from recently played history.', 'success');
      playlistView.render();
    },
  });

  const openPlaylist = (playlistId: string): void => {
    const playlist = playlistService.getPlaylistById(playlistId);
    if (!playlist) return;
    navigation.showPlaylistDetail();
    playlistDetailsView.showPlaylist(playlist);
  };

  const playlistsView = new PlaylistsView(
    shell.playlistsGrid,
    playlistService,
    (playlist) => openPlaylist(playlist.id),
    confirmModal,
    toast,
    (playlist) => {
      const songs = playlistService.getSongsForPlaylist(playlist.id);
      songs.forEach((song) => player.addToPlaybackQueue(song.id));
      if (songs.length > 0) {
        toast.show(`Added ${songs.length} song(s) from playlist to queue.`, 'success');
      }
    },
    () => {
      playlistSidebarView.render();
      playlistDetailsView.refreshCurrentPlaylist();
      syncQueueWithPersisted();
      syncArtistsWithVisibleSongs();
    },
  );

  const playlistSidebarView = new PlaylistSidebarView(
    playlistService,
    localImporter,
    importers,
    toast,
    confirmModal,
    (playlist) => openPlaylist(playlist.id),
    () => {
      playlistsView.render();
      playlistDetailsView.refreshCurrentPlaylist();
      syncQueueWithPersisted();
      syncArtistsWithVisibleSongs();
    },
  );

  new LocalLibraryImportView(
    shell.importZone,
    shell.fileInput,
    player,
    localImporter,
    playlistService,
    toast,
  );

  shell.coverFlowButton.addEventListener('click', () => {
    navigation.showCoverFlow();
    coverFlowView.focusStage();
  });
  shell.headerSearchInput.addEventListener('input', applyHeaderSearchFilter);
  shell.toggleSidebarButton.addEventListener('click', () => {
    sidebarPanel.classList.toggle('playlist-sidebar--expanded');
  });
  shell.openArtistsLibraryButton.addEventListener('click', () => {
    navigation.showArtists();
    artistsLibraryView.render();
  });
  shell.localImportButton.addEventListener('click', () => playlistSidebarView.openModal('local'));
  shell.glossyImportButton.addEventListener('click', () => shell.fileInput.click());
  shell.serviceImportButton.addEventListener('click', () => playlistSidebarView.openModal('import'));
  shell.backDashboardButton.addEventListener('click', () => navigation.showDashboard());
  shell.backFromArtistsButton.addEventListener('click', () => navigation.showDashboard());

  player.events.on('playlist-change', applyHeaderSearchFilter);
  player.events.on('queue-change', applyHeaderSearchFilter);
}
