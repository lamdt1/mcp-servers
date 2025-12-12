/**
 * Mock MP3 API Client for offline testing
 * Returns sample data without making network requests
 */

import {
  SearchResult,
  LyricResult,
  StreamingResult,
  ArtistResult,
  AlbumResult,
} from "./mp3ApiClient.js";

export class MockMp3ApiClient {
  async searchSongs(keyword: string): Promise<SearchResult> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      songs: [
        {
          encodeId: "Z6Z0F6D6",
          title: `Mock Song - ${keyword}`,
          artistsNames: "Mock Artist",
          thumbnail: "https://example.com/thumb.jpg",
          duration: 240,
        },
        {
          encodeId: "Z6Z0F6D7",
          title: `Another Mock Song - ${keyword}`,
          artistsNames: "Mock Artist 2",
          thumbnail: "https://example.com/thumb2.jpg",
          duration: 180,
        },
      ],
    };
  }

  async fetchLyrics(id: string): Promise<LyricResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      songId: id,
      lyric: `Mock lyrics for song ${id}\n\nThis is a test lyric line.\nAnother test line here.`,
      sentences: [
        { words: "Mock lyrics for song" },
        { words: "This is a test lyric line" },
      ],
    };
  }

  async fetchStreaming(id: string): Promise<StreamingResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      songId: id,
      sources: {
        lossless: `https://example.com/stream/${id}/lossless.mp3`,
        "320": `https://example.com/stream/${id}/320.mp3`,
        m4a: `https://example.com/stream/${id}/m4a.m4a`,
        "128": `https://example.com/stream/${id}/128.mp3`,
      },
    };
  }

  async fetchArtist(name: string): Promise<ArtistResult | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      name: `Mock Artist - ${name}`,
      alias: name,
      thumbnail: "https://example.com/artist.jpg",
      totalFollow: 1000000,
    };
  }

  async fetchAlbum(id: string): Promise<AlbumResult | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      encodeId: id,
      title: `Mock Album - ${id}`,
      artistsNames: "Mock Artist",
      thumbnail: "https://example.com/album.jpg",
    };
  }
}

