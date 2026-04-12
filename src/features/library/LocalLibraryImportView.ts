import { LocalFileImporter } from '../../services/LocalFileImporter.js';
import { Player } from '../../core/Player.js';
import { Toast } from '../../components/common/Toast.js';

/**
 * LocalLibraryImportView
 *
 * Handles import button + drag and drop area for local files.
 */
export class LocalLibraryImportView {
  constructor(
    private readonly zone: HTMLElement,
    private readonly fileInput: HTMLInputElement,
    private readonly player: Player,
    private readonly importer: LocalFileImporter,
    private readonly toast: Toast,
  ) {
    this.bindEvents();
  }

  private bindEvents(): void {
    this.zone.addEventListener('click', () => this.fileInput.click());

    this.fileInput.addEventListener('change', async () => {
      const files = this.fileInput.files;
      if (!files?.length) return;
      await this.importFiles(files);
      this.fileInput.value = '';
    });

    this.zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.zone.classList.add('drag-active');
    });

    this.zone.addEventListener('dragleave', () => {
      this.zone.classList.remove('drag-active');
    });

    this.zone.addEventListener('drop', async (event) => {
      event.preventDefault();
      this.zone.classList.remove('drag-active');
      const files = event.dataTransfer?.files;
      if (!files?.length) return;
      await this.importFiles(files);
    });
  }

  async importFiles(files: FileList): Promise<void> {
    const songs = await this.importer.importFiles(files);
    if (songs.length === 0) {
      this.toast.show('No audio files found.', 'error');
      return;
    }

    this.player.addMany(songs);
    this.toast.show(`Imported ${songs.length} local songs.`, 'success');

    if (!this.player.isPlaying && songs[0]) {
      await this.player.play(songs[0].id);
    }
  }
}
