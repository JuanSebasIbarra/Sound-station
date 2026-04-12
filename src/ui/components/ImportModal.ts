import type { IPlaylistImporter } from '../../interfaces/IPlaylistImporter.js';
import { Player } from '../../core/Player.js';

type ServiceKey = 'spotify' | 'apple' | 'youtube';

/**
 * ImportModal – manages the "Import from service" dialog and the
 * local file picker.  Applies the Strategy pattern: the active
 * importer is swapped based on which tab the user selects.
 */
export class ImportModal {
  private readonly player: Player;
  private readonly importers: Record<ServiceKey, IPlaylistImporter>;

  private activeService: ServiceKey = 'spotify';

  // DOM refs
  private readonly overlayEl:   HTMLElement;
  private readonly tabs:        NodeListOf<HTMLElement>;
  private readonly closeBtn:    HTMLElement | null;
  private readonly cancelBtn:   HTMLElement;
  private readonly importBtn:   HTMLElement;
  private readonly playlistIdEl:HTMLInputElement;
  private readonly apiKeyEl:    HTMLInputElement;
  private readonly openBtn:     HTMLElement;
  private readonly fileInput:   HTMLInputElement;

  // Callback for when the local file picker returns files
  private readonly onLocalFiles: (files: FileList) => Promise<void>;

  constructor(
    player: Player,
    importers: Record<ServiceKey, IPlaylistImporter>,
    onLocalFiles: (files: FileList) => Promise<void>,
  ) {
    this.player      = player;
    this.importers   = importers;
    this.onLocalFiles = onLocalFiles;

    this.overlayEl    = document.getElementById('modal-overlay')!;
    this.tabs         = document.querySelectorAll<HTMLElement>('.modal__tab');
    this.closeBtn     = document.getElementById('btn-modal-close');
    this.cancelBtn    = document.getElementById('btn-modal-cancel')!;
    this.importBtn    = document.getElementById('btn-modal-import')!;
    this.playlistIdEl = document.getElementById('service-playlist-id') as HTMLInputElement;
    this.apiKeyEl     = document.getElementById('service-api-key')     as HTMLInputElement;
    this.openBtn      = document.getElementById('btn-import-service')!;
    this.fileInput    = document.getElementById('file-input')          as HTMLInputElement;

    this._bindEvents();
  }

  open(): void  { this.overlayEl.classList.remove('hidden'); }
  close(): void { this.overlayEl.classList.add('hidden'); }

  // ── Private ───────────────────────────────────────────────────

  private _bindEvents(): void {
    // Open / close
    this.openBtn.addEventListener('click',   () => this.open());
    this.closeBtn?.addEventListener('click',  () => this.close());
    this.cancelBtn.addEventListener('click', () => this.close());
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.close();
    });

    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeService = (tab.dataset['service'] as ServiceKey) ?? 'spotify';
      });
    });

    // Import button
    this.importBtn.addEventListener('click', () => void this._runImport());

    // Enter key in playlist ID
    this.playlistIdEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this._runImport();
    });

    // Local file import
    document.getElementById('btn-import-local')?.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.fileInput.addEventListener('change', async () => {
      const files = this.fileInput.files;
      if (files && files.length > 0) {
        await this.onLocalFiles(files);
        this.fileInput.value = '';
      }
    });
  }

  private async _runImport(): Promise<void> {
    const playlistId = this.playlistIdEl.value.trim() || 'demo';
    const apiKey     = this.apiKeyEl.value.trim();

    const importer = this.importers[this.activeService];

    this.importBtn.textContent = 'Importing…';
    this.importBtn.setAttribute('disabled', 'true');

    try {
      await importer.authenticate({ apiKey });
      const songs = await importer.importPlaylist(playlistId);

      this.player.addMany(songs);
      this.close();

      // Auto-play first imported song if nothing playing
      if (!this.player.isPlaying && songs.length > 0) {
        void this.player.play(songs[0].id);
      }

      this._toast(`Imported ${songs.length} songs from ${importer.name}`, 'success');
    } catch (err) {
      console.error('[ImportModal] Import failed:', err);
      this._toast('Import failed – check console for details', 'error');
    } finally {
      this.importBtn.textContent = 'Import Playlist';
      this.importBtn.removeAttribute('disabled');
    }
  }

  private _toast(msg: string, type: 'success' | 'error' | 'info' = 'info'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}
