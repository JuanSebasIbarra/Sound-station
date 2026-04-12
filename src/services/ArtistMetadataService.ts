import type { IArtistMetadata } from '../interfaces/IArtistMetadata.js';

/**
 * ArtistMetadataService – fetches artist bios and images.
 *
 * Production options:
 *  • MusicBrainz (free, open data):  https://musicbrainz.org/doc/MusicBrainz_API
 *  • Last.fm (free tier):            https://www.last.fm/api/show/artist.getInfo
 *  • Spotify Artist endpoint:         GET /v1/artists/{id}
 *
 * In demo mode a curated set of well-known artists is used; unknown
 * artists receive a generic generated bio.
 */
export class ArtistMetadataService implements IArtistMetadata {
  private static readonly ARTIST_DB: Record<string, { bio: string; image: string; topTracks: string[] }> = {
    'The Weeknd': {
      bio: 'Abel Makkonen Tesfaye, known professionally as The Weeknd, is a Canadian singer, songwriter, and record producer. He is known for his sonic versatility and dark lyricism exploring escapism, romance, and substance abuse.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/The_Weeknd_-_2019_%28Edited%29.jpg/220px-The_Weeknd_-_2019_%28Edited%29.jpg',
      topTracks: ['Blinding Lights', 'Starboy', 'Save Your Tears', 'Can\'t Feel My Face'],
    },
    'Billie Eilish': {
      bio: 'Billie Eilish Pirate Baird O\'Connell is an American singer and songwriter. She first gained public attention in 2015 with her debut single "Ocean Eyes". Known for her signature whispery vocals and dark pop aesthetic.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Billie_Eilish_-_2019_by_Glenn_Francis.jpg/220px-Billie_Eilish_-_2019_by_Glenn_Francis.jpg',
      topTracks: ['Bad Guy', 'Happier Than Ever', 'Therefore I Am', 'Ocean Eyes'],
    },
    'Dua Lipa': {
      bio: 'Dua Lipa is an English-Albanian singer, songwriter, and model. Her 2020 album "Future Nostalgia" received widespread critical acclaim and peaked at number 2 in both the UK and US charts.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Dua_Lipa_2021.jpg/220px-Dua_Lipa_2021.jpg',
      topTracks: ['Levitating', 'Don\'t Start Now', 'Physical', 'New Rules'],
    },
    'Harry Styles': {
      bio: 'Harry Edward Styles is an English singer, songwriter, and actor. He rose to fame as a member of the boy band One Direction. His solo work spans pop, rock, and soft rock with a retro 1970s aesthetic.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Harry_Styles_in_2017.jpg/220px-Harry_Styles_in_2017.jpg',
      topTracks: ['As It Was', 'Watermelon Sugar', 'Adore You', 'Golden'],
    },
    'Olivia Rodrigo': {
      bio: 'Olivia Isabel Rodrigo is an American singer-songwriter and actress. Her debut single "drivers license" became a viral sensation in early 2021, breaking Spotify\'s record for most streams in a single day.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Olivia_Rodrigo_2022.jpg/220px-Olivia_Rodrigo_2022.jpg',
      topTracks: ['drivers license', 'good 4 u', 'deja vu', 'brutal'],
    },
    'BTS': {
      bio: 'BTS, also known as the Bangtan Boys, is a South Korean boy band formed in Seoul in 2013. They are the best-selling music act in South Korean history and have achieved global recognition through K-pop.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/BTS_at_the_BBMAs_2019.jpg/220px-BTS_at_the_BBMAs_2019.jpg',
      topTracks: ['Butter', 'Dynamite', 'Boy With Luv', 'Permission to Dance'],
    },
  };

  async getBio(artistName: string): Promise<string> {
    await this._delay(200);
    const data = ArtistMetadataService.ARTIST_DB[artistName];
    return data?.bio ??
      `${artistName} is a talented artist with a unique sound that has captivated audiences worldwide. Their music blends multiple genres creating a distinctive and memorable listening experience.`;
  }

  async getImageUrl(artistName: string): Promise<string> {
    await this._delay(150);
    return ArtistMetadataService.ARTIST_DB[artistName]?.image ?? '';
  }

  async getTopTracks(artistName: string): Promise<string[]> {
    await this._delay(200);
    return ArtistMetadataService.ARTIST_DB[artistName]?.topTracks ?? [];
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
