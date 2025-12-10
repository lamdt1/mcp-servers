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

const unwrapResponse = <T>(response: AxiosResponse<ApiEnvelope<T>>): T => {
  const { data } = response;
  if (data?.err && data.err !== 0) {
    throw new Error(data.message || "mp3-api responded with an error");
  }
  if (data?.data === undefined || data?.data === null) {
    throw new Error("mp3-api response missing data payload");
  }
  return data.data;
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
    const response = await this.http.get<ApiEnvelope<{ songs?: unknown[] }>>("/search", { params: { keyword } });
    const payload = unwrapResponse(response);
    const items = payload?.songs ?? [];
    const parsed = z.array(songSchema).safeParse(items);
    return { songs: parsed.success ? parsed.data : [] };
  }

  async fetchLyrics(id: string): Promise<LyricResult> {
    const response = await this.http.get<ApiEnvelope<unknown>>("/lyric", { params: { id } });
    const payload = unwrapResponse(response);
    const parsed = lyricSchema.safeParse(payload);
    return {
      songId: id,
      lyric: parsed.success ? parsed.data.lyric : undefined,
      sentences: parsed.success ? parsed.data.sentences : undefined,
    };
  }

  async fetchStreaming(id: string): Promise<StreamingResult> {
    const response = await this.http.get<ApiEnvelope<unknown>>("/streaming", { params: { id } });
    const payload = unwrapResponse(response);
    const parsed = streamingSchema.safeParse(payload);
    return {
      songId: id,
      sources: parsed.success ? parsed.data : {},
    };
  }

  async fetchArtist(name: string): Promise<ArtistResult | null> {
    const response = await this.http.get<ApiEnvelope<unknown>>("/artist", { params: { name } });
    const payload = unwrapResponse(response);
    const parsed = artistSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }

  async fetchAlbum(id: string): Promise<AlbumResult | null> {
    const response = await this.http.get<ApiEnvelope<unknown>>("/album", { params: { id } });
    const payload = unwrapResponse(response);
    const parsed = albumSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }
}
