import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatTable = sqliteTable("chat_table", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  maxTokens: int("max_tokens").notNull(),
  systemMessage: text("system_message").notNull(),
  summarizationStrategy: text("summarization_strategy"),
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
  chatId: int("chat_id")
    .notNull()
    .references(() => chatTable.id, { onDelete: "cascade" }),
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

export const summarizationStateTable = sqliteTable("summarization_state", {
  id: int().primaryKey({ autoIncrement: true }),
  chatId: int("chat_id")
    .notNull()
    .unique()
    .references(() => chatTable.id, { onDelete: "cascade" }),
  core: text().notNull(),
  context: text().notNull(),
  summarizedUpTo: int("summarized_up_to").notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatRelations = relations(chatTable, ({ many, one }) => ({
  messages: many(messageTable),
  summarizationState: one(summarizationStateTable, {
    fields: [chatTable.id],
    references: [summarizationStateTable.chatId],
  }),
}));

export const summarizationStateRelations = relations(
  summarizationStateTable,
  ({ one }) => ({
    chat: one(chatTable, {
      fields: [summarizationStateTable.chatId],
      references: [chatTable.id],
    }),
  }),
);

export const messageRelations = relations(messageTable, ({ one }) => ({
  chat: one(chatTable, {
    fields: [messageTable.chatId],
    references: [chatTable.id],
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
