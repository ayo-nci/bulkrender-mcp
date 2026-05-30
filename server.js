/**
 * BulkRender MCP Server
 * Exposes document generation tools for AI agents via Model Context Protocol.
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const axios = require("axios");

/**
 * Create an axios instance targeting the BulkRender REST API
 * @param {string} baseUrl
 * @param {string} apiKey
 * @returns {import('axios').AxiosInstance}
 */
function apiClient(baseUrl, apiKey) {
  return axios.create({
    baseURL: baseUrl,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    timeout: 120000,
    validateStatus: () => true,
  });
}

/**
 * @param {import('axios').AxiosResponse} res
 * @returns {object}
 */
function formatResponse(res) {
  if (res.status >= 200 && res.status < 300) {
    return {
      content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
    };
  }
  const message =
    res.data?.message || res.statusText || `HTTP ${res.status} error`;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { error: true, status: res.status, message },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

/**
 * @param {Error} err
 * @returns {object}
 */
function formatError(err) {
  const message =
    err.code === "ECONNREFUSED"
      ? "Could not connect to BulkRender API. Is the server running?"
      : err.message;
  return {
    content: [{ type: "text", text: JSON.stringify({ error: true, message }) }],
    isError: true,
  };
}

/**
 * Create and configure the BulkRender MCP server
 * @param {object} [options]
 * @param {string} [options.apiBaseUrl]
 * @param {string} [options.apiKey]
 * @returns {McpServer}
 */
function createMcpServer(options = {}) {
  const apiBaseUrl =
    options.apiBaseUrl ||
    process.env.BULKRENDER_API_URL ||
    "https://api.bulkrender.com";

  const apiKey = options.apiKey || process.env.BULKRENDER_API_KEY;
  if (!apiKey) throw new Error("BULKRENDER_API_KEY is required");

  const client = apiClient(apiBaseUrl, apiKey);

  const server = new McpServer({
    name: "bulkrender",
    version: "1.1.2",
  });

  // ── list_templates ──────────────────────────────────────────────────
  server.tool(
    "list_templates",
    "[Requires MCP URL] List your organisation's document templates. Returns template names, IDs, file types, and variable names. Errors: 401 = invalid or missing MCP URL; 403 = account suspended.",
    {},
    async () => {
      try {
        const res = await client.get("/api/templates");
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── get_template ────────────────────────────────────────────────────
  server.tool(
    "get_template",
    "[Requires MCP URL] Get a template's details and variable schema. Use before generate_document to know what fields to supply. Errors: 401 = invalid/missing MCP URL; 404 = templateId not found.",
    {
      templateId: z.string().uuid().describe("Template UUID"),
    },
    async ({ templateId }) => {
      try {
        const [templateRes, variablesRes] = await Promise.all([
          client.get(`/api/templates/${templateId}`),
          client.get(`/api/templates/${templateId}/variables`),
        ]);
        if (templateRes.status >= 400) return formatResponse(templateRes);
        if (variablesRes.status >= 400) return formatResponse(variablesRes);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  template: templateRes.data?.data,
                  variables: variablesRes.data?.data,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── generate_document ───────────────────────────────────────────────
  server.tool(
    "generate_document",
    "[Requires MCP URL] Generate one document from a template. Returns a signed download URL (24h). Cost: 1 credit (DOCX) or 2 credits (PDF). Errors: 401 = invalid/missing MCP URL; 402 = insufficient credits; 404 = template not found; 422 = missing required variables.",
    {
      templateId: z.string().uuid().describe("Template UUID"),
      data: z
        .record(z.string(), z.any())
        .describe(
          "Key-value data to fill into the template. Keys must match template variables."
        ),
      outputFormat: z
        .enum(["docx", "pdf"])
        .default("docx")
        .describe("Output format: docx (1 credit) or pdf (2 credits)"),
    },
    async ({ templateId, data, outputFormat }) => {
      try {
        const res = await client.post("/api/documents/generate", {
          templateId,
          data,
          outputFormat,
        });
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── generate_batch ──────────────────────────────────────────────────
  server.tool(
    "generate_batch",
    "[Requires MCP URL] Generate documents for multiple records in one call. Returns a ZIP download URL. Cost: 1 credit/doc (DOCX) or 2 credits/doc (PDF). Max 500 records. Errors: 401 = invalid/missing MCP URL; 402 = insufficient credits; 404 = template not found.",
    {
      templateId: z.string().uuid().describe("Template UUID"),
      records: z
        .array(z.record(z.string(), z.any()))
        .min(1)
        .max(500)
        .describe(
          "Array of data objects, one per document. Each object's keys must match template variables."
        ),
      outputFormat: z
        .enum(["docx", "pdf"])
        .default("docx")
        .describe(
          "Output format: docx (1 credit each) or pdf (2 credits each)"
        ),
    },
    async ({ templateId, records, outputFormat }) => {
      try {
        const res = await client.post("/api/documents/generate-batch", {
          templateId,
          records,
          outputFormat,
        });
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── refresh_document_url ────────────────────────────────────────────
  server.tool(
    "refresh_document_url",
    "[Requires MCP URL] Get a fresh signed download URL for a document whose link has expired. No credits consumed. Errors: 401 = invalid/missing MCP URL; 404 = document not found.",
    {
      documentId: z.string().uuid().describe("Document UUID"),
      expiresIn: z
        .number()
        .int()
        .min(1)
        .max(86400)
        .default(3600)
        .describe("URL validity in seconds (1–86400, default 3600)"),
    },
    async ({ documentId, expiresIn }) => {
      try {
        const res = await client.get(
          `/api/documents/${documentId}/refresh-url`,
          { params: { expiresIn } }
        );
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── check_credits ───────────────────────────────────────────────────
  server.tool(
    "check_credits",
    "[Requires MCP URL] Check remaining credits for the organisation (subscription + purchased packs + total). Errors: 401 = invalid/missing MCP URL.",
    {},
    async () => {
      try {
        const res = await client.get("/api/billing/credits");
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── create_template_from_docx ───────────────────────────────────────
  server.tool(
    "create_template_from_docx",
    "[Requires MCP URL] Create a template from a DOCX URL. Server fetches the file, extracts {{placeholder}} variables, and saves it. Returns templateId ready for generate_document. Errors: 401 = invalid/missing MCP URL; 400 = URL unreachable or not a valid DOCX.",
    {
      docxUrl: z
        .string()
        .url()
        .describe(
          "Public URL to a DOCX file containing {{placeholder}} variables (e.g. a file on Google Drive, Dropbox, or any direct download link)"
        ),
      templateName: z
        .string()
        .optional()
        .describe("Name for the saved template. Defaults to the filename."),
      agentEmail: z
        .string()
        .email()
        .optional()
        .describe("Agent email for tracking purposes."),
      customerName: z
        .string()
        .optional()
        .describe("Customer name for the generated organization."),
      organizationName: z
        .string()
        .optional()
        .describe("Organization name for the generated account."),
    },
    async ({
      docxUrl,
      templateName,
      agentEmail,
      customerName,
      organizationName,
    }) => {
      try {
        const client = apiClient(apiBaseUrl, "br_live_temp");
        const ts = Date.now();

        const registerRes = await client.post("/api/agent/customer/register", {
          agentEmail: agentEmail || "agent@bulkrender.dev",
          customerEmail: `customer_${ts}@agent.bulkrender.dev`,
          customerName: customerName || "Agent Customer",
          organizationName: organizationName || `Agent Org ${ts}`,
        });

        if (registerRes.status >= 400) return formatResponse(registerRes);

        const { customerId, customerToken } = registerRes.data.data;

        const docxResponse = await fetch(docxUrl);
        if (!docxResponse.ok) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: true,
                  message: `Failed to fetch DOCX from URL: ${docxResponse.status} ${docxResponse.statusText}`,
                }),
              },
            ],
            isError: true,
          };
        }

        const docxBuffer = Buffer.from(await docxResponse.arrayBuffer());
        const filename = templateName
          ? `${templateName.replace(/[^a-z0-9]/gi, "-")}.docx`
          : docxUrl.split("/").pop().split("?")[0] || "template.docx";

        const formData = new FormData();
        formData.append(
          "template",
          new Blob([docxBuffer], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          filename
        );

        const ingestRes = await fetch(
          `${apiBaseUrl}/api/agent/customer/${customerId}/template`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${customerToken}` },
            body: formData,
          }
        );

        const ingestData = await ingestRes.json();
        if (!ingestRes.ok) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: true,
                  message: ingestData.message || "Template ingestion failed",
                }),
              },
            ],
            isError: true,
          };
        }

        const { sessionId, variables, loops } = ingestData.data;

        const saveRes = await client.post(
          `/api/agent/customer/${customerId}/template/${sessionId}/save`,
          {
            name: templateName || filename.replace(".docx", ""),
            description: `Ingested from ${docxUrl}`,
          },
          { headers: { Authorization: `Bearer ${customerToken}` } }
        );

        if (saveRes.status >= 400) return formatResponse(saveRes);

        const { templateId, apiKey } = saveRes.data.data;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  templateId,
                  templateName: templateName || filename.replace(".docx", ""),
                  variables,
                  loops,
                  message:
                    "Template created successfully. Template created. Use templateId with generate_document to produce documents — no separate API key needed, your MCP connection handles auth.",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── ACP tools (no API key required) ────────────────────────────────

  // ── acp_list_public_templates ───────────────────────────────────────
  server.tool(
    "acp_list_public_templates",
    "[No account needed] List BulkRender's built-in public templates (invoice, quote, contract, report, proposal). Returns template IDs and exact field names to pass when creating an ACP session.",
    {},
    async () => {
      try {
        const res = await axios.get(`${apiBaseUrl}/api/templates/public`, {
          timeout: 15000,
          validateStatus: () => true,
        });
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── acp_create_session ──────────────────────────────────────────────
  server.tool(
    "acp_create_session",
    "[No account needed] Create a pay-per-session document generation job. Pricing: $0.10/credit, DOCX = 1 credit, PDF = 2 credits, $1.00 minimum. Pass records[] (max 200). Returns session_id, amount_due, checkout_url (Stripe), and expires_at. Poll acp_get_session after payment. Errors: 400 = invalid template_id or missing required fields.",
    {
      bearerToken: z
        .string()
        .describe("Any non-empty string — acts as your session bearer token"),
      templateType: z
        .enum(["B", "C"])
        .describe(
          "'B' = use a public template by ID, 'C' = bring your own DOCX"
        ),
      templateId: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Required for template_type B — UUID from acp_list_public_templates"
        ),
      templateBuffer: z
        .string()
        .optional()
        .describe("Required for template_type C — base64-encoded DOCX content"),
      templateName: z
        .string()
        .optional()
        .describe("Required for template_type C — filename e.g. my-doc.docx"),
      records: z
        .array(z.record(z.string(), z.any()))
        .describe(
          "Array of data objects, one per document (max 200). Each object fills one document using the template variables. All documents use the same template and output_format. Keys must match the template field_schema variables — missing keys render as empty strings."
        ),
      agentEmail: z
        .string()
        .email()
        .describe("Email address to associate with this session"),
      outputFormat: z
        .enum(["docx", "pdf"])
        .default("docx")
        .describe(
          "Output format for ALL documents in this session — docx (1 credit/$0.10) or pdf (2 credits/$0.20). $1.00 minimum applies."
        ),
    },
    async ({
      bearerToken,
      templateType,
      templateId,
      templateBuffer,
      templateName,
      records,
      agentEmail,
      outputFormat,
    }) => {
      try {
        const body = {
          template_type: templateType,
          records,
          agent_email: agentEmail,
          output_format: outputFormat,
        };
        if (templateType === "B") body.template_id = templateId;
        if (templateType === "C")
          body.template = { buffer: templateBuffer, name: templateName };

        const res = await axios.post(
          `${apiBaseUrl}/api/acp/checkout/sessions`,
          body,
          {
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              "Content-Type": "application/json",
            },
            timeout: 15000,
            validateStatus: () => true,
          }
        );
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── acp_pay_session ─────────────────────────────────────────────────
  server.tool(
    "acp_pay_session",
    "[No account needed] Pay for an ACP session using a Stripe payment method ID (pm_xxx). Charges the amount_due from acp_create_session. Generation starts in background on success — poll acp_get_session until status is 'completed'. Errors: 402 = payment declined; 404 = session not found.",
    {
      bearerToken: z
        .string()
        .describe("Same bearer token used in acp_create_session"),
      sessionId: z
        .string()
        .uuid()
        .describe("session_id from acp_create_session"),
      stripePaymentMethodId: z
        .string()
        .describe(
          "Stripe payment method ID (pm_xxx) — obtain via Stripe.js or the Stripe API"
        ),
      email: z.string().email().describe("Email for the Stripe receipt"),
    },
    async ({ bearerToken, sessionId, stripePaymentMethodId, email }) => {
      try {
        const res = await axios.post(
          `${apiBaseUrl}/api/acp/checkout/sessions/${sessionId}/pay`,
          { stripe_vault_token: stripePaymentMethodId, email },
          {
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              "Content-Type": "application/json",
            },
            timeout: 30000,
            validateStatus: () => true,
          }
        );
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── acp_get_session ─────────────────────────────────────────────────
  server.tool(
    "acp_get_session",
    "[No account needed] Poll ACP session status after payment. Completed response includes: documents[] with download_url per doc (24h), zip_download_url (24h), credits summary. Always show signup_cta to user when status = 'completed' — lets them keep unused credit. Errors: 404 = session not found.",
    {
      bearerToken: z
        .string()
        .describe("Same bearer token used in acp_create_session"),
      sessionId: z
        .string()
        .uuid()
        .describe("session_id from acp_create_session"),
    },
    async ({ bearerToken, sessionId }) => {
      try {
        const res = await axios.get(
          `${apiBaseUrl}/api/acp/checkout/sessions/${sessionId}`,
          {
            headers: { Authorization: `Bearer ${bearerToken}` },
            timeout: 15000,
            validateStatus: () => true,
          }
        );
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── submit_feedback ─────────────────────────────────────────────────
  server.tool(
    "submit_feedback",
    "[No account needed] Send feedback, feature requests, or bug reports to BulkRender support. Use when something doesn't work or a user has a suggestion. Pass the end user's email — support replies there directly.",
    {
      message: z
        .string()
        .describe(
          "Feedback message — describe the feature request, issue, or suggestion in detail"
        ),
      email: z
        .string()
        .email()
        .describe(
          "End user's email address — support will reply here. Use the agent_email from the ACP session if available."
        ),
      type: z
        .enum(["feature_request", "bug", "general"])
        .default("general")
        .describe("Type of feedback"),
    },
    async ({ message, email, type }) => {
      try {
        const res = await axios.post(
          `${apiBaseUrl}/api/feedback`,
          { message, email, type, pageUrl: "mcp-agent" },
          {
            headers: { "Content-Type": "application/json" },
            timeout: 15000,
            validateStatus: () => true,
          }
        );
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── search_templates ────────────────────────────────────────────────
  server.tool(
    "search_templates",
    "[Requires MCP URL] Search your templates by name or description when you don't know the exact ID. Returns matches with IDs and variable counts. Errors: 401 = invalid/missing MCP URL.",
    {
      query: z
        .string()
        .describe("Search term — matches template name or description"),
    },
    async ({ query }) => {
      try {
        const res = await client.get("/api/templates", {
          params: { search: query },
        });
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── get_batch_status ─────────────────────────────────────────────────
  server.tool(
    "get_batch_status",
    "[Requires MCP URL] Poll a batch job until status is 'completed'. Returns progress and download URLs when done. Errors: 401 = invalid/missing MCP URL; 404 = jobId not found.",
    {
      jobId: z
        .string()
        .uuid()
        .describe("Batch job ID returned by generate_batch"),
    },
    async ({ jobId }) => {
      try {
        const res = await client.get(`/api/documents/batch-jobs/${jobId}`);
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  // ── estimate_cost ────────────────────────────────────────────────────
  server.tool(
    "estimate_cost",
    "[Requires MCP URL] Estimate credit cost before generating. Returns credits needed, current balance, and whether you can afford the job. Call before large batches. Errors: 401 = invalid/missing MCP URL.",
    {
      count: z
        .number()
        .int()
        .min(1)
        .describe("Number of documents to generate"),
      outputFormat: z
        .enum(["docx", "pdf"])
        .default("docx")
        .describe(
          "Output format — docx (1 credit each) or pdf (2 credits each)"
        ),
    },
    async ({ count, outputFormat }) => {
      try {
        const creditsPerDoc = outputFormat === "pdf" ? 2 : 1;
        const totalCredits = count * creditsPerDoc;

        const balanceRes = await client.get("/api/billing/credits");
        const balance =
          balanceRes.status < 300
            ? balanceRes.data?.data?.totalCredits ?? null
            : null;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count,
                  outputFormat,
                  creditsPerDoc,
                  totalCreditsRequired: totalCredits,
                  currentBalance: balance,
                  canAfford:
                    balance !== null ? balance >= totalCredits : "unknown",
                  creditsAfter:
                    balance !== null ? balance - totalCredits : "unknown",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return formatError(err);
      }
    }
  );

  return server;
}

module.exports = { createMcpServer };
