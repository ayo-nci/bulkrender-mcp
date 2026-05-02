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

## Prerequisites

1. A BulkRender account at [app.bulkrender.com](https://app.bulkrender.com)
2. An API key (`br_live_...`) — generate one from **Settings → API Keys**
3. Node.js 18+

## Installation

### Claude Desktop / Claude Code

Add to your Claude MCP config (`~/.claude.json` or Claude Desktop settings):

```json
{
  "mcpServers": {
    "bulkrender": {
      "command": "npx",
      "args": ["-y", "bulkrender-mcp"],
      "env": {
        "BULKRENDER_API_URL": "https://api.bulkrender.com"
      }
    }
  }
}
```

### Cursor / Windsurf / Cline

Use the same `npx -y bulkrender-mcp` command pattern in your MCP client settings.

## Configuration

| Variable             | Default                      | Description             |
| -------------------- | ---------------------------- | ----------------------- |
| `BULKRENDER_API_URL` | `https://api.bulkrender.com` | BulkRender API base URL |

Set `BULKRENDER_API_URL=http://localhost:3000` for local development.

## Usage Examples

**List templates:**

> "List my BulkRender templates"

**Generate a document:**

> "Generate an invoice using the Invoice Template for Acme Corp, invoice #1234, dated 2025-01-15, amount $5,000"

**Batch generation:**

> "Generate invoices for these 3 clients: Acme Corp ($5,000), Beta Inc ($3,200), Gamma LLC ($7,800)"

**Check credits:**

> "How many BulkRender credits do I have left?"

## Security

- API key is passed per-tool-call, never stored by the MCP server
- All production communication uses HTTPS
- Download URLs are signed and expire after 1 hour

## Links

- [BulkRender](https://bulkrender.com)
- [Documentation](https://bulkrender.com/guide)
- [GitHub](https://github.com/ayo-nci/bulkrender-mcp)
