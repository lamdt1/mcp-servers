#!/usr/bin/env node
/**
 * Test client for MCP server - allows testing tools offline
 * 
 * Usage:
 *   npm run test:offline              # Test with mock data (no network)
 *   npm run test:online               # Test with real API
 *   npm run test:tool <tool-name>    # Test specific tool
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

interface TestCase {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

const testCases: TestCase[] = [
  {
    tool: "search_songs",
    args: { keyword: "sơn tùng" },
    description: "Search for songs",
  },
  {
    tool: "get_song_lyrics",
    args: { id: "Z6Z0F6D6" },
    description: "Get song lyrics",
  },
  {
    tool: "get_song_streams",
    args: { id: "Z6Z0F6D6" },
    description: "Get song streams",
  },
  {
    tool: "find_artist",
    args: { name: "sontungmtp" },
    description: "Find artist",
  },
  {
    tool: "get_album",
    args: { id: "6BZ8W6D6" },
    description: "Get album",
  },
  {
    tool: "play_song",
    args: { id: "Z6Z0F6D6" },
    description: "Play song",
  },
];

async function runTest(
  client: Client,
  testCase: TestCase,
  useMock: boolean = false
): Promise<void> {
  console.log(`\n🧪 Testing: ${testCase.description}`);
  console.log(`   Tool: ${testCase.tool}`);
  console.log(`   Args: ${JSON.stringify(testCase.args)}`);
  if (useMock) {
    console.log(`   Mode: OFFLINE (using mock data)`);
  }

  try {
    const result = await client.callTool({
      name: testCase.tool,
      arguments: testCase.args as Record<string, unknown>,
    });

    if (result.content && Array.isArray(result.content) && result.content.length > 0) {
      const content = result.content[0];
      if (content.type === "text") {
        try {
          const parsed = JSON.parse(content.text);
          console.log(`   ✅ Success:`);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(`   ✅ Success: ${content.text.substring(0, 200)}...`);
        }
      } else {
        console.log(`   ✅ Success:`, result.content);
      }
    } else {
      console.log(`   ⚠️  No content returned`);
    }

    if (result.isError) {
      console.log(`   ❌ Error: ${result.content?.[0]?.text || "Unknown error"}`);
    }
  } catch (error) {
    console.error(`   ❌ Failed:`, error instanceof Error ? error.message : error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const useMock = args.includes("--mock") || args.includes("--offline");
  const toolName = args.find((arg) => !arg.startsWith("--"));

  // Determine which server to use
  const isDev = process.env.NODE_ENV !== "production" || true; // Default to dev mode
  const serverCommand = isDev ? "tsx" : "node";
  const serverArgs = useMock
    ? [join(projectRoot, "src", "index-mock.ts")]
    : isDev
    ? [join(projectRoot, "src", "index.ts")]
    : [join(projectRoot, "dist", "index.js")];

  // Create transport that spawns the server process
  const transport = new StdioClientTransport({
    command: serverCommand,
    args: serverArgs,
    env: {
      ...process.env,
      ...(useMock ? { USE_MOCK_DATA: "true" } : {}),
    },
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);

    // List available tools
    const tools = await client.listTools();
    console.log("\n📋 Available tools:");
    tools.tools.forEach((tool) => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Run tests
    if (toolName) {
      const testCase = testCases.find((tc) => tc.tool === toolName);
      if (testCase) {
        await runTest(client, testCase, useMock);
      } else {
        console.error(`❌ Tool "${toolName}" not found`);
        console.log(`Available tools: ${testCases.map((tc) => tc.tool).join(", ")}`);
        process.exit(1);
      }
    } else {
      console.log(`\n🚀 Running all tests (${useMock ? "OFFLINE" : "ONLINE"} mode)...\n`);
      for (const testCase of testCases) {
        await runTest(client, testCase, useMock);
        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log("\n✅ Testing complete!");
  } catch (error) {
    console.error("❌ Test client error:", error);
    process.exit(1);
  } finally {
    await client.close();
    await transport.close();
  }
}

main().catch(console.error);

