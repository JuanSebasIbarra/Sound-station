
export class DashboardShell {
  readonly dashboardView = document.getElementById('dashboard-view') as HTMLElement;
  readonly playlistDetailView = document.getElementById('playlist-detail-view') as HTMLElement;
  readonly artistsView = document.getElementById('artists-view') as HTMLElement;
  readonly backDashboardButton = document.getElementById('btn-back-dashboard') as HTMLButtonElement;
  readonly backFromArtistsButton = document.getElementById('btn-back-from-artists') as HTMLButtonElement;
  readonly openArtistsLibraryButton = document.getElementById('btn-open-artists-library') as HTMLButtonElement;

  readonly albumsHeaderTrack = document.getElementById('albums-header-track') as HTMLElement;
  readonly albumsSongsList = document.getElementById('albums-songs-list') as HTMLElement;
  readonly recentlyPlayedTrack = document.getElementById('recently-played-track') as HTMLElement;
  readonly dashboardArtistsList = document.getElementById('dashboard-artists-list') as HTMLElement;
  readonly playlistsGrid = document.getElementById('playlists-grid') as HTMLElement;
  readonly queueList = document.getElementById('queue-list') as HTMLElement;
  readonly sidebarPlaylists = document.getElementById('sidebar-playlists') as HTMLElement;
  readonly importZone = document.getElementById('import-zone') as HTMLElement;
  readonly fileInput = document.getElementById('file-input') as HTMLInputElement;
  readonly localPlaylistFilesInput = document.getElementById('playlist-local-files') as HTMLInputElement;

  readonly coverFlowButton    = document.getElementById('btn-cover-flow')      as HTMLButtonElement;
  readonly headerSearchInput = document.getElementById('header-search') as HTMLInputElement;
  readonly toggleSidebarButton = document.getElementById('btn-toggle-sidebar') as HTMLButtonElement;
  readonly serviceImportButton = document.getElementById('btn-import-service') as HTMLButtonElement;
  readonly localImportButton   = document.getElementById('btn-import-local')   as HTMLButtonElement;
  readonly glossyImportButton = document.getElementById('btn-import-glossy') as HTMLButtonElement;
  readonly createPlaylistButton = document.getElementById('btn-create-playlist') as HTMLButtonElement;
}
