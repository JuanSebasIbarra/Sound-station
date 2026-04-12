export type UserPlaylistSource = 'local' | 'spotify' | 'apple_music' | 'youtube_music';

export interface IUserPlaylist {
  id: string;
  name: string;
  source: UserPlaylistSource;
  coverArt: string;
  songIds: string[];
  createdAt: number;
}
