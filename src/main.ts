import './styles/base.css';
import './styles/components/glossy-button.css';
import './styles/layout/dashboard.css';
import './styles/features/cards.css';
import './styles/features/player-bar.css';

import { Player } from './core/Player.js';
import type { ISong } from './interfaces/ISong.js';
import { generateGradientArt, generateId } from './utils/helpers.js';

import { SpotifyImporter } from './services/SpotifyImporter.js';
import { AppleMusicImporter } from './services/AppleMusicImporter.js';
import { YouTubeMusicImporter } from './services/YouTubeMusicImporter.js';
import { LocalFileImporter } from './services/LocalFileImporter.js';

import { DashboardShell } from './components/layout/DashboardShell.js';
import { NavigationController } from './components/layout/NavigationController.js';
import { Toast } from './components/common/Toast.js';
import { ModalComponent } from './components/common/ModalComponent.js';
import { PlaylistView } from './features/playlist/PlaylistView.js';
import { PlayerBar } from './features/player/PlayerBar.js';
import { PlaylistsView } from './features/library/PlaylistsView.js';
import { LocalLibraryImportView } from './features/library/LocalLibraryImportView.js';
import { PlaylistSidebarView } from './features/library/PlaylistSidebarView.js';
import { PlaylistDetailsView } from './features/library/PlaylistDetailsView.js';
import { PlaylistService } from './services/PlaylistService.js';

// ═════════════════════════════════════════════════════════════════
//  Demo seed data
// ═════════════════════════════════════════════════════════════════

const DEMO_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

const DEMO_SONGS: ISong[] = [
  {
    id: generateId(),
    title: 'Watch the Throne',
    artist: 'JAY-Z · Kanye West',
    album: 'Collab Sessions',
    duration: 217,
    albumArt: generateGradientArt('Watch the Throne'),
    description: 'High-fidelity hip-hop mix for the hero section.',
    genre: 'Hip-Hop',
    year: 2011,
    source: 'local',
    audioUrl: DEMO_AUDIO,
  },
  {
    id: generateId(),
    title: 'Vol. 3',
    artist: 'Slipknot',
    album: 'The Subliminal Verses',
    duration: 262,
    albumArt: generateGradientArt('Vol3 Slipknot'),
    description: 'Heavy alt-metal with classic 2010-era dashboard energy.',
    genre: 'Metal',
    year: 2004,
    source: 'spotify',
    audioUrl: DEMO_AUDIO,
  },
  {
    id: generateId(),
    title: 'Beautiful Lie',
    artist: 'Thirty Seconds to Mars',
    album: 'A Beautiful Lie',
    duration: 241,
    albumArt: generateGradientArt('Beautiful Lie'),
    description: 'Alternative anthem with cinematic dynamics.',
    genre: 'Alternative',
    year: 2005,
    source: 'spotify',
    audioUrl: DEMO_AUDIO,
  },
  {
    id: generateId(),
    title: 'Get Rich or Die Tryin\'',
    artist: '50 Cent',
    album: 'Bonus Edition',
    duration: 208,
    albumArt: generateGradientArt('Get Rich or Die Tryin'),
    description: 'A gritty old-school urban groove.',
    genre: 'Hip-Hop',
    year: 2003,
    source: 'youtube_music',
    audioUrl: DEMO_AUDIO,
  },
  {
    id: generateId(),
    title: 'Pitbull Work',
    artist: 'Pitbull',
    album: 'Single',
    duration: 179,
    albumArt: generateGradientArt('Pitbull Work'),
    description: 'Summer dance floor pulse, built for the hero carousel.',
    genre: 'Dance',
    year: 2013,
    source: 'apple_music',
    audioUrl: DEMO_AUDIO,
  },
  {
    id: generateId(),
    title: 'Rocket Loop',
    artist: 'Juan Ibarra',
    album: 'Local Collection',
    duration: 191,
    albumArt: generateGradientArt('Rocket Loop'),
    description: 'Local library song card to demonstrate file-source grouping.',
    genre: 'Local',
    year: 2026,
    source: 'apple_music',
    audioUrl: DEMO_AUDIO,
  },
];

// ═════════════════════════════════════════════════════════════════
//  Bootstrap
// ═════════════════════════════════════════════════════════════════

async function bootstrap(): Promise<void> {
  const player = Player.getInstance();
  const shell = new DashboardShell();
  const navigation = new NavigationController();
  const toast = new Toast(document.getElementById('toast-container') as HTMLElement);
  const confirmModal = new ModalComponent();
  const playlistService = new PlaylistService();
  const localImporter = new LocalFileImporter();

  const importers = {
    spotify: new SpotifyImporter(),
    apple: new AppleMusicImporter(),
    youtube: new YouTubeMusicImporter(),
  };

  playlistService.seedIfEmpty(DEMO_SONGS);
  player.clearPlaylist();
  player.addMany(playlistService.getAllQueueSongs());

  new PlaylistView(shell.recentlyPlayedTrack, player);
  new PlayerBar(player);
  const playlistDetailsView = new PlaylistDetailsView(player, playlistService, toast);

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
    () => {
      playlistSidebarView.render();
      playlistDetailsView.refreshCurrentPlaylist();
      player.clearPlaylist();
      player.addMany(playlistService.getAllQueueSongs());
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
      player.clearPlaylist();
      player.addMany(playlistService.getAllQueueSongs());
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

  shell.localImportButton.addEventListener('click', () => playlistSidebarView.openModal('local'));
  shell.glossyImportButton.addEventListener('click', () => shell.fileInput.click());
  shell.serviceImportButton.addEventListener('click', () => playlistSidebarView.openModal('import'));
  shell.backDashboardButton.addEventListener('click', () => navigation.showDashboard());

  if (player.currentSong) {
    await player.play(player.currentSong.id);
  }
}

// ═════════════════════════════════════════════════════════════════
//  Helpers
// ═════════════════════════════════════════════════════════════════

bootstrap().catch(err => {
  console.error('[Sound-Station] Bootstrap error:', err);
});
