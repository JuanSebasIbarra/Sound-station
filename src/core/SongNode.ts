import type { ISong } from '../interfaces/ISong.js';

/**
 * SongNode – a node in the doubly linked list.
 *
 * Encapsulates the song's metadata and the bidirectional
 * pointers required by DoublyLinkedList.
 */
export class SongNode {
  public readonly song: ISong;
  public next: SongNode | null = null;
  public prev: SongNode | null = null;

  constructor(song: ISong) {
    this.song = song;
  }

  get id(): string {
    return this.song.id;
  }
}
