/**
 * MCP Server with Mock API Client for offline testing
 * This version uses MockMp3ApiClient instead of the real API client
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamingResult } from "./mp3ApiClient.js";
import { MockMp3ApiClient } from "./mockMp3ApiClient.js";
import { z } from "zod";

const client = new MockMp3ApiClient();

const server = new McpServer(
  {
    name: "mp3-api-mcp-server-mock",
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

(server as any).registerTool(
  "search_songs",
  {
    description: "Search for songs by keyword using the mp3-api repository",
    inputSchema: z.object({
      keyword: z.string().describe("Text to search for"),
    }),
  },
  async (args: any) => {
    const { keyword } = args;
    return handleErrors(() => client.searchSongs(keyword));
  }
);

(server as any).registerTool(
  "get_song_lyrics",
  {
    description: "Retrieve song lyrics by encodeId",
    inputSchema: z.object({
      id: z.string().describe("Song encodeId"),
    }),
  },
  async (args: any) => {
    const { id } = args;
    return handleErrors(() => client.fetchLyrics(id));
  }
);

(server as any).registerTool(
  "get_song_streams",
  {
    description: "Fetch playable stream URLs for a song encodeId",
    inputSchema: z.object({
      id: z.string().describe("Song encodeId"),
    }),
  },
  async (args: any) => {
    const { id } = args;
    return handleErrors(() => client.fetchStreaming(id));
  }
);

(server as any).registerTool(
  "find_artist",
  {
    description: "Look up artist details by alias or name",
    inputSchema: z.object({
      name: z.string().describe("Artist alias (e.g. sontungmtp)"),
    }),
  },
  async (args: any) => {
    const { name } = args;
    return handleErrors(() => client.fetchArtist(name));
  }
);

(server as any).registerTool(
  "get_album",
  {
    description: "Fetch album details by encodeId",
    inputSchema: z.object({
      id: z.string().describe("Album encodeId"),
    }),
  },
  async (args: any) => {
    const { id } = args;
    return handleErrors(() => client.fetchAlbum(id));
  }
);

(server as any).registerTool(
  "play_song",
  {
    description: "Resolve the best available streaming URL for a song encodeId",
    inputSchema: z.object({
      id: z.string().describe("Song encodeId"),
    }),
  },
  async (args: any) => {
    const { id } = args;
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

