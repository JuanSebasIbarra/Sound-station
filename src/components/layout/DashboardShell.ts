/**
 * DashboardShell
 *
 * Small layout helper exposing strongly-typed DOM handles.
 */
export class DashboardShell {
  readonly dashboardView = document.getElementById('dashboard-view') as HTMLElement;
  readonly playlistDetailView = document.getElementById('playlist-detail-view') as HTMLElement;
  readonly backDashboardButton = document.getElementById('btn-back-dashboard') as HTMLButtonElement;

  readonly recentlyPlayedTrack = document.getElementById('recently-played-track') as HTMLElement;
  readonly playlistsGrid = document.getElementById('playlists-grid') as HTMLElement;
  readonly sidebarPlaylists = document.getElementById('sidebar-playlists') as HTMLElement;
  readonly importZone = document.getElementById('import-zone') as HTMLElement;
  readonly fileInput = document.getElementById('file-input') as HTMLInputElement;
  readonly localPlaylistFilesInput = document.getElementById('playlist-local-files') as HTMLInputElement;

  readonly serviceImportButton = document.getElementById('btn-import-service') as HTMLButtonElement;
  readonly localImportButton = document.getElementById('btn-import-local') as HTMLButtonElement;
  readonly glossyImportButton = document.getElementById('btn-import-glossy') as HTMLButtonElement;
  readonly createPlaylistButton = document.getElementById('btn-create-playlist') as HTMLButtonElement;
}
