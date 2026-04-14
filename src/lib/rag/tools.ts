import type { ToolDefinition } from "@/lib/agent/types";

export const RAG_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "rag_search",
    description:
      "Search the user's knowledge base for relevant information. Returns ranked chunks from stored documents.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to find relevant content",
        },
        collections: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional list of collection slugs to search. If omitted, all collections are searched.",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of results to return (default: 5, max: 20)",
        },
      },
      required: ["query"],
    },
  },
};

export const RAG_STORE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "rag_store",
    description:
      "Store information in the user's knowledge base for future retrieval. Use this to save important facts, decisions, or context.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to store in the knowledge base",
        },
        collection: {
          type: "string",
          description: "The slug of the collection to store the content in",
        },
        title: {
          type: "string",
          description: "Optional title for the stored document",
        },
      },
      required: ["content", "collection"],
    },
  },
};
