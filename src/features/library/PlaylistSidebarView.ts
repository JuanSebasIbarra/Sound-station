import type { IPlaylistImporter } from '../../interfaces/IPlaylistImporter.js';
import type { IUserPlaylist, UserPlaylistSource } from '../../interfaces/IUserPlaylist.js';
import { LocalFileImporter } from '../../services/LocalFileImporter.js';
import { PlaylistService } from '../../services/PlaylistService.js';
import { Toast } from '../../components/common/Toast.js';
import { ModalComponent } from '../../components/common/ModalComponent.js';
import { generateGradientArt } from '../../utils/helpers.js';

type ServiceKey = 'spotify' | 'apple' | 'youtube';

const SOURCE_LABEL: Record<UserPlaylistSource, string> = {
  local: '💾 Local Storage',
  spotify: '🟢 From Spotify',
  apple_music: ' From Apple Music',
  youtube_music: '🔴 From YouTube Music',
};

/**
 * PlaylistSidebarView
 *
 * Sidebar controller for playlist cards (open/delete/create/import).
 */
export class PlaylistSidebarView {
  private selectedImportService: ServiceKey = 'spotify';
  private localCoverDataUrl = '';

  private readonly listEl = document.getElementById('sidebar-playlists') as HTMLElement;
  private readonly openBtn = document.getElementById('btn-create-playlist') as HTMLButtonElement;
  private readonly modalOverlay = document.getElementById('playlist-create-modal-overlay') as HTMLElement;

  private readonly choiceStep = document.getElementById('playlist-create-choice') as HTMLElement;
  private readonly localStep = document.getElementById('playlist-create-local') as HTMLElement;
  private readonly importStep = document.getElementById('playlist-create-import') as HTMLElement;

  private readonly backBtn = document.getElementById('btn-playlist-modal-back') as HTMLButtonElement;
  private readonly closeBtn = document.getElementById('btn-playlist-modal-close') as HTMLButtonElement;

  private readonly localNameInput = document.getElementById('playlist-local-name') as HTMLInputElement;
  private readonly localPhotoInput = document.getElementById('playlist-local-photo') as HTMLInputElement;
  private readonly localPhotoPreview = document.getElementById('playlist-local-photo-preview') as HTMLImageElement;
  private readonly pickPhotoBtn = document.getElementById('btn-pick-local-photo') as HTMLButtonElement;
  private readonly createLocalBtn = document.getElementById('btn-create-local-playlist') as HTMLButtonElement;
  private readonly localFilesInput = document.getElementById('playlist-local-files') as HTMLInputElement;

  private readonly importTabs = document.querySelectorAll<HTMLElement>('.playlist-import-tab');
  private readonly importNameInput = document.getElementById('playlist-import-name') as HTMLInputElement;
  private readonly importIdInput = document.getElementById('playlist-import-id') as HTMLInputElement;
  private readonly createImportBtn = document.getElementById('btn-create-import-playlist') as HTMLButtonElement;

  private readonly choiceLocalBtn = document.getElementById('btn-choice-local') as HTMLButtonElement;
  private readonly choiceImportBtn = document.getElementById('btn-choice-import') as HTMLButtonElement;

  constructor(
    private readonly playlistService: PlaylistService,
    private readonly localImporter: LocalFileImporter,
    private readonly importers: Record<ServiceKey, IPlaylistImporter>,
    private readonly toast: Toast,
    private readonly modal: ModalComponent,
    private readonly onPlaylistSelected: (playlist: IUserPlaylist) => void,
    private readonly onPlaylistsChanged?: () => void,
  ) {
    this.bindEvents();
    this.render();
  }

  openModal(mode?: 'local' | 'import'): void {
    this.modalOverlay.classList.remove('hidden');
    if (mode === 'local') this.showLocalStep();
    else if (mode === 'import') this.showImportStep();
    else this.showChoiceStep();
  }

  private closeModal(): void {
    this.modalOverlay.classList.add('hidden');
    this.resetModalState();
  }

  private bindEvents(): void {
    this.openBtn.addEventListener('click', () => this.openModal());
    this.closeBtn.addEventListener('click', () => this.closeModal());
    this.backBtn.addEventListener('click', () => this.showChoiceStep());

    this.modalOverlay.addEventListener('click', (event) => {
      if (event.target === this.modalOverlay) this.closeModal();
    });

    this.choiceLocalBtn.addEventListener('click', () => this.showLocalStep());
    this.choiceImportBtn.addEventListener('click', () => this.showImportStep());

    this.pickPhotoBtn.addEventListener('click', () => this.localPhotoInput.click());
    this.localPhotoInput.addEventListener('change', async () => {
      const file = this.localPhotoInput.files?.[0];
      if (!file) return;
      this.localCoverDataUrl = await this.fileToDataUrl(file);
      this.localPhotoPreview.src = this.localCoverDataUrl;
      this.localPhotoPreview.classList.remove('hidden');
    });

    this.createLocalBtn.addEventListener('click', () => {
      const name = this.localNameInput.value.trim();
      if (!name) {
        this.toast.show('Please provide a playlist name.', 'error');
        return;
      }
      this.localFilesInput.click();
    });

    this.localFilesInput.addEventListener('change', async () => {
      const files = this.localFilesInput.files;
      if (!files?.length) return;

      const name = this.localNameInput.value.trim();
      if (!name) return;

      const songs = await this.localImporter.importFiles(files);
      if (!songs.length) {
        this.toast.show('No valid audio files were selected.', 'error');
        return;
      }

      const playlist = this.playlistService.createPlaylist({
        name,
        source: 'local',
        coverArt: this.localCoverDataUrl || songs[0].albumArt || generateGradientArt(name),
        songs,
      });

      this.toast.show(`Playlist "${name}" created with ${songs.length} songs.`, 'success');
      this.render();
      this.onPlaylistsChanged?.();
      this.closeModal();
      this.onPlaylistSelected(playlist);
    });

    this.importTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.importTabs.forEach((item) => item.classList.remove('active'));
        tab.classList.add('active');
        this.selectedImportService = (tab.dataset['service'] as ServiceKey) ?? 'spotify';
      });
    });

    this.createImportBtn.addEventListener('click', async () => {
      const name = this.importNameInput.value.trim();
      const playlistId = this.importIdInput.value.trim() || 'demo';

      if (!name) {
        this.toast.show('Please provide a playlist name.', 'error');
        return;
      }

      const importer = this.importers[this.selectedImportService];
      this.createImportBtn.textContent = 'Importing...';
      this.createImportBtn.setAttribute('disabled', 'true');

      try {
        await importer.authenticate({});
        const songs = await importer.importPlaylist(playlistId);
        if (!songs.length) {
          this.toast.show('No songs returned by service.', 'error');
          return;
        }

        const playlist = this.playlistService.createPlaylist({
          name,
          source: this.mapServiceToSource(this.selectedImportService),
          coverArt: songs[0].albumArt || generateGradientArt(name),
          songs,
        });

        this.toast.show(`Playlist "${name}" imported successfully.`, 'success');
        this.render();
        this.onPlaylistsChanged?.();
        this.closeModal();
        this.onPlaylistSelected(playlist);
      } catch (error) {
        console.error('[PlaylistSidebarView] Import error:', error);
        this.toast.show('Could not import playlist from service.', 'error');
      } finally {
        this.createImportBtn.textContent = 'Import and create playlist';
        this.createImportBtn.removeAttribute('disabled');
      }
    });
  }

  render(): void {
    const playlists = this.playlistService.getPlaylists();
    this.listEl.innerHTML = '';

    if (playlists.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'playlist-sidebar__subtitle';
      empty.textContent = 'No playlists yet. Use + Create.';
      this.listEl.appendChild(empty);
      return;
    }

    playlists.forEach((playlist) => {
      const item = document.createElement('article');
      item.className = 'sidebar-playlist-item';
      item.innerHTML = `
        <img src="${playlist.coverArt}" alt="${playlist.name} cover" />
        <div>
          <strong>${playlist.name}</strong>
          <small>${SOURCE_LABEL[playlist.source]} · ${playlist.songIds.length} songs</small>
        </div>
      `;

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

      item.appendChild(deleteButton);

      item.addEventListener('click', () => {
        this.onPlaylistSelected(playlist);
      });

      this.listEl.appendChild(item);
    });
  }

  private showChoiceStep(): void {
    this.choiceStep.classList.remove('hidden');
    this.localStep.classList.add('hidden');
    this.importStep.classList.add('hidden');
    this.backBtn.classList.add('hidden');
  }

  private showLocalStep(): void {
    this.choiceStep.classList.add('hidden');
    this.localStep.classList.remove('hidden');
    this.importStep.classList.add('hidden');
    this.backBtn.classList.remove('hidden');
  }

  private showImportStep(): void {
    this.choiceStep.classList.add('hidden');
    this.localStep.classList.add('hidden');
    this.importStep.classList.remove('hidden');
    this.backBtn.classList.remove('hidden');
  }

  private resetModalState(): void {
    this.showChoiceStep();
    this.localNameInput.value = '';
    this.localPhotoInput.value = '';
    this.localFilesInput.value = '';
    this.importNameInput.value = '';
    this.importIdInput.value = '';
    this.localCoverDataUrl = '';
    this.localPhotoPreview.src = '';
    this.localPhotoPreview.classList.add('hidden');
  }

  private async fileToDataUrl(file: File): Promise<string> {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });
  }

  private mapServiceToSource(service: ServiceKey): UserPlaylistSource {
    if (service === 'spotify') return 'spotify';
    if (service === 'apple') return 'apple_music';
    return 'youtube_music';
  }
}
