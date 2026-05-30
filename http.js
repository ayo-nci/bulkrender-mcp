#!/usr/bin/env node

/**
 * BulkRender MCP Server — StreamableHTTP transport
 *
 * Usage: node http.js
 *
 * Environment variables:
 *   BULKRENDER_API_URL  - API base URL (default: https://api.bulkrender.com)
 *   PORT                - Listen port (default: 3000)
 *
 * MCP URLs:
 *   Authenticated:  /mcp/:token   — token from your BulkRender dashboard (Settings → MCP)
 *   Public ACP:     /mcp/acp      — no token required, ACP tools only
 *
 * Claude Desktop / Cursor config:
 *   { "mcpServers": { "bulkrender": { "url": "https://mcp.bulkrender.com/mcp/<your-mcp-token>" } } }
 *
 * Claude.ai:
 *   Settings → Integrations → Add MCP → paste https://mcp.bulkrender.com/mcp/<your-mcp-token>
 */

const express = require("express");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { createMcpServer } = require("./server");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const safePath = req.path.replace(/\/mcp\/(?!acp)[^/]+/, "/mcp/[token]");
  process.stderr.write(`${req.method} ${safePath}\n`);
  next();
});

const apiBaseUrl =
  process.env.BULKRENDER_API_URL || "https://api.bulkrender.com";

process.stderr.write(`API base URL: ${apiBaseUrl}\n`);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bulkrender-mcp" });
});

// ── Public ACP endpoint (no token) — must be registered before /mcp/:token ───
app.all("/mcp/acp", async (req, res) => {
  try {
    const server = createMcpServer({ apiBaseUrl, apiKey: "acp-public" });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── Authenticated MCP endpoint — token in path ────────────────────────────────
app.all("/mcp/:token", async (req, res) => {
  try {
    const server = createMcpServer({
      apiBaseUrl,
      apiKey: req.params.token,
    });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  process.stderr.write(
    `bulkrender-mcp HTTP server listening on port ${PORT}\n`
  );
});
