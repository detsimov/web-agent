import { relations } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chatTable = sqliteTable("chat_table", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  maxTokens: int("max_tokens").notNull(),
  systemMessage: text("system_message").notNull(),
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

export const chatRelations = relations(chatTable, ({ many }) => ({
  messages: many(messageTable),
}));

export const messageRelations = relations(messageTable, ({ one }) => ({
  chat: one(chatTable, {
    fields: [messageTable.chatId],
    references: [chatTable.id],
  }),
}));
