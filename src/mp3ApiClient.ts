import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
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
  msg?: string;
  message?: string;
  data?: T;
}

export class Mp3ApiClient {
  private readonly VERSION = "1.6.34";
  private readonly URL = "https://zingmp3.vn";
  private readonly SECRET_KEY = "2aa2d1c561e809b267f3638c4a307aab";
  private readonly API_KEY = "88265e23d4284f25963e6eedac8fbfa3";
  private http: AxiosInstance;
  private cookie: string | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: this.URL,
      timeout: 30000,
    });
  }

  // Get current timestamp for each request (CTIME needs to be fresh)
  private getCTIME(): string {
    return String(Math.floor(Date.now() / 1000));
  }

  private getHash256(str: string): string {
    return crypto.createHash("sha256").update(str).digest("hex");
  }

  private getHmac512(str: string, key: string): string {
    const hmac = crypto.createHmac("sha512", key);
    return hmac.update(Buffer.from(str, "utf8")).digest("hex");
  }

  private hashParamNoId(path: string, ctime: string): string {
    return this.getHmac512(
      path + this.getHash256(`ctime=${ctime}version=${this.VERSION}`),
      this.SECRET_KEY
    );
  }

  private hashParam(path: string, id: string, ctime: string): string {
    return this.getHmac512(
      path + this.getHash256(`ctime=${ctime}id=${id}version=${this.VERSION}`),
      this.SECRET_KEY
    );
  }

  private hashParamHome(path: string, ctime: string): string {
    return this.getHmac512(
      path +
        this.getHash256(`count=30ctime=${ctime}page=1version=${this.VERSION}`),
      this.SECRET_KEY
    );
  }

  private hashListMV(path: string, id: string, type: string, page: number, count: number, ctime: string): string {
    return this.getHmac512(
      path +
        this.getHash256(
          `count=${count}ctime=${ctime}id=${id}page=${page}type=${type}version=${this.VERSION}`
        ),
      this.SECRET_KEY
    );
  }

  private async getCookie(): Promise<string> {
    if (this.cookie) {
      return this.cookie;
    }

    // Retry logic for getting cookie
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(this.URL, {
          timeout: 15000,
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });
        
        if (response.headers["set-cookie"] && response.headers["set-cookie"].length > 0) {
          // Try to find a valid cookie (prefer index 1 as in reference, but try others)
          let cookieHeader: string | null = null;
          
          // First try index 1 (as in reference code)
          if (response.headers["set-cookie"].length > 1) {
            cookieHeader = response.headers["set-cookie"][1];
          }
          
          // If not found or empty, try index 0
          if (!cookieHeader && response.headers["set-cookie"].length > 0) {
            cookieHeader = response.headers["set-cookie"][0];
          }
          
          // Try to find any cookie that looks valid
          if (!cookieHeader) {
            cookieHeader = response.headers["set-cookie"].find((c: string) => 
              c && c.length > 10 && (c.includes('=') || c.includes(';'))
            ) || null;
          }
          
          if (cookieHeader && cookieHeader.trim().length > 0) {
            // Use the full cookie string as in reference code
            this.cookie = cookieHeader.trim();
            return this.cookie;
          }
        }
        
        lastError = new Error("No valid cookie found in response headers");
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new Error(`Failed to get cookie after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  private async requestZingMp3(path: string, qs: Record<string, any>, ctime?: string): Promise<any> {
    try {
      const cookie = await this.getCookie();
      const requestCTIME = ctime || this.getCTIME(); // Use provided ctime or get fresh one
      
      const params = {
        ...qs,
        ctime: requestCTIME,
        version: this.VERSION,
        apiKey: this.API_KEY,
      };

      const response = await this.http.get(path, {
        headers: {
          Cookie: cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://zingmp3.vn/',
          'Origin': 'https://zingmp3.vn',
        },
        params,
        timeout: 30000,
      });

      const data = response.data;
      
      // Handle error responses from ZingMp3
      if (data && typeof data === 'object' && 'err' in data) {
        if (data.err !== 0) {
          // If cookie might be invalid, clear it and retry once
          if (data.err === -115 || data.err === -113 || (data.msg && data.msg.includes('lỗi'))) {
            this.cookie = null; // Clear cookie to force refresh
            // Retry once with fresh cookie and fresh ctime
            const freshCookie = await this.getCookie();
            const freshCTIME = this.getCTIME();
            const retryParams = {
              ...params,
              ctime: freshCTIME,
            };
            // Update sig with fresh ctime if it exists in qs
            if (qs.sig) {
              // Recalculate sig if needed - this is a simplified retry
            }
            const retryResponse = await this.http.get(path, {
              headers: {
                Cookie: freshCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://zingmp3.vn/',
                'Origin': 'https://zingmp3.vn',
              },
              params: retryParams,
              timeout: 30000,
            });
            const retryData = retryResponse.data;
            if (retryData && typeof retryData === 'object' && 'err' in retryData && retryData.err !== 0) {
              throw new Error(retryData.msg || retryData.message || `ZingMp3 API error: ${retryData.err}`);
            }
            return retryData;
          }
          throw new Error(data.msg || data.message || `ZingMp3 API error: ${data.err}`);
        }
      }

      return data;
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        throw new Error(`ZingMp3 API request failed: ${status} ${statusText} - ${JSON.stringify(errorData).substring(0, 200)}`);
      }
      if (error.message) {
        throw error;
      }
      throw new Error(`ZingMp3 API request failed: ${String(error)}`);
    }
  }

  async searchSongs(keyword: string): Promise<SearchResult> {
    try {
      const ctime = this.getCTIME();
      const response = await this.requestZingMp3("/api/v2/search/multi", {
        q: keyword,
        sig: this.hashParamNoId("/api/v2/search/multi", ctime),
      }, ctime);

      // ZingMp3 search response structure: { data: { songs: [...] } }
      let songs: unknown[] = [];
      
      if (response?.data) {
        const data = response.data;
        if (data?.songs && Array.isArray(data.songs)) {
          songs = data.songs;
        } else if (Array.isArray(data)) {
          songs = data;
        }
      } else if (Array.isArray(response)) {
        songs = response;
      }

      if (songs.length === 0) {
        return { songs: [] };
      }

      // Parse and map songs
      const parsedSongs = songs.map((song: any) => ({
        encodeId: song?.encodeId || song?.id || "",
        title: song?.title || song?.name || "",
        artistsNames: song?.artistsNames || song?.artists?.map((a: any) => a.name || a).join(", ") || "",
        thumbnail: song?.thumbnail || song?.thumb || song?.thumbnailM || "",
        duration: song?.duration || undefined,
      })).filter((s) => s.encodeId && s.title);

      return { songs: parsedSongs };
    } catch (error: any) {
      throw new Error(`Failed to search songs: ${error.message}`);
    }
  }

  async fetchLyrics(id: string): Promise<LyricResult> {
    try {
      const ctime = this.getCTIME();
      const response = await this.requestZingMp3("/api/v2/lyric/get/lyric", {
        id: id,
        sig: this.hashParam("/api/v2/lyric/get/lyric", id, ctime),
      }, ctime);

      // ZingMp3 lyric response: { data: { lyric: "...", sentences: [...] } }
      let lyricData: any = response?.data || response;

      const parsed = lyricSchema.safeParse(lyricData);
      if (parsed.success) {
        return {
          songId: id,
          lyric: parsed.data.lyric,
          sentences: parsed.data.sentences,
        };
      }

      return {
        songId: id,
        lyric: lyricData?.lyric,
        sentences: lyricData?.sentences,
      };
    } catch (error: any) {
      return {
        songId: id,
        lyric: undefined,
        sentences: undefined,
      };
    }
  }

  async fetchStreaming(id: string): Promise<StreamingResult> {
    try {
      const ctime = this.getCTIME();
      const response = await this.requestZingMp3("/api/v2/song/get/streaming", {
        id: id,
        sig: this.hashParam("/api/v2/song/get/streaming", id, ctime),
      }, ctime);

      // ZingMp3 streaming response: { data: { 128: "url", 320: "url", lossless: "url", ... } }
      let sources: Record<string, string> = {};
      
      const data = response?.data || response;
      
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Extract streaming URLs
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
            sources[key] = value;
          } else if (typeof value === 'object' && value !== null && (value as any)?.url) {
            const url = (value as any).url;
            if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
              sources[key] = url;
            }
          }
        }
      }

      return {
        songId: id,
        sources,
      };
    } catch (error: any) {
      return {
        songId: id,
        sources: {},
      };
    }
  }

  async fetchArtist(name: string): Promise<ArtistResult | null> {
    try {
      const ctime = this.getCTIME();
      const response = await this.requestZingMp3("/api/v2/page/get/artist", {
        alias: name,
        sig: this.hashParamNoId("/api/v2/page/get/artist", ctime),
      }, ctime);

      // ZingMp3 artist response: { data: { name: "...", alias: "...", ... } }
      let artistData: any = response?.data || response;

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

      return null;
    } catch (error: any) {
      return null;
    }
  }

  async fetchAlbum(id: string): Promise<AlbumResult | null> {
    try {
      const ctime = this.getCTIME();
      const response = await this.requestZingMp3("/api/v2/page/get/playlist", {
        id: id,
        sig: this.hashParam("/api/v2/page/get/playlist", id, ctime),
      }, ctime);

      // ZingMp3 playlist/album response: { data: { encodeId: "...", title: "...", ... } }
      let albumData: any = response?.data || response;

      const mappedData = {
        encodeId: albumData?.encodeId || albumData?.id || id,
        title: albumData?.title || albumData?.name,
        artistsNames: albumData?.artistsNames || albumData?.artists?.map((a: any) => a.name).join(", "),
        thumbnail: albumData?.thumbnail || albumData?.thumb || albumData?.thumbnailM,
      };

      const parsed = albumSchema.safeParse(mappedData);
      if (parsed.success) {
        return parsed.data;
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }
}
