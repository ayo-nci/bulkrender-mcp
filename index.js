#!/usr/bin/env node

/**
 * BulkRender MCP Server — entry point
 *
 * Usage in Claude Desktop / Claude Code:
 *   npx bulkrender-mcp
 *
 * Environment variables:
 *   BULKRENDER_API_URL - API base URL (default: https://api.bulkrender.com)
 */

const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { createMcpServer } = require("./server");

async function main() {
  const server = createMcpServer({
    apiBaseUrl: process.env.BULKRENDER_API_URL || "https://api.bulkrender.com",
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${err.message}\n`);
  process.exit(1);
});
