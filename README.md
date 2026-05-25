# bulkrender-mcp

[![ayo-nci/bulkrender-mcp MCP server](https://glama.ai/mcp/servers/ayo-nci/bulkrender-mcp/badges/score.svg)](https://glama.ai/mcp/servers/ayo-nci/bulkrender-mcp)

BulkRender MCP server. Generate DOCX and PDF documents from Claude, Cursor, Windsurf, Cline, and any other MCP-compatible AI assistant.

## Quickstart

1. Sign up at [bulkrender.com](https://bulkrender.com)
2. Go to **Settings, Integrations, AI Assistants (MCP)**
3. Click **Generate MCP URL** — copy it immediately, shown once
4. Paste into your AI assistant (see below)

---

## Connect your AI assistant

### Claude.ai

Settings, Integrations, Add custom integration, paste your MCP URL.

### Claude Desktop / Cursor / Windsurf / Cline

Add to your MCP config file:

```json
{
  "mcpServers": {
    "bulkrender": {
      "url": "YOUR_MCP_URL"
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add bulkrender --scope user -- npx mcp-remote YOUR_MCP_URL
```

Verify:

```bash
claude mcp list
# bulkrender   ✓ Connected
```

---

## Tools

### Authenticated tools (requires MCP URL)

| Tool                        | Description                                         | Credits  |
| --------------------------- | --------------------------------------------------- | -------- |
| `list_templates`            | List all templates                                  | 0        |
| `get_template`              | Get template details and variable schema            | 0        |
| `search_templates`          | Search templates by name or tag                     | 0        |
| `generate_document`         | Generate a single document (DOCX or PDF)            | 1–2      |
| `generate_batch`            | Generate documents for multiple records (up to 500) | 1–2 each |
| `get_batch_status`          | Poll batch job status and get download URLs         | 0        |
| `check_credits`             | Check remaining credits                             | 0        |
| `refresh_document_url`      | Get a fresh signed URL for an existing document     | 0        |
| `estimate_cost`             | Estimate credit cost before generating              | 0        |
| `create_template_from_docx` | Create a reusable template from a DOCX URL          | 0        |
| `submit_feedback`           | Submit feedback or a bug report                     | 0        |

Credit costs: DOCX = 1 credit, PDF = 2 credits.

### Walk-in tools (no account required)

For agents acting on behalf of end users who have no BulkRender account. Pay per session via Stripe.

| Tool                        | Description                                                          | Cost      |
| --------------------------- | -------------------------------------------------------------------- | --------- |
| `acp_list_public_templates` | List built-in templates (invoice, quote, contract, report, proposal) | Free      |
| `acp_create_session`        | Create a checkout session and get a Stripe payment URL               | —         |
| `acp_pay_session`           | Charge a Stripe payment method directly (developer path)             | Min $1.00 |
| `acp_get_session`           | Poll session status, get download URLs when complete                 | Free      |

Walk-in minimum charge: **$1.00** (covers up to 10 DOCX or 5 PDF docs).

Public MCP URL (no account, walk-in tools only): `https://mcp.bulkrender.com/mcp/acp`

---

## Usage examples

**List templates:**

> "List my BulkRender templates"

**Generate a document:**

> "Generate an invoice using the Invoice Template for Acme Corp, invoice #1234, dated 2025-01-15, amount $5,000"

**Batch generation:**

> "Generate invoices for these 3 clients: Acme Corp ($5,000), Beta Inc ($3,200), Gamma LLC ($7,800)"

---

## Troubleshooting

| Problem                 | Solution                                                        |
| ----------------------- | --------------------------------------------------------------- |
| Server not connecting   | Regenerate your MCP URL from Settings, Integrations             |
| `Template not found`    | Use `list_templates` to get the correct UUID                    |
| Timeout on large batch  | Batches over 10 records process async — poll `get_batch_status` |
| `429 Too Many Requests` | Rate limit hit — retry after a short pause                      |

---

## Rate limits

| Endpoint                | Limit                                 |
| ----------------------- | ------------------------------------- |
| Document generation     | 30 requests / minute per organisation |
| Template reads, credits | 30 requests / minute per organisation |

`generate_batch` counts as one request regardless of record count.

---

## Links

- [BulkRender](https://bulkrender.com)
- [API Documentation](https://bulkrender.com/docs/api)
- [GitHub](https://github.com/ayo-nci/bulkrender-mcp)

---

## Migrating from the npm package

The standalone npm package (`npx bulkrender-mcp` with `BULKRENDER_API_KEY`) is no longer supported. Use the hosted MCP URL instead — no install, no env vars, just paste the URL from your dashboard.

If you have the old config:

```json
{
  "mcpServers": {
    "bulkrender": {
      "command": "npx",
      "args": ["-y", "bulkrender-mcp"],
      "env": { "BULKRENDER_API_KEY": "br_live_..." }
    }
  }
}
```

Replace it with:

```json
{
  "mcpServers": {
    "bulkrender": {
      "url": "YOUR_MCP_URL"
    }
  }
}
```

Get your MCP URL from **Settings, Integrations, AI Assistants (MCP)** in your BulkRender dashboard.
