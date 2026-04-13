import type { ILibraryState, IM3URegistryEntry } from '../interfaces/ILibraryState.js';

interface AudioBlobRecord {
  path: string;
  blob: Blob;
  updatedAt: number;
}

interface PersistedAppState<TState extends object> {
  state: TState;
  library: ILibraryState;
  m3uRegistry: Record<string, IM3URegistryEntry>;
}

export class StorageService {
  private static readonly STATE_KEY = 'sound-station.state.v3';
  private static readonly AUDIO_DB = 'sound-station-audio-db';
  private static readonly AUDIO_STORE = 'audio-blobs';

  async getAudioUrlByPath(path: string): Promise<string | null> {
    const record = await this.readAudioBlob(path);
    if (!record) return null;
    return URL.createObjectURL(record.blob);
  }

  async saveAudioBlob(path: string, blob: Blob): Promise<void> {
    if (!path.trim()) return;
    const db = await this.openAudioDatabase();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(StorageService.AUDIO_STORE, 'readwrite');
      const store = tx.objectStore(StorageService.AUDIO_STORE);
      const payload: AudioBlobRecord = {
        path,
        blob,
        updatedAt: Date.now(),
      };
      store.put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not save audio blob.'));
      tx.onabort = () => reject(tx.error ?? new Error('Audio blob transaction aborted.'));
    });
  }

  loadAppState<TState extends object = Record<string, unknown>>(): PersistedAppState<TState> | null {
    const raw = localStorage.getItem(StorageService.STATE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as PersistedAppState<TState>;
    } catch {
      return null;
    }
  }

  saveAppState<TState extends object>(payload: PersistedAppState<TState>): void {
    localStorage.setItem(StorageService.STATE_KEY, JSON.stringify(payload));
  }

  private async openAudioDatabase(): Promise<IDBDatabase> {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(StorageService.AUDIO_DB, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(StorageService.AUDIO_STORE)) {
          db.createObjectStore(StorageService.AUDIO_STORE, { keyPath: 'path' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open audio database.'));
    });
  }

  private async readAudioBlob(path: string): Promise<AudioBlobRecord | null> {
    const db = await this.openAudioDatabase();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(StorageService.AUDIO_STORE, 'readonly');
      const store = tx.objectStore(StorageService.AUDIO_STORE);
      const request = store.get(path);

      request.onsuccess = () => {
        const result = request.result as AudioBlobRecord | undefined;
        resolve(result ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read audio blob.'));
    });
  }
}
