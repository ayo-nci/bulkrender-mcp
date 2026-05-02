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
 * @returns {McpServer}
 */
function createMcpServer(options = {}) {
  const apiBaseUrl =
    options.apiBaseUrl ||
    process.env.BULKRENDER_API_URL ||
    "https://api.bulkrender.com";

  const server = new McpServer({
    name: "bulkrender",
    version: "1.0.0",
  });

  server.tool(
    "list_templates",
    "List all available document templates with their variables. Returns template names, IDs, file types, and placeholder variables.",
    { apiKey: z.string().describe("BulkRender API key (br_live_...)") },
    async ({ apiKey }) => {
      try {
        const client = apiClient(apiBaseUrl, apiKey);
        const res = await client.get("/api/templates");
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  server.tool(
    "get_template",
    "Get a template's details including its variable schema. Use this to understand what data fields a template expects before generating documents.",
    {
      apiKey: z.string().describe("BulkRender API key (br_live_...)"),
      templateId: z.string().uuid().describe("Template UUID"),
    },
    async ({ apiKey, templateId }) => {
      try {
        const client = apiClient(apiBaseUrl, apiKey);
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

  server.tool(
    "generate_document",
    "Generate a single document from a template and data. Returns a signed download URL. Costs 1 credit (DOCX) or 2 credits (PDF).",
    {
      apiKey: z.string().describe("BulkRender API key (br_live_...)"),
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
    async ({ apiKey, templateId, data, outputFormat }) => {
      try {
        const client = apiClient(apiBaseUrl, apiKey);
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

  server.tool(
    "generate_batch",
    "Generate documents for multiple records in one call. Returns a ZIP download URL. Each record costs 1 credit (DOCX) or 2 credits (PDF).",
    {
      apiKey: z.string().describe("BulkRender API key (br_live_...)"),
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
    async ({ apiKey, templateId, records, outputFormat }) => {
      try {
        const client = apiClient(apiBaseUrl, apiKey);
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

  server.tool(
    "check_credits",
    "Check remaining credits for the organization. Shows subscription credits, purchased credit packs, and total available credits.",
    { apiKey: z.string().describe("BulkRender API key (br_live_...)") },
    async ({ apiKey }) => {
      try {
        const client = apiClient(apiBaseUrl, apiKey);
        const res = await client.get("/api/billing/credits");
        return formatResponse(res);
      } catch (err) {
        return formatError(err);
      }
    }
  );

  return server;
}

module.exports = { createMcpServer };
