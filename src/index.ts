import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Mp3ApiClient, StreamingResult } from "./mp3ApiClient.js";
import { z } from "zod";

const DEFAULT_BASE_URL = process.env.MP3_API_BASE_URL || "https://api-zingmp3.vercel.app/api";

const client = new Mp3ApiClient(DEFAULT_BASE_URL);

const server = new McpServer(
  {
    name: "mp3-api-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const respondWithJson = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(data, null, 2),
    },
  ],
});

const handleErrors = async <T>(fn: () => Promise<T>) => {
  try {
    const data = await fn();
    return respondWithJson(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return respondWithJson({ error: message });
  }
};

const pickBestStream = (streaming: StreamingResult): { quality: string; url: string } | null => {
  const preferred = ["lossless", "320", "m4a", "128"];
  for (const quality of preferred) {
    const url = streaming.sources[quality];
    if (url) {
      return { quality, url };
    }
  }
  const fallbackQuality = Object.keys(streaming.sources)[0];
  if (!fallbackQuality) return null;
  return { quality: fallbackQuality, url: streaming.sources[fallbackQuality] };
};

const searchSongsSchema = z.object({
  keyword: z.string().describe("Text to search for"),
});

const songIdSchema = z.object({
  id: z.string().describe("Song encodeId"),
});

const artistNameSchema = z.object({
  name: z.string().describe("Artist alias (e.g. sontungmtp)"),
});

const albumIdSchema = z.object({
  id: z.string().describe("Album encodeId"),
});

server.registerTool(
  "search_songs",
  {
    description: "Search for songs by keyword using the mp3-api repository",
    inputSchema: searchSongsSchema as any,
  },
  async (args: any) => {
    const { keyword } = searchSongsSchema.parse(args);
    return handleErrors(() => client.searchSongs(keyword));
  }
);

server.registerTool(
  "get_song_lyrics",
  {
    description: "Retrieve song lyrics by encodeId",
    inputSchema: songIdSchema as any,
  },
  async (args: any) => {
    const { id } = songIdSchema.parse(args);
    return handleErrors(() => client.fetchLyrics(id));
  }
);

server.registerTool(
  "get_song_streams",
  {
    description: "Fetch playable stream URLs for a song encodeId",
    inputSchema: songIdSchema as any,
  },
  async (args: any) => {
    const { id } = songIdSchema.parse(args);
    return handleErrors(() => client.fetchStreaming(id));
  }
);

server.registerTool(
  "find_artist",
  {
    description: "Look up artist details by alias or name",
    inputSchema: artistNameSchema as any,
  },
  async (args: any) => {
    const { name } = artistNameSchema.parse(args);
    return handleErrors(() => client.fetchArtist(name));
  }
);

server.registerTool(
  "get_album",
  {
    description: "Fetch album details by encodeId",
    inputSchema: albumIdSchema as any,
  },
  async (args: any) => {
    const { id } = albumIdSchema.parse(args);
    return handleErrors(() => client.fetchAlbum(id));
  }
);

server.registerTool(
  "play_song",
  {
    description: "Resolve the best available streaming URL for a song encodeId",
    inputSchema: songIdSchema as any,
  },
  async (args: any) => {
    const { id } = songIdSchema.parse(args);
    return handleErrors(async () => {
      const streams = await client.fetchStreaming(id);
      const best = pickBestStream(streams);
      return {
        songId: id,
        selected: best,
        sources: streams.sources,
      };
    });
  }
);

const transport = new StdioServerTransport();
server.connect(transport);
