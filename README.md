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

## Available Tools

- `search_songs` – search songs by keyword.
- `get_song_lyrics` – fetch lyrics by song `encodeId`.
- `get_song_streams` – retrieve streaming URLs for a song `encodeId`.
- `find_artist` – look up artist details by alias or name.
- `get_album` – fetch album details by `encodeId`.
- `play_song` – pick the best streaming URL for a song `encodeId` to hand off to a player.
