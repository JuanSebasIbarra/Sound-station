type AppView = 'dashboard' | 'playlist-detail';

/**
 * NavigationController
 *
 * Lightweight view-switcher for SPA routing between Dashboard
 * and Playlist Detail Page while keeping global playback bar alive.
 */
export class NavigationController {
  private readonly dashboardView = document.getElementById('dashboard-view') as HTMLElement;
  private readonly playlistDetailView = document.getElementById('playlist-detail-view') as HTMLElement;
  private readonly backButton = document.getElementById('btn-back-dashboard') as HTMLButtonElement;

  private currentView: AppView = 'dashboard';

  constructor() {
    this.backButton.addEventListener('click', () => this.showDashboard());
  }

  showDashboard(): void {
    this.currentView = 'dashboard';
    this.dashboardView.classList.remove('hidden');
    this.playlistDetailView.classList.add('hidden');
  }

  showPlaylistDetail(): void {
    this.currentView = 'playlist-detail';
    this.dashboardView.classList.add('hidden');
    this.playlistDetailView.classList.remove('hidden');
  }

  get activeView(): AppView {
    return this.currentView;
  }
}
