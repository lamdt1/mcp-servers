import axios, { AxiosInstance, AxiosResponse } from "axios";
import { z } from "zod";

const songSchema = z.object({
  encodeId: z.string(),
  title: z.string(),
  artistsNames: z.string().optional(),
  thumbnail: z.string().optional(),
  duration: z.number().optional(),
});

const lyricSchema = z.object({
  lyric: z.string().optional(),
  sentences: z.array(z.any()).optional(),
});

const streamingSchema = z.record(z.string(), z.string());

const albumSchema = z.object({
  encodeId: z.string(),
  title: z.string(),
  artistsNames: z.string().optional(),
  thumbnail: z.string().optional(),
});

const artistSchema = z.object({
  name: z.string(),
  alias: z.string().optional(),
  thumbnail: z.string().optional(),
  totalFollow: z.number().optional(),
});

export interface SearchResult {
  songs: Array<z.infer<typeof songSchema>>;
}

export interface LyricResult {
  songId: string;
  lyric?: string;
  sentences?: unknown[];
}

export interface StreamingResult {
  songId: string;
  sources: Record<string, string>;
}

export interface ArtistResult extends z.infer<typeof artistSchema> {}
export interface AlbumResult extends z.infer<typeof albumSchema> {}

interface ApiEnvelope<T> {
  err?: number;
  message?: string;
  data?: T;
}

const unwrapResponse = <T>(response: AxiosResponse<ApiEnvelope<T> | T>): T => {
  const responseData = response.data;
  
  // Handle null/undefined response
  if (responseData === undefined || responseData === null) {
    throw new Error("mp3-api response missing data payload");
  }
  
  // Check if response has error field (envelope format)
  if (typeof responseData === 'object' && 'err' in responseData) {
    const envelope = responseData as ApiEnvelope<T>;
    
    // Check for error
    if (envelope.err && envelope.err !== 0) {
      throw new Error(envelope.message || `mp3-api responded with error code: ${envelope.err}`);
    }
    
    // If envelope has data field, return it
    if (envelope.data !== undefined && envelope.data !== null) {
      return envelope.data;
    }
    
    // If err is 0 but no data field, the data might be at root level
    // Return the response itself (excluding err/message fields)
    if (envelope.err === 0 || envelope.err === undefined) {
      const { err, message, ...rest } = envelope as any;
      if (Object.keys(rest).length > 0) {
        return rest as T;
      }
    }
    
    throw new Error("mp3-api response missing data payload");
  }
  
  // If no envelope format, assume data is at root level
  return responseData as T;
};

/**
 * Client for interacting with mp3-api endpoints.
 * 
 * Note: The reference repository (nvhung9/mp3-api) uses endpoints like:
 * - /api/search?q=<keyword>
 * - /api/song?id=<songId>
 * - /api/lyric?id=<songId>
 * 
 * This implementation uses simplified endpoints (/search, /streaming, etc.)
 * which may be provided by a wrapper API (e.g., api-zingmp3.vercel.app).
 * Verify the actual API structure matches your base URL.
 */
export class Mp3ApiClient {
  private http: AxiosInstance;

  constructor(baseURL: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  async searchSongs(keyword: string): Promise<SearchResult> {
    if (!keyword || keyword.trim().length === 0) {
      throw new Error("Search keyword cannot be empty");
    }
    const response = await this.http.get<ApiEnvelope<{ songs?: unknown[] }>>("/search", { params: { keyword: keyword.trim() } });
    const payload = unwrapResponse(response);
    const items = payload?.songs ?? [];
    const parsed = z.array(songSchema).safeParse(items);
    if (!parsed.success) {
      console.warn("Failed to parse search results:", parsed.error.format());
    }
    return { songs: parsed.success ? parsed.data : [] };
  }

  async fetchLyrics(id: string): Promise<LyricResult> {
    if (!id || id.trim().length === 0) {
      throw new Error("Song ID cannot be empty");
    }
    const response = await this.http.get<ApiEnvelope<unknown>>("/lyric", { params: { id: id.trim() } });
    const payload = unwrapResponse(response);
    const parsed = lyricSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(`Failed to parse lyrics for song ${id}:`, parsed.error.format());
    }
    return {
      songId: id.trim(),
      lyric: parsed.success ? parsed.data.lyric : undefined,
      sentences: parsed.success ? parsed.data.sentences : undefined,
    };
  }

  async fetchStreaming(id: string): Promise<StreamingResult> {
    if (!id || id.trim().length === 0) {
      throw new Error("Song ID cannot be empty");
    }
    const response = await this.http.get<ApiEnvelope<unknown>>("/streaming", { params: { id: id.trim() } });
    const payload = unwrapResponse(response);
    const parsed = streamingSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(`Failed to parse streaming sources for song ${id}:`, parsed.error.format());
    }
    return {
      songId: id.trim(),
      sources: parsed.success ? parsed.data : {},
    };
  }

  async fetchArtist(name: string): Promise<ArtistResult | null> {
    if (!name || name.trim().length === 0) {
      throw new Error("Artist name cannot be empty");
    }
    const response = await this.http.get<ApiEnvelope<unknown>>("/artist", { params: { name: name.trim() } });
    const payload = unwrapResponse(response);
    const parsed = artistSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(`Failed to parse artist data for ${name}:`, parsed.error.format());
    }
    return parsed.success ? parsed.data : null;
  }

  async fetchAlbum(id: string): Promise<AlbumResult | null> {
    if (!id || id.trim().length === 0) {
      throw new Error("Album ID cannot be empty");
    }
    const response = await this.http.get<ApiEnvelope<unknown>>("/album", { params: { id: id.trim() } });
    const payload = unwrapResponse(response);
    const parsed = albumSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn(`Failed to parse album data for ${id}:`, parsed.error.format());
    }
    return parsed.success ? parsed.data : null;
  }
}
