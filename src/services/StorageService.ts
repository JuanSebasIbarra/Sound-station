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

const EMPTY_LIBRARY_STATE: ILibraryState = {
  artists: {},
  playbackHistory: [],
};

export class StorageService {
  private static readonly STATE_KEY = 'sound-station.state.v3';
  private static readonly APP_DB = 'sound-station-app-db';
  private static readonly APP_STORE = 'app-state';
  private static readonly APP_STATE_ID = 'singleton';
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
    try {
      localStorage.setItem(StorageService.STATE_KEY, JSON.stringify(payload));
    } catch (error) {
      const isQuotaExceeded = error instanceof DOMException && error.name === 'QuotaExceededError';
      if (!isQuotaExceeded) throw error;

      // Keep a minimal legacy snapshot so old sync callers do not crash.
      const safePayload = {
        state: {} as TState,
        library: payload.library,
        m3uRegistry: payload.m3uRegistry,
      };
      localStorage.setItem(StorageService.STATE_KEY, JSON.stringify(safePayload));
    }
  }

  async loadAppStateAsync<TState extends object = Record<string, unknown>>(): Promise<PersistedAppState<TState> | null> {
    const fromDb = await this.readAppState<TState>();
    if (fromDb) return fromDb;

    const legacy = this.loadAppState<TState>();
    if (!legacy) return null;

    await this.writeAppState(legacy);
    return legacy;
  }

  async saveAppStateAsync<TState extends object>(payload: PersistedAppState<TState>): Promise<void> {
    await this.writeAppState(payload);
    this.saveAppState(payload);
  }

  async savePlaylistState<TState extends object>(
    state: TState,
    m3uRegistry: Record<string, IM3URegistryEntry>,
  ): Promise<void> {
    const current = await this.loadAppStateAsync<Record<string, unknown>>();
    await this.saveAppStateAsync<TState>({
      state,
      library: current?.library ?? EMPTY_LIBRARY_STATE,
      m3uRegistry,
    });
  }

  async saveLibraryState(library: ILibraryState): Promise<void> {
    const current = await this.loadAppStateAsync<Record<string, unknown>>();
    await this.saveAppStateAsync<Record<string, unknown>>({
      state: current?.state ?? {},
      library,
      m3uRegistry: current?.m3uRegistry ?? {},
    });
  }

  private async openAppDatabase(): Promise<IDBDatabase> {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open(StorageService.APP_DB, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(StorageService.APP_STORE)) {
          db.createObjectStore(StorageService.APP_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open app state database.'));
    });
  }

  private async readAppState<TState extends object>(): Promise<PersistedAppState<TState> | null> {
    const db = await this.openAppDatabase();

    return await new Promise((resolve, reject) => {
      const tx = db.transaction(StorageService.APP_STORE, 'readonly');
      const store = tx.objectStore(StorageService.APP_STORE);
      const request = store.get(StorageService.APP_STATE_ID);

      request.onsuccess = () => {
        const row = request.result as { id: string; payload?: PersistedAppState<TState> } | undefined;
        resolve(row?.payload ?? null);
      };

      request.onerror = () => reject(request.error ?? new Error('Could not read app state from database.'));
    });
  }

  private async writeAppState<TState extends object>(payload: PersistedAppState<TState>): Promise<void> {
    const db = await this.openAppDatabase();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(StorageService.APP_STORE, 'readwrite');
      const store = tx.objectStore(StorageService.APP_STORE);
      store.put({ id: StorageService.APP_STATE_ID, payload });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not write app state to database.'));
      tx.onabort = () => reject(tx.error ?? new Error('App state transaction aborted.'));
    });
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
