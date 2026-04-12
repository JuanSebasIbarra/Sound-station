import type { ISong } from '../interfaces/ISong.js';
import { SongNode } from './SongNode.js';

/**
 * DoublyLinkedList – the core playlist data structure.
 *
 * All navigation (next / previous) and mutations (add / remove)
 * operate in O(1) or O(n) as noted.  A "current" cursor tracks
 * the node that is currently playing.
 *
 *  ┌────┐   ┌────┐   ┌────┐
 *  │head│⇄ │ n  │⇄ │tail│
 *  └────┘   └────┘   └────┘
 */
export class DoublyLinkedList {
  private head: SongNode | null = null;
  private tail: SongNode | null = null;
  private current: SongNode | null = null;
  private _size: number = 0;

  // ── Index (id → node) for O(1) lookups ─────────────────────
  private readonly index = new Map<string, SongNode>();

  // ─────────────────────────────────────────────────────────────
  //  Read-only accessors
  // ─────────────────────────────────────────────────────────────

  get size(): number { return this._size; }
  get isEmpty(): boolean { return this._size === 0; }
  get currentNode(): SongNode | null { return this.current; }
  get currentSong(): ISong | null { return this.current?.song ?? null; }

  // ─────────────────────────────────────────────────────────────
  //  Mutation – O(1) additions
  // ─────────────────────────────────────────────────────────────

  /**
   * addAtStart – prepend a song.  O(1)
   */
  addAtStart(song: ISong): SongNode {
    const node = new SongNode(song);

    if (this.head === null) {
      this.head = node;
      this.tail = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }

    this.index.set(song.id, node);
    this._size++;

    if (this.current === null) this.current = node;

    return node;
  }

  /**
   * addAtEnd – append a song.  O(1)
   */
  addAtEnd(song: ISong): SongNode {
    const node = new SongNode(song);

    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }

    this.index.set(song.id, node);
    this._size++;

    if (this.current === null) this.current = node;

    return node;
  }

  /**
   * addAtPosition – insert a song at a 0-based index.  O(n)
   *
   * Index 0  → equivalent to addAtStart.
   * Index ≥ size → equivalent to addAtEnd.
   */
  addAtPosition(song: ISong, index: number): SongNode {
    if (index <= 0) return this.addAtStart(song);
    if (index >= this._size) return this.addAtEnd(song);

    // Walk to the node currently at `index`
    let cursor = this.head!;
    for (let i = 0; i < index; i++) cursor = cursor.next!;

    const node = new SongNode(song);
    const before = cursor.prev!;

    before.next = node;
    node.prev   = before;
    node.next   = cursor;
    cursor.prev = node;

    this.index.set(song.id, node);
    this._size++;

    return node;
  }

  /**
   * Bulk import – append many songs efficiently.  O(n)
   */
  addMany(songs: ISong[]): void {
    for (const song of songs) this.addAtEnd(song);
  }

  // ─────────────────────────────────────────────────────────────
  //  Mutation – removal
  // ─────────────────────────────────────────────────────────────

  /**
   * remove – delete a node by song id.  O(1) thanks to the index.
   *
   * If the removed node is the current one, advances to the next
   * (or previous if at the tail).
   */
  remove(id: string): boolean {
    const node = this.index.get(id);
    if (!node) return false;

    // Redirect current pointer before unlinking
    if (this.current === node) {
      this.current = node.next ?? node.prev;
    }

    // Re-link neighbours
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;          // removed head

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;          // removed tail

    // Clean up dangling pointers
    node.next = null;
    node.prev = null;

    this.index.delete(id);
    this._size--;

    return true;
  }

  /** Clear all nodes. */
  clear(): void {
    this.head = null;
    this.tail = null;
    this.current = null;
    this.index.clear();
    this._size = 0;
  }

  // ─────────────────────────────────────────────────────────────
  //  Navigation
  // ─────────────────────────────────────────────────────────────

  /**
   * getNext – move the current cursor forward and return the node.
   * Returns null when already at the tail.
   */
  getNext(): SongNode | null {
    if (!this.current?.next) return null;
    this.current = this.current.next;
    return this.current;
  }

  /**
   * getPrevious – move the current cursor backward and return the node.
   * Returns null when already at the head.
   */
  getPrevious(): SongNode | null {
    if (!this.current?.prev) return null;
    this.current = this.current.prev;
    return this.current;
  }

  /**
   * peekNext / peekPrevious – look ahead / behind without moving the cursor.
   */
  peekNext(): SongNode | null     { return this.current?.next ?? null; }
  peekPrevious(): SongNode | null { return this.current?.prev ?? null; }

  /**
   * jumpToId – teleport the cursor to any node by song id.  O(1)
   */
  jumpToId(id: string): SongNode | null {
    const node = this.index.get(id) ?? null;
    if (node) this.current = node;
    return node;
  }

  /**
   * jumpToHead – reset cursor to the first song.
   */
  jumpToHead(): SongNode | null {
    this.current = this.head;
    return this.current;
  }

  // ─────────────────────────────────────────────────────────────
  //  Reordering (Drag & Drop support)
  // ─────────────────────────────────────────────────────────────

  /**
   * move – relocate a node identified by `fromId` to a new
   * 0-based position.  O(n).
   */
  move(fromId: string, toIndex: number): boolean {
    const node = this.index.get(fromId);
    if (!node) return false;

    const song = node.song;
    this.remove(fromId);
    this.addAtPosition(song, toIndex);

    return true;
  }

  // ─────────────────────────────────────────────────────────────
  //  Query helpers
  // ─────────────────────────────────────────────────────────────

  /** Convert list to an ordered array (for rendering).  O(n) */
  toArray(): ISong[] {
    const result: ISong[] = [];
    let cursor = this.head;
    while (cursor) {
      result.push(cursor.song);
      cursor = cursor.next;
    }
    return result;
  }

  /** Returns the 0-based position of the node with `id`.  O(n) */
  indexOf(id: string): number {
    let cursor = this.head;
    let i = 0;
    while (cursor) {
      if (cursor.id === id) return i;
      cursor = cursor.next;
      i++;
    }
    return -1;
  }

  /** Check if a song with `id` exists in the list.  O(1) */
  has(id: string): boolean {
    return this.index.has(id);
  }

  /**
   * shuffle – Fisher-Yates shuffle applied to the list.  O(n)
   *
   * Rebuilds the linked structure in a random order while
   * preserving the current song as the head.
   */
  shuffle(): void {
    const songs = this.toArray();
    const currentSongId = this.current?.id;

    // Fisher-Yates
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }

    // Put the current song first
    if (currentSongId) {
      const idx = songs.findIndex(s => s.id === currentSongId);
      if (idx > 0) {
        const [cur] = songs.splice(idx, 1);
        songs.unshift(cur);
      }
    }

    this.clear();
    this.addMany(songs);
  }
}
