import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const chatTable = sqliteTable("chat_table", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  maxTokens: int("max_tokens").notNull(),
  systemMessage: text("system_message").notNull(),
  stickyFactsBaseKeys: text("sticky_facts_base_keys"),
  stickyFactsRules: text("sticky_facts_rules"),
  factsExtractionModel: text("facts_extraction_model"),
  factsExtractionRules: text("facts_extraction_rules"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const personalizationTable = sqliteTable("personalization", {
  id: int().primaryKey(),
  communicationStyle: text("communication_style").notNull().default("normal"),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const branchTable = sqliteTable("branch", {
  id: int().primaryKey({ autoIncrement: true }),
  chatId: int("chat_id")
    .notNull()
    .references(() => chatTable.id, { onDelete: "cascade" }),
  name: text().notNull(),
  parentBranchId: int("parent_branch_id"),
  forkedAtMsgId: int("forked_at_msg_id"),
  contextMode: text("context_mode").notNull().default("none"),
  model: text("model"),
  slidingWindowSize: int("sliding_window_size").notNull().default(20),
  stickyFactsEnabled: int("sticky_facts_enabled").notNull().default(0),
  stickyFactsEvery: int("sticky_facts_every").notNull().default(1),
  stickyFactsModel: text("sticky_facts_model"),
  summarizationTrigger: text("summarization_trigger").default("window"),
  summarizationModel: text("summarization_model"),
  summarizationEvery: int("summarization_every"),
  summarizationRatio: real("summarization_ratio"),
  summarizationKeep: int("summarization_keep"),
  workingMemoryMode: text("working_memory_mode").notNull().default("off"),
  workingMemoryModel: text("working_memory_model"),
  workingMemoryEvery: int("working_memory_every").notNull().default(1),
  communicationStyle: text("communication_style"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messageTable = sqliteTable("message_table", {
  id: int().primaryKey({ autoIncrement: true }),
  branchId: int("branch_id")
    .notNull()
    .references(() => branchTable.id, { onDelete: "cascade" }),
  role: text({ enum: ["user", "assistant"] }).notNull(),
  content: text().notNull(),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const messageUsageTable = sqliteTable("message_usage", {
  id: int().primaryKey({ autoIncrement: true }),
  messageId: int("message_id")
    .notNull()
    .unique()
    .references(() => messageTable.id, { onDelete: "cascade" }),
  inputTokens: int("input_tokens").notNull(),
  outputTokens: int("output_tokens").notNull(),
  totalTokens: int("total_tokens").notNull(),
  cost: real(),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const globalFactsTable = sqliteTable("global_facts", {
  id: int().primaryKey({ autoIncrement: true }),
  key: text().notNull().unique(),
  value: text().notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const branchWorkingMemoryTable = sqliteTable("branch_working_memory", {
  id: int().primaryKey({ autoIncrement: true }),
  branchId: int("branch_id")
    .notNull()
    .unique()
    .references(() => branchTable.id, { onDelete: "cascade" }),
  data: text().notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const branchContextStateTable = sqliteTable("branch_context_state", {
  id: int().primaryKey({ autoIncrement: true }),
  branchId: int("branch_id")
    .notNull()
    .unique()
    .references(() => branchTable.id, { onDelete: "cascade" }),
  facts: text().notNull(),
  context: text().notNull(),
  summarizedUpTo: int("summarized_up_to").notNull(),
  factsExtractedUpTo: int("facts_extracted_up_to").notNull().default(0),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const machineInstancesTable = sqliteTable("machine_instances", {
  id: int().primaryKey({ autoIncrement: true }),
  branchId: int("branch_id")
    .notNull()
    .references(() => branchTable.id, { onDelete: "cascade" }),
  definitionId: text("definition_id").notNull(),
  currentState: text("current_state").notNull(),
  status: text().notNull(), // "active" | "completed" | "stopped"
  data: text().notNull(), // JSON string
  history: text().notNull(), // JSON string
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const invariantTable = sqliteTable("invariant", {
  id: text().primaryKey(),
  name: text().notNull().unique(),
  description: text().notNull(),
  type: text().notNull(), // "regex" | "keyword"
  pattern: text().notNull(),
  caseSensitive: int("case_sensitive").notNull().default(0),
  severity: text().notNull(), // "block" | "warn"
  promptHint: text("prompt_hint").notNull(),
  enabled: int().notNull().default(1),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const mcpServerTable = sqliteTable("mcp_server", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  type: text().notNull(), // "stdio" | "http" | "sse"
  config: text().notNull(), // JSON
  enabled: int().notNull().default(1),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const branchMcpOverrideTable = sqliteTable(
  "branch_mcp_override",
  {
    id: int().primaryKey({ autoIncrement: true }),
    branchId: int("branch_id")
      .notNull()
      .references(() => branchTable.id, { onDelete: "cascade" }),
    mcpServerId: int("mcp_server_id")
      .notNull()
      .references(() => mcpServerTable.id, { onDelete: "cascade" }),
    enabled: int().notNull(),
  },
  (table) => [unique().on(table.branchId, table.mcpServerId)],
);

export const notificationBridgeTable = sqliteTable("notification_bridge", {
  id: int().primaryKey({ autoIncrement: true }),
  type: text().notNull(),
  name: text().notNull().unique(),
  enabled: int().notNull().default(1),
  llmModel: text("llm_model").notNull(),
  llmPrompt: text("llm_prompt").notNull(),
  config: text().notNull(), // JSON
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const notificationLogTable = sqliteTable("notification_log", {
  id: int().primaryKey({ autoIncrement: true }),
  bridgeId: int("bridge_id")
    .notNull()
    .references(() => notificationBridgeTable.id, { onDelete: "cascade" }),
  mcpServerId: int("mcp_server_id")
    .notNull()
    .references(() => mcpServerTable.id, { onDelete: "cascade" }),
  type: text().notNull(),
  rawPayload: text("raw_payload").notNull(), // JSON
  llmOutput: text("llm_output").notNull(),
  status: text().notNull(), // "sent" | "failed"
  error: text(),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const notificationBridgeRelations = relations(
  notificationBridgeTable,
  ({ many }) => ({
    logs: many(notificationLogTable),
  }),
);

export const notificationLogRelations = relations(
  notificationLogTable,
  ({ one }) => ({
    bridge: one(notificationBridgeTable, {
      fields: [notificationLogTable.bridgeId],
      references: [notificationBridgeTable.id],
    }),
    mcpServer: one(mcpServerTable, {
      fields: [notificationLogTable.mcpServerId],
      references: [mcpServerTable.id],
    }),
  }),
);

export const mcpServerRelations = relations(mcpServerTable, ({ many }) => ({
  branchOverrides: many(branchMcpOverrideTable),
  notificationLogs: many(notificationLogTable),
}));

export const branchMcpOverrideRelations = relations(
  branchMcpOverrideTable,
  ({ one }) => ({
    branch: one(branchTable, {
      fields: [branchMcpOverrideTable.branchId],
      references: [branchTable.id],
    }),
    mcpServer: one(mcpServerTable, {
      fields: [branchMcpOverrideTable.mcpServerId],
      references: [mcpServerTable.id],
    }),
  }),
);

export const chatRelations = relations(chatTable, ({ many }) => ({
  branches: many(branchTable),
}));

export const branchRelations = relations(branchTable, ({ one, many }) => ({
  chat: one(chatTable, {
    fields: [branchTable.chatId],
    references: [chatTable.id],
  }),
  parentBranch: one(branchTable, {
    fields: [branchTable.parentBranchId],
    references: [branchTable.id],
    relationName: "parentBranch",
  }),
  messages: many(messageTable),
  contextState: one(branchContextStateTable, {
    fields: [branchTable.id],
    references: [branchContextStateTable.branchId],
  }),
  workingMemory: one(branchWorkingMemoryTable, {
    fields: [branchTable.id],
    references: [branchWorkingMemoryTable.branchId],
  }),
  machineInstances: many(machineInstancesTable),
  mcpOverrides: many(branchMcpOverrideTable),
}));

export const branchWorkingMemoryRelations = relations(
  branchWorkingMemoryTable,
  ({ one }) => ({
    branch: one(branchTable, {
      fields: [branchWorkingMemoryTable.branchId],
      references: [branchTable.id],
    }),
  }),
);

export const branchContextStateRelations = relations(
  branchContextStateTable,
  ({ one }) => ({
    branch: one(branchTable, {
      fields: [branchContextStateTable.branchId],
      references: [branchTable.id],
    }),
  }),
);

export const machineInstancesRelations = relations(
  machineInstancesTable,
  ({ one }) => ({
    branch: one(branchTable, {
      fields: [machineInstancesTable.branchId],
      references: [branchTable.id],
    }),
  }),
);

export const messageRelations = relations(messageTable, ({ one }) => ({
  branch: one(branchTable, {
    fields: [messageTable.branchId],
    references: [branchTable.id],
  }),
  usage: one(messageUsageTable, {
    fields: [messageTable.id],
    references: [messageUsageTable.messageId],
  }),
}));

// --- RAG tables ---

export const ragCollectionTable = sqliteTable("rag_collection", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  slug: text().notNull().unique(),
  description: text().notNull().default(""),
  embeddingModel: text("embedding_model").notNull(),
  embeddingDimensions: int("embedding_dimensions").notNull(),
  chunkingStrategy: text("chunking_strategy").notNull(), // "fixed" | "sentence" | "recursive" | "markdown"
  chunkingConfig: text("chunking_config").notNull().default("{}"), // JSON
  needsRebuild: int("needs_rebuild").notNull().default(0),
  vectorThreshold: real("vector_threshold").notNull().default(0.3),
  rerankEnabled: int("rerank_enabled").notNull().default(1),
  rerankModel: text("rerank_model").notNull().default("cohere/rerank-4-pro"),
  rerankTopNInput: int("rerank_top_n_input").notNull().default(15),
  rerankThreshold: real("rerank_threshold").notNull().default(0.3),
  clarificationMode: text("clarification_mode").notNull().default("soft"), // "soft" | "strict"
  knowledgeVersion: int("knowledge_version").notNull().default(0),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ragDocumentTable = sqliteTable(
  "rag_document",
  {
    id: int().primaryKey({ autoIncrement: true }),
    collectionId: int("collection_id")
      .notNull()
      .references(() => ragCollectionTable.id, { onDelete: "cascade" }),
    title: text().notNull(),
    slug: text().notNull().default(""),
    sourceType: text("source_type").notNull(), // "file" | "text" | "agent"
    filename: text(),
    contentHash: text("content_hash").notNull(),
    chunkCount: int("chunk_count").notNull().default(0),
    status: text().notNull().default("ready"), // "processing" | "ready" | "error"
    createdAt: int("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("rag_document_collection_slug").on(table.collectionId, table.slug),
  ],
);

export const ragChunkTable = sqliteTable("rag_chunk", {
  id: int().primaryKey({ autoIncrement: true }),
  documentId: int("document_id")
    .notNull()
    .references(() => ragDocumentTable.id, { onDelete: "cascade" }),
  chunkIndex: int("chunk_index").notNull(),
  content: text().notNull(),
  qdrantPointId: text("qdrant_point_id").notNull(),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ragCollectionRelations = relations(
  ragCollectionTable,
  ({ many }) => ({
    documents: many(ragDocumentTable),
  }),
);

export const ragDocumentRelations = relations(
  ragDocumentTable,
  ({ one, many }) => ({
    collection: one(ragCollectionTable, {
      fields: [ragDocumentTable.collectionId],
      references: [ragCollectionTable.id],
    }),
    chunks: many(ragChunkTable),
  }),
);

export const ragChunkRelations = relations(ragChunkTable, ({ one }) => ({
  document: one(ragDocumentTable, {
    fields: [ragChunkTable.documentId],
    references: [ragDocumentTable.id],
  }),
}));

export const messageUsageRelations = relations(
  messageUsageTable,
  ({ one }) => ({
    message: one(messageTable, {
      fields: [messageUsageTable.messageId],
      references: [messageTable.id],
    }),
  }),
);
