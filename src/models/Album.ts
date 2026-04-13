import { DoublyLinkedList } from '../core/DoublyLinkedList.js';
import type { ISong } from '../interfaces/ISong.js';
import type { IStoredAlbum } from '../interfaces/ILibraryState.js';

export class Album {
  private readonly songsList = new DoublyLinkedList();

  constructor(
    public readonly name: string,
    public readonly savedAt: number = Date.now(),
  ) {}

  get songs(): DoublyLinkedList {
    return this.songsList;
  }

  addSong(song: ISong): void {
    if (!this.songsList.has(song.id)) {
      this.songsList.addAtEnd(song);
    }
  }

  addSongs(songs: ISong[]): void {
    songs.forEach((song) => this.addSong(song));
  }

  toArray(): ISong[] {
    return this.songsList.toArray();
  }

  toJSON(): IStoredAlbum {
    return {
      name: this.name,
      savedAt: this.savedAt,
      songs: this.toArray().map((song) => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        albumArt: song.albumArt,
        source: song.source,
        localFilePath: song.localFilePath,
        collaborators: song.collaborators,
      })),
    };
  }

  static fromStoredAlbum(album: IStoredAlbum): Album {
    const model = new Album(album.name, album.savedAt);
    model.addSongs(album.songs.map((song) => ({
      ...song,
      description: `${song.artist} - ${song.title}`,
      isFileAvailable: true,
      collaborators: song.collaborators ?? [],
    })));
    return model;
  }
}
