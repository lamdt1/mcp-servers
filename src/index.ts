import { Server } from "@modelcontextprotocol/server";
import { stdio } from "@modelcontextprotocol/server/stdio";
import { Mp3ApiClient, StreamingResult } from "./mp3ApiClient.js";

const DEFAULT_BASE_URL = process.env.MP3_API_BASE_URL || "https://api-zingmp3.vercel.app/api";

const client = new Mp3ApiClient(DEFAULT_BASE_URL);

const server = new Server(
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

server.tool(
  {
    name: "search_songs",
    description: "Search for songs by keyword using the mp3-api repository",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Text to search for" },
      },
      required: ["keyword"],
    },
  },
  ({ keyword }) => handleErrors(() => client.searchSongs(keyword))
);

server.tool(
  {
    name: "get_song_lyrics",
    description: "Retrieve song lyrics by encodeId",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Song encodeId" },
      },
      required: ["id"],
    },
  },
  ({ id }) => handleErrors(() => client.fetchLyrics(id))
);

server.tool(
  {
    name: "get_song_streams",
    description: "Fetch playable stream URLs for a song encodeId",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Song encodeId" },
      },
      required: ["id"],
    },
  },
  ({ id }) => handleErrors(() => client.fetchStreaming(id))
);

server.tool(
  {
    name: "find_artist",
    description: "Look up artist details by alias or name",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Artist alias (e.g. sontungmtp)" },
      },
      required: ["name"],
    },
  },
  ({ name }) => handleErrors(() => client.fetchArtist(name))
);

server.tool(
  {
    name: "get_album",
    description: "Fetch album details by encodeId",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Album encodeId" },
      },
      required: ["id"],
    },
  },
  ({ id }) => handleErrors(() => client.fetchAlbum(id))
);

server.tool(
  {
    name: "play_song",
    description: "Resolve the best available streaming URL for a song encodeId",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Song encodeId" },
      },
      required: ["id"],
    },
  },
  async ({ id }) =>
    handleErrors(async () => {
      const streams = await client.fetchStreaming(id);
      const best = pickBestStream(streams);
      return {
        songId: id,
        selected: best,
        sources: streams.sources,
      };
    })
);

stdio(server);
