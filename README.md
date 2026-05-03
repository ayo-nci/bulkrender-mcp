# bulkrender-mcp

BulkRender MCP server — generate DOCX and PDF documents from any AI assistant that supports the [Model Context Protocol](https://modelcontextprotocol.io) (Claude, Cursor, Windsurf, Cline, and more).

## Tools

| Tool                | Description                                         | Credits  |
| ------------------- | --------------------------------------------------- | -------- |
| `list_templates`    | List all templates with their variables             | 0        |
| `get_template`      | Get template details and variable schema            | 0        |
| `generate_document` | Generate a single document (DOCX or PDF)            | 1–2      |
| `generate_batch`    | Generate documents for multiple records (up to 500) | 1–2 each |
| `check_credits`     | Check remaining credits                             | 0        |

Credit costs: DOCX = 1 credit, PDF = 2 credits.

## Prerequisites

1. A BulkRender account at [app.bulkrender.com](https://app.bulkrender.com)
2. An API key (`br_live_...`) — generate one from **Settings → Platform API Keys** (shown once — copy immediately)
3. Node.js 18+

## Installation

### Claude Code (CLI — recommended)

Run once in your terminal:

```bash
claude mcp add bulkrender --scope user --env BULKRENDER_API_KEY=br_live_YOUR_KEY_HERE -- npx bulkrender-mcp
```

Verify:

```bash
claude mcp list
# bulkrender   ✓ Connected
```

### Claude Desktop (Windows)

Edit `C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bulkrender": {
      "command": "npx",
      "args": ["-y", "bulkrender-mcp"],
      "env": {
        "BULKRENDER_API_KEY": "br_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

Restart Claude Desktop.

### Claude Code (manual JSON)

Edit `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "bulkrender": {
      "command": "npx",
      "args": ["-y", "bulkrender-mcp"],
      "env": {
        "BULKRENDER_API_KEY": "br_live_YOUR_KEY_HERE"
      }
    }
  }
}
```

### Cursor / Windsurf / Cline

Use the same `mcpServers` block above in your app's MCP config file. Location varies by app.

## Configuration

| Variable             | Required | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `BULKRENDER_API_KEY` | Yes      | Your API key (`br_live_<prefix>_<secret>`)       |
| `BULKRENDER_API_URL` | No       | Override API base URL (default: `https://api.bulkrender.com`) |

Set `BULKRENDER_API_URL=http://localhost:3000` for local development.

## Usage Examples

**List templates:**

> "List my BulkRender templates"

**Generate a document:**

> "Generate an invoice using the Invoice Template for Acme Corp, invoice #1234, dated 2025-01-15, amount $5,000"

The assistant calls `list_templates` to find the template UUID, then `generate_document` with the mapped data, and returns a signed download URL (valid 1 hour).

**Batch generation:**

> "Generate invoices for these 3 clients: Acme Corp ($5,000), Beta Inc ($3,200), Gamma LLC ($7,800)"

Returns a signed ZIP download URL.

**Check credits:**

> "How many BulkRender credits do I have left?"

## Rate Limits

All limits are enforced by the BulkRender API, not the MCP server itself.

| Endpoint type                                                      | Limit                                 |
| ------------------------------------------------------------------ | ------------------------------------- |
| Document generation (`generate_document`, `generate_batch`)        | 30 requests / minute per organization |
| Template reads (`list_templates`, `get_template`, `check_credits`) | 30 requests / minute per organization |

When the limit is hit, the API returns HTTP `429`. The MCP server surfaces this as a tool error — the AI assistant will see this and can retry after a short pause.

**Batch jobs:** `generate_batch` counts as **one** API request regardless of record count (up to 500 records).

## Troubleshooting

| Problem               | Solution                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `Invalid API key`     | Check key format: `br_live_<prefix>_<secret>`. Regenerate from Settings → Platform API Keys if lost. |
| `Template not found`  | Use `list_templates` to get the UUID, or pass the slug directly (e.g. `"sample-invoice"`) — both are accepted |
| Timeout on large batch | Batches over 10 records process asynchronously. Wait for the job to complete.                        |
| Server not connecting | Run `claude mcp list` to check status. Re-run `claude mcp add` command if missing.                   |

## Security

- API key is passed via environment variable — not stored by the MCP server
- All production communication uses HTTPS
- Signed download URLs expire after 1 hour

## Links

- [BulkRender](https://bulkrender.com)
- [Documentation](https://bulkrender.com/guide)
- [GitHub](https://github.com/ayo-nci/bulkrender-mcp)
