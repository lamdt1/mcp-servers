import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Mp3ApiClient, StreamingResult } from "./mp3ApiClient.js";
import { z } from "zod";

// Initialize client lazily to avoid issues during module load
let client: Mp3ApiClient | null = null;

function getClient(): Mp3ApiClient {
  if (!client) {
    try {
      client = new Mp3ApiClient();
    } catch (error) {
      throw new Error(`Failed to initialize Mp3ApiClient: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return client;
}

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

// Register tools using registerTool() method (SDK 1.17.4 API)
server.registerTool(
  "search_songs",
  {
    description: "Search for songs by keyword using the mp3-api repository",
    inputSchema: {
      keyword: z.string().describe("Text to search for"),
    },
  },
  async (args) => {
    const { keyword } = args;
    return handleErrors(() => getClient().searchSongs(keyword));
  }
);

server.registerTool(
  "get_song_lyrics",
  {
    description: "Retrieve song lyrics by encodeId",
    inputSchema: {
      id: z.string().describe("Song encodeId"),
    },
  },
  async (args) => {
    const { id } = args;
    return handleErrors(() => getClient().fetchLyrics(id));
  }
);

server.registerTool(
  "get_song_streams",
  {
    description: "Fetch playable stream URLs for a song encodeId",
    inputSchema: {
      id: z.string().describe("Song encodeId"),
    },
  },
  async (args) => {
    const { id } = args;
    return handleErrors(() => getClient().fetchStreaming(id));
  }
);

server.registerTool(
  "find_artist",
  {
    description: "Look up artist details by alias or name",
    inputSchema: {
      name: z.string().describe("Artist alias (e.g. sontungmtp)"),
    },
  },
  async (args) => {
    const { name } = args;
    return handleErrors(() => getClient().fetchArtist(name));
  }
);

server.registerTool(
  "get_album",
  {
    description: "Fetch album details by encodeId",
    inputSchema: {
      id: z.string().describe("Album encodeId"),
    },
  },
  async (args) => {
    const { id } = args;
    return handleErrors(() => getClient().fetchAlbum(id));
  }
);

server.registerTool(
  "play_song",
  {
    description: "Resolve the best available streaming URL for a song encodeId",
    inputSchema: {
      id: z.string().describe("Song encodeId"),
    },
  },
  async (args) => {
    const { id } = args;
    return handleErrors(async () => {
      const streams = await getClient().fetchStreaming(id);
      const best = pickBestStream(streams);
      return {
        songId: id,
        selected: best,
        sources: streams.sources,
      };
    });
  }
);

// Handle unhandled rejections to prevent crashes
process.on("unhandledRejection", (reason) => {
  // Log to stderr (not stdout) to avoid corrupting MCP protocol
  process.stderr.write(`Unhandled rejection: ${String(reason)}\n`);
});

// Start the server - match the mock version pattern exactly
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  // Log to stderr (not stdout) to avoid corrupting MCP protocol
  process.stderr.write(`Failed to connect server: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
