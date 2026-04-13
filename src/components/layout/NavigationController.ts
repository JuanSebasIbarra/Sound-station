type AppView = 'dashboard' | 'playlist-detail' | 'cover-flow' | 'artists';

/**
 * NavigationController
 *
 * Lightweight view-switcher for SPA routing between Dashboard,
 * Playlist Detail Page, and the full-screen Cover Flow view,
 * while keeping the global playback bar alive at all times.
 */
export class NavigationController {
  private readonly dashboardView     = document.getElementById('dashboard-view')      as HTMLElement;
  private readonly playlistDetailView = document.getElementById('playlist-detail-view') as HTMLElement;
  private readonly coverFlowView      = document.getElementById('cover-flow-view')     as HTMLElement;
  private readonly artistsView        = document.getElementById('artists-view')        as HTMLElement;
  private readonly backButton         = document.getElementById('btn-back-dashboard')  as HTMLButtonElement;
  private readonly backFromCFButton   = document.getElementById('btn-back-from-coverflow') as HTMLButtonElement;
  private readonly backFromArtistsBtn = document.getElementById('btn-back-from-artists') as HTMLButtonElement;

  private currentView: AppView = 'dashboard';

  constructor() {
    this.backButton.addEventListener('click',       () => this.showDashboard());
    this.backFromCFButton.addEventListener('click', () => this.showDashboard());
    this.backFromArtistsBtn.addEventListener('click', () => this.showDashboard());
  }

  showDashboard(): void {
    this.currentView = 'dashboard';
    this.dashboardView.classList.remove('hidden');
    this.playlistDetailView.classList.add('hidden');
    this.coverFlowView.classList.add('hidden');
    this.artistsView.classList.add('hidden');
  }

  showPlaylistDetail(): void {
    this.currentView = 'playlist-detail';
    this.dashboardView.classList.add('hidden');
    this.playlistDetailView.classList.remove('hidden');
    this.coverFlowView.classList.add('hidden');
    this.artistsView.classList.add('hidden');
  }

  showCoverFlow(): void {
    this.currentView = 'cover-flow';
    this.dashboardView.classList.add('hidden');
    this.playlistDetailView.classList.add('hidden');
    this.coverFlowView.classList.remove('hidden');
    this.artistsView.classList.add('hidden');
  }

  showArtists(): void {
    this.currentView = 'artists';
    this.dashboardView.classList.add('hidden');
    this.playlistDetailView.classList.add('hidden');
    this.coverFlowView.classList.add('hidden');
    this.artistsView.classList.remove('hidden');
  }

  get activeView(): AppView {
    return this.currentView;
  }
}
