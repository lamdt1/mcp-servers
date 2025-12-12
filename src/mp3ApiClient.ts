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

// ZingMp3 streaming can have different quality keys: "128", "320", "lossless", "m4a", etc.
const streamingSchema = z.union([
  z.record(z.string(), z.string()),
  z.object({
    128: z.string().optional(),
    320: z.string().optional(),
    lossless: z.string().optional(),
    m4a: z.string().optional(),
  }),
]);

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
  const { data } = response;
  
  // Handle null or undefined response
  if (data === undefined || data === null) {
    throw new Error("mp3-api response missing data payload");
  }
  
  // If response is already an array, return it directly
  if (Array.isArray(data)) {
    return data as T;
  }
  
  // Check if response has error field (wrapped response format)
  if (typeof data === 'object' && !Array.isArray(data) && 'err' in data) {
    const wrapped = data as ApiEnvelope<T>;
    
    // Check for error (err !== 0 means error)
    if (wrapped.err !== undefined && wrapped.err !== 0) {
      throw new Error(wrapped.message || `mp3-api error: ${wrapped.err}`);
    }
    
    // If data field exists and is not null/undefined, return it
    if ('data' in wrapped && wrapped.data !== undefined && wrapped.data !== null) {
      return wrapped.data;
    }
    
    // If err is 0 or undefined but no data field, check if the response itself is the data
    // (some APIs return { err: 0, ...actualData } without nesting in a data field)
    if (wrapped.err === 0 || wrapped.err === undefined) {
      const { err, message, ...rest } = wrapped as any;
      // If there are other fields besides err/message, treat them as the data
      if (Object.keys(rest).length > 0) {
        return rest as T;
      }
    }
    
    // No data found in wrapped response - include response in error for debugging
    const responsePreview = JSON.stringify(data).substring(0, 200);
    throw new Error(`mp3-api response missing data payload. Response: ${responsePreview}${JSON.stringify(data).length > 200 ? '...' : ''}`);
  }
  
  // Response is not wrapped (no err field), return directly
  // This handles APIs that return data directly without wrapping
  return data as T;
};

export class Mp3ApiClient {
  private http: AxiosInstance;

  constructor(baseURL: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  async searchSongs(keyword: string): Promise<SearchResult> {
    // Try multiple endpoint formats - note: baseURL might already include /api
    // Based on nvhung9/mp3-api, the endpoint should be /search with q parameter
    const endpoints = [
      { path: "/search", params: { q: keyword } },
      { path: "/search", params: { keyword } },
      { path: "/api/search", params: { q: keyword } },
      { path: "/api/v2/search/multi", params: { q: keyword } },
      // Try with different base URL structure
      { path: "", params: { q: keyword, action: "search" } },
    ];
    
    const errors: string[] = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.http.get<any>(endpoint.path, { params: endpoint.params });
        let payload = unwrapResponse(response);
        
        // Handle string response (API might return error or wrong format)
        if (typeof payload === 'string') {
          if (payload.includes('<!DOCTYPE') || payload.includes('<html') || payload === 'Home' || payload.trim() === '') {
            errors.push(`${endpoint.path}: Got invalid response: "${payload}"`);
            continue;
          }
          // Try to parse as JSON string
          try {
            payload = JSON.parse(payload);
          } catch {
            errors.push(`${endpoint.path}: Response is string but not JSON: ${payload.substring(0, 50)}`);
            continue;
          }
        }
        
        // ZingMp3 search response can have different structures:
        // 1. { data: { songs: [...] } }
        // 2. { songs: [...] }
        // 3. { data: { items: [...] } } (for search results)
        // 4. Array directly
        // 5. { data: { data: { songs: [...] } } } (nested)
        let songs: unknown[] = [];
        
        if (Array.isArray(payload)) {
          songs = payload;
        } else if ((payload as any)?.data) {
          const data = (payload as any).data;
          if (Array.isArray(data)) {
            songs = data;
          } else if (data?.songs && Array.isArray(data.songs)) {
            songs = data.songs;
          } else if (data?.items && Array.isArray(data.items)) {
            songs = data.items;
          } else if (data?.data?.songs && Array.isArray(data.data.songs)) {
            songs = data.data.songs;
          } else if (data?.data && Array.isArray(data.data)) {
            songs = data.data;
          }
        } else if ((payload as any)?.songs && Array.isArray((payload as any).songs)) {
          songs = (payload as any).songs;
        } else if ((payload as any)?.items && Array.isArray((payload as any).items)) {
          songs = (payload as any).items;
        }
        
        // Try to parse songs
        if (songs.length > 0) {
          const parsed = z.array(songSchema).safeParse(songs);
          if (parsed.success && parsed.data.length > 0) {
            return { songs: parsed.data };
          } else {
            // If parsing failed, try to extract at least encodeId and title
            const extractedSongs = songs.map((song: any) => ({
              encodeId: song?.encodeId || song?.id || song?.songId || '',
              title: song?.title || song?.name || '',
              artistsNames: song?.artistsNames || song?.artists?.map((a: any) => a.name || a).join(', ') || '',
              thumbnail: song?.thumbnail || song?.thumb || song?.thumbnailM || '',
              duration: song?.duration || song?.duration || undefined,
            })).filter((s: any) => s.encodeId && s.title);
            
            if (extractedSongs.length > 0) {
              return { songs: extractedSongs };
            }
          }
        }
        
        errors.push(`${endpoint.path}: No songs found in response`);
      } catch (error: any) {
        const errorMsg = error?.response?.data 
          ? `Status ${error.response.status}: ${JSON.stringify(error.response.data).substring(0, 100)}`
          : error?.message || String(error);
        errors.push(`${endpoint.path}: ${errorMsg}`);
        continue;
      }
    }
    
    throw new Error(`Failed to search songs with keyword: ${keyword}. Errors: ${errors.join('; ')}`);
  }

  async fetchLyrics(id: string): Promise<LyricResult> {
    // ZingMp3 API uses /api/v2/lyric/get/lyric with 'id' parameter
    const endpoints = [
      { path: "/api/v2/lyric/get/lyric", params: { id } },
      { path: "/api/lyric", params: { id } },
      { path: "/lyric", params: { id } },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.http.get<any>(endpoint.path, { params: endpoint.params });
        const payload = unwrapResponse(response);
        
        // ZingMp3 lyric response: { data: { lyric: "...", sentences: [...] } } or { lyric: "...", sentences: [...] }
        let lyricData: any = payload;
        if ((payload as any)?.data) {
          lyricData = (payload as any).data;
        }
        
        const parsed = lyricSchema.safeParse(lyricData);
        if (parsed.success) {
          return {
            songId: id,
            lyric: parsed.data.lyric,
            sentences: parsed.data.sentences,
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return {
      songId: id,
      lyric: undefined,
      sentences: undefined,
    };
  }

  async fetchStreaming(id: string): Promise<StreamingResult> {
    // ZingMp3 API uses /api/v2/song/get/streaming with 'id' parameter
    const endpoints = [
      { path: "/api/v2/song/get/streaming", params: { id } },
      { path: "/api/streaming", params: { id } },
      { path: "/streaming", params: { id } },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.http.get<any>(endpoint.path, { params: endpoint.params });
        const payload = unwrapResponse(response);
        
        // ZingMp3 streaming response structure:
        // { data: { 128: "url", 320: "url", lossless: "url", ... } }
        // or { data: { streaming: { 128: "url", ... } } }
        // or { 128: "url", 320: "url", ... } (direct)
        let sources: Record<string, string> = {};
        
        if ((payload as any)?.data) {
          const data = (payload as any).data;
          if (data?.streaming && typeof data.streaming === 'object') {
            // Nested streaming object
            sources = data.streaming;
          } else if (typeof data === 'object' && !Array.isArray(data)) {
            // Data is the streaming object directly
            sources = data;
          }
        } else if (typeof payload === 'object' && !Array.isArray(payload)) {
          // Response is the streaming object directly (no data wrapper)
          sources = payload as Record<string, string>;
        }
        
        // Filter and normalize: extract URLs, handle both string keys and numeric keys
        const filteredSources: Record<string, string> = {};
        for (const [key, value] of Object.entries(sources)) {
          if (typeof value === 'string') {
            // Accept both http and https URLs
            if (value.startsWith('http://') || value.startsWith('https://')) {
              filteredSources[key] = value;
            }
          } else if (typeof value === 'object' && value !== null && (value as any)?.url) {
            // Some APIs wrap URL in object
            const url = (value as any).url;
            if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
              filteredSources[key] = url;
            }
          }
        }
        
        if (Object.keys(filteredSources).length > 0) {
          return {
            songId: id,
            sources: filteredSources,
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return {
      songId: id,
      sources: {},
    };
  }

  async fetchArtist(name: string): Promise<ArtistResult | null> {
    // ZingMp3 API uses /api/v2/page/get/artist with 'alias' parameter
    const endpoints = [
      { path: "/api/v2/page/get/artist", params: { alias: name } },
      { path: "/api/artist", params: { name } },
      { path: "/artist", params: { name } },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.http.get<any>(endpoint.path, { params: endpoint.params });
        const payload = unwrapResponse(response);
        
        // ZingMp3 artist response: { data: { name: "...", alias: "...", ... } } or { name: "...", alias: "...", ... }
        let artistData: any = payload;
        if ((payload as any)?.data) {
          artistData = (payload as any).data;
        }
        
        // Map ZingMp3 fields to our schema
        const mappedData = {
          name: artistData?.name || artistData?.alias || name,
          alias: artistData?.alias || artistData?.name || name,
          thumbnail: artistData?.thumbnail || artistData?.thumb || artistData?.thumbnailM,
          totalFollow: artistData?.totalFollow || artistData?.followers,
        };
        
        const parsed = artistSchema.safeParse(mappedData);
        if (parsed.success) {
          return parsed.data;
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }

  async fetchAlbum(id: string): Promise<AlbumResult | null> {
    // ZingMp3 API uses /api/v2/page/get/playlist with 'id' parameter for albums/playlists
    const endpoints = [
      { path: "/api/v2/page/get/playlist", params: { id } },
      { path: "/api/album", params: { id } },
      { path: "/album", params: { id } },
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.http.get<any>(endpoint.path, { params: endpoint.params });
        const payload = unwrapResponse(response);
        
        // ZingMp3 playlist/album response: { data: { encodeId: "...", title: "...", ... } } or { encodeId: "...", title: "...", ... }
        let albumData: any = payload;
        if ((payload as any)?.data) {
          albumData = (payload as any).data;
        }
        
        // Map ZingMp3 fields to our schema
        const mappedData = {
          encodeId: albumData?.encodeId || albumData?.id || id,
          title: albumData?.title || albumData?.name,
          artistsNames: albumData?.artistsNames || albumData?.artists?.map((a: any) => a.name).join(', '),
          thumbnail: albumData?.thumbnail || albumData?.thumb || albumData?.thumbnailM,
        };
        
        const parsed = albumSchema.safeParse(mappedData);
        if (parsed.success) {
          return parsed.data;
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  }
}
