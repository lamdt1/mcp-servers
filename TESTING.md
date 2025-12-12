# Testing Guide

This guide explains how to test the MCP server tools both offline (with mock data) and online (with real API).

## Quick Start

### Offline Testing (No Internet Required)

Test all tools with mock data:
```bash
npm run test:offline
```

Test a specific tool:
```bash
npm run test:tool search_songs --offline
```

### Online Testing (Requires Internet)

Test all tools with real API:
```bash
npm run test:online
```

Test a specific tool:
```bash
npm run test:tool search_songs
```

## How It Works

### Test Client Architecture

The test client (`src/test-client.ts`) uses the MCP SDK's `Client` class to:
1. Spawn the MCP server as a child process
2. Connect via `StdioClientTransport` (stdio communication)
3. List available tools
4. Call tools and display results

### Mock Data

When testing offline, the server uses `MockMp3ApiClient` (`src/mockMp3ApiClient.ts`) which:
- Returns sample data without network requests
- Simulates network delays (100ms)
- Provides realistic data structures matching the real API

### Test Cases

The test client includes pre-configured test cases for all tools:
- `search_songs` - searches with keyword "sơn tùng"
- `get_song_lyrics` - fetches lyrics for song ID "Z6Z0F6D6"
- `get_song_streams` - gets streams for song ID "Z6Z0F6D6"
- `find_artist` - finds artist "sontungmtp"
- `get_album` - gets album ID "6BZ8W6D6"
- `play_song` - plays song ID "Z6Z0F6D6"

## Customizing Tests

### Adding New Test Cases

Edit `src/test-client.ts` and add to the `testCases` array:

```typescript
{
  tool: "your_tool_name",
  args: { param1: "value1", param2: "value2" },
  description: "Description of what this test does",
}
```

### Modifying Mock Data

Edit `src/mockMp3ApiClient.ts` to change the mock responses. Each method returns sample data that matches the real API structure.

## Troubleshooting

### Server Won't Start

- Ensure dependencies are installed: `npm install`
- Check that TypeScript is compiled: `npm run build` (for production mode)
- Verify `tsx` is available for dev mode

### Connection Errors

- Make sure no other process is using the stdio streams
- Check that the server process is starting correctly
- Review stderr output for server errors

### Tool Not Found

- Verify the tool is registered in `src/index.ts` or `src/index-mock.ts`
- Check tool name spelling (case-sensitive)
- Ensure the server has finished initializing before calling tools

## Advanced Usage

### Testing with Custom Environment Variables

```bash
MP3_API_BASE_URL=http://localhost:3000/api npm run test:online
```

### Running Tests in Production Mode

```bash
NODE_ENV=production npm run test:offline
```

This will use the compiled JavaScript from `dist/` instead of TypeScript source.

## Integration with CI/CD

The offline test mode is perfect for CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Test MCP Server
  run: npm run test:offline
```

This ensures tests run quickly without external dependencies.

