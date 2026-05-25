# bulkrender-mcp

BulkRender MCP server. Generate DOCX and PDF documents from any AI assistant that supports the [Model Context Protocol](https://modelcontextprotocol.io) (Claude, Cursor, Windsurf, Cline, and more).

## Tools

### Authenticated tools (API key required)

| Tool                        | Description                                                            | Credits  |
| --------------------------- | ---------------------------------------------------------------------- | -------- |
| `list_templates`            | List all templates with their variables                                | 0        |
| `get_template`              | Get template details and variable schema                               | 0        |
| `generate_document`         | Generate a single document (DOCX or PDF)                               | 1–2      |
| `generate_batch`            | Generate documents for multiple records (up to 500)                    | 1–2 each |
| `check_credits`             | Check remaining credits                                                | 0        |
| `refresh_document_url`      | Get a fresh signed download URL for an existing document               | 0        |
| `create_template_from_docx` | Create a reusable template by providing a URL to an existing DOCX file | 0        |

Credit costs: DOCX = 1 credit, PDF = 2 credits.

### Walk-in tools (no account required)

For agents that have no BulkRender account. Pay per session via Stripe — no signup needed.

| Tool                        | Description                                                                     | Cost      |
| --------------------------- | ------------------------------------------------------------------------------- | --------- |
| `acp_list_public_templates` | List 5 built-in templates (invoice, quote, contract, report, proposal) + fields | Free      |
| `acp_create_session`        | Create a checkout session — specify template, data, quantity, output format     | —         |
| `acp_pay_session`           | Charge a Stripe payment method (`pm_xxx`), trigger async document generation    | Min $1.00 |
| `acp_get_session`           | Poll session status; returns signed `download_url` per doc when completed       | Free      |

Minimum charge: **$1.00** (covers up to 10 DOCX docs). Unused credit is yours — sign up to keep it.

## Prerequisites

1. A BulkRender account at [bulkrender.com](https://bulkrender.com)
2. An API key (`br_live_...`). Generate one from **Settings, Platform API Keys** (shown once, copy immediately)
3. Node.js 18+ (only required for stdio installation)

## Installation

### Remote HTTP endpoint (no install required)

Connect directly from Claude.ai, Claude Desktop, or any MCP client that supports HTTP:

**URL format:** `https://mcp.bulkrender.com/mcp/<your-mcp-token>`

Get your MCP token from **Settings → MCP Tokens** in your BulkRender dashboard.

**Claude.ai:**
Settings → Integrations → Add custom integration → paste the URL above.

**Claude Desktop / Cursor / Windsurf:**

```json
{
  "mcpServers": {
    "bulkrender": {
      "url": "https://mcp.bulkrender.com/mcp/<your-mcp-token>"
    }
  }
}
```

**Public ACP endpoint (no token):**
`https://mcp.bulkrender.com/mcp/acp` — walk-in tools only, no account required.

---

### Claude Code (CLI, recommended)

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

| Variable             | Required | Description                                                    |
| -------------------- | -------- | -------------------------------------------------------------- |
| `BULKRENDER_API_KEY` | Yes      | Your API key (`br_live_...`) from Settings → Platform API Keys |
| `BULKRENDER_API_URL` | No       | Override API base URL (default: `https://api.bulkrender.com`)  |

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

## Troubleshooting

| Problem                | Solution                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Invalid API key`      | Check key format: `br_live_...`. Regenerate from Settings, Platform API Keys if lost.                         |
| `Template not found`   | Use `list_templates` to get the UUID, or pass the slug directly (e.g. `"sample-invoice"`). Both are accepted. |
| Timeout on large batch | Batches over 10 records process asynchronously. Wait for the job to complete.                                 |
| Server not connecting  | Run `claude mcp list` to check status. Re-run `claude mcp add` command if missing.                            |

## Rate Limits

All limits are enforced by the BulkRender API, not the MCP server itself.

| Endpoint type                                                      | Limit                                 |
| ------------------------------------------------------------------ | ------------------------------------- |
| Document generation (`generate_document`, `generate_batch`)        | 30 requests / minute per organization |
| Template reads (`list_templates`, `get_template`, `check_credits`) | 30 requests / minute per organization |

When the limit is hit, the API returns HTTP `429`. The MCP server surfaces this as a tool error. The AI assistant will see this and can retry after a short pause.

**Batch jobs:** `generate_batch` counts as **one** API request regardless of record count (up to 500 records).

## Security

- API key is passed via environment variable, not stored by the MCP server
- All production communication uses HTTPS
- Signed download URLs expire after 1 hour. The underlying file remains available for your plan's retention period. Call the API again to get a fresh URL.

## ACP (Agent Control Plane) — Walk-in Flow

No account required. Pay per session via Stripe.

**Session lifecycle:** `not_ready_for_payment` → `in_progress` → `completed`

**Template types:**

- `B` — use a public template by ID (get IDs from `acp_list_public_templates` / `GET /api/templates/public`)
- `C` — supply your own DOCX as base64

### Via MCP tools (recommended)

```
1. acp_list_public_templates          → pick a template_id + note required fields
2. acp_create_session                 → returns session_id and amount_due
3. acp_pay_session (pm_xxx, email)    → triggers async generation
4. acp_get_session (poll)             → status: completed → documents[].download_url
```

### Via REST API

**GET /api/templates/public** — no auth needed

```bash
curl https://api.bulkrender.com/api/templates/public
```

**POST /api/acp/checkout/sessions**

```bash
curl -X POST https://api.bulkrender.com/api/acp/checkout/sessions \
  -H "Authorization: Bearer any-string" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "B",
    "template_id": "uuid-from-public-list",
    "data": {"company_name": "Acme", "client_name": "Bob", "invoice_date": "2026-05-17", "currency": "USD"},
    "agent_email": "agent@example.com",
    "output_format": "docx",
    "quantity": 3
  }'
```

Response:

```json
{
  "status": "success",
  "data": {
    "session_id": "uuid",
    "status": "not_ready_for_payment",
    "quantity": 3,
    "credit_cost_per_doc": 1,
    "amount_due": "1.00",
    "currency": "usd",
    "expires_at": "2026-05-18T..."
  }
}
```

**POST /api/acp/checkout/sessions/:id/pay**

```bash
curl -X POST https://api.bulkrender.com/api/acp/checkout/sessions/SESSION_ID/pay \
  -H "Authorization: Bearer any-string" \
  -H "Content-Type: application/json" \
  -d '{
    "stripe_vault_token": "pm_card_visa",
    "email": "customer@example.com"
  }'
```

**GET /api/acp/checkout/sessions/:id** — poll until `status: "completed"`

Response (completed):

```json
{
  "status": "success",
  "data": {
    "session_id": "...",
    "status": "completed",
    "documents": [
      {
        "document_id": "...",
        "name": "Invoice_abc_1.docx",
        "file_type": "docx",
        "download_url": "https://..."
      },
      {
        "document_id": "...",
        "name": "Invoice_abc_2.docx",
        "file_type": "docx",
        "download_url": "https://..."
      }
    ],
    "signup_cta": {
      "text": "Create an account to keep your unused credit and save templates for reuse",
      "url": "https://app.bulkrender.com/signup?email=...&utm_source=acp"
    }
  }
}
```

## Links

- [BulkRender](https://bulkrender.com)
- [API Documentation](https://bulkrender.com/docs/api)
- [GitHub](https://github.com/ayo-nci/bulkrender-mcp)
