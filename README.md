# MP3 API MCP Server

Model Context Protocol (MCP) server built with Node.js that wraps the [`nvhung9/mp3-api`](https://github.com/nvhung9/mp3-api) endpoints. It exposes tools so agents can search for songs, fetch lyrics, look up artists and albums, and retrieve playable stream URLs.

## Setup

```bash
npm install
npm run build
```

Use `npm run dev` to run directly with `tsx` during development, or `npm start` after building to run the compiled output.

## Configuration

- `MP3_API_BASE_URL` (optional): Override the base URL for the mp3-api service. By default it uses `https://api-zingmp3.vercel.app/api`, which mirrors the public API exposed by the reference repository.

## Use with MCP Server Hub

You can add this server to MCP Hub through the **Add Server** dialog shown in the screenshot.

- **Server Name**: Pick any label (e.g., `mp3-api`).
- **Server Type**: `STDIO`.
- **Command**: `npm`.
- **Arguments**: one of the following, depending on how you prefer to run it:
  - `run dev --` – runs the TypeScript source with `tsx` (recommended while developing).
  - `run start --` – runs the compiled output from `dist` (after `npm run build`).
- **Environment Variables**: set `MP3_API_BASE_URL` if you need to point at a different API base URL.

Make sure dependencies are installed with `npm install` first. If you choose `run start --`, build the server beforehand with `npm run build`.

## Testing

### Offline Testing (Mock Data)

Test the MCP server tools without making network requests using mock data:

```bash
# Test all tools with mock data (offline)
npm run test:offline

# Test a specific tool with mock data
npm run test:tool search_songs --offline
```

### Online Testing (Real API)

Test the MCP server tools with the real API:

```bash
# Test all tools with real API
npm run test:online

# Test a specific tool
npm run test:tool search_songs
```

The test client will:
1. Start the MCP server as a child process
2. Connect to it via stdio transport
3. List all available tools
4. Run test cases for each tool (or a specific tool if specified)
5. Display the results

**Note**: For offline testing, the server uses `MockMp3ApiClient` which returns sample data without network calls. This is useful for:
- Testing tool registration and schema validation
- Testing error handling
- Development without internet connection
- CI/CD pipelines

## Available Tools

- `search_songs` – search songs by keyword.
- `get_song_lyrics` – fetch lyrics by song `encodeId`.
- `get_song_streams` – retrieve streaming URLs for a song `encodeId`.
- `find_artist` – look up artist details by alias or name.
- `get_album` – fetch album details by `encodeId`.
- `play_song` – pick the best streaming URL for a song `encodeId` to hand off to a player.
