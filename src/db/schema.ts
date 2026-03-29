import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatTable = sqliteTable("chat_table", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  maxTokens: int("max_tokens").notNull(),
  systemMessage: text("system_message").notNull(),
  stickyFactsBaseKeys: text("sticky_facts_base_keys"),
  stickyFactsRules: text("sticky_facts_rules"),
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
}));

export const branchContextStateRelations = relations(
  branchContextStateTable,
  ({ one }) => ({
    branch: one(branchTable, {
      fields: [branchContextStateTable.branchId],
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

export const messageUsageRelations = relations(
  messageUsageTable,
  ({ one }) => ({
    message: one(messageTable, {
      fields: [messageUsageTable.messageId],
      references: [messageTable.id],
    }),
  }),
);
