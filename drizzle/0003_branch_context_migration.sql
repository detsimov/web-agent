-- Create branch table
CREATE TABLE `branch` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` integer NOT NULL,
	`name` text NOT NULL,
	`parent_branch_id` integer,
	`forked_at_msg_id` integer,
	`sliding_window_enabled` integer NOT NULL DEFAULT 0,
	`sliding_window_size` integer NOT NULL DEFAULT 20,
	`sticky_facts_enabled` integer NOT NULL DEFAULT 0,
	`sticky_facts_every` integer NOT NULL DEFAULT 1,
	`sticky_facts_model` text,
	`summarization_strategy` text,
	`summarization_model` text,
	`summarization_every` integer,
	`summarization_ratio` real,
	`summarization_keep` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat_table`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Create "main" branch for each existing chat, copying summarization settings
INSERT INTO `branch` (`chat_id`, `name`, `summarization_strategy`, `summarization_model`, `summarization_every`, `summarization_ratio`, `summarization_keep`, `created_at`)
SELECT `id`, 'main', `summarization_strategy`, `summarization_model`, `summarization_every`, `summarization_ratio`, `summarization_keep`, `created_at`
FROM `chat_table`;
--> statement-breakpoint
-- Create new message table with branch_id instead of chat_id
CREATE TABLE `message_table_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Copy messages, mapping chatId to branchId via the main branch
INSERT INTO `message_table_new` (`id`, `branch_id`, `role`, `content`, `created_at`)
SELECT m.`id`, b.`id`, m.`role`, m.`content`, m.`created_at`
FROM `message_table` m
JOIN `branch` b ON b.`chat_id` = m.`chat_id` AND b.`name` = 'main';
--> statement-breakpoint
-- Drop old message_usage FK temporarily by recreating
CREATE TABLE `message_usage_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`cost` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message_table_new`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `message_usage_new` (`id`, `message_id`, `input_tokens`, `output_tokens`, `total_tokens`, `cost`, `created_at`)
SELECT `id`, `message_id`, `input_tokens`, `output_tokens`, `total_tokens`, `cost`, `created_at`
FROM `message_usage`;
--> statement-breakpoint
DROP TABLE `message_usage`;
--> statement-breakpoint
ALTER TABLE `message_usage_new` RENAME TO `message_usage`;
--> statement-breakpoint
CREATE UNIQUE INDEX `message_usage_message_id_unique` ON `message_usage` (`message_id`);
--> statement-breakpoint
DROP TABLE `message_table`;
--> statement-breakpoint
ALTER TABLE `message_table_new` RENAME TO `message_table`;
--> statement-breakpoint
-- Create branch_context_state table
CREATE TABLE `branch_context_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`facts` text NOT NULL,
	`context` text NOT NULL,
	`summarized_up_to` integer NOT NULL,
	`facts_extracted_up_to` integer NOT NULL DEFAULT 0,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_context_state_branch_id_unique` ON `branch_context_state` (`branch_id`);
--> statement-breakpoint
-- Migrate summarization_state to branch_context_state, converting core string[] to facts Record<string, string>
-- Note: core is a JSON array of strings. We convert each to "fact_N" = "value" format as JSON object.
-- SQLite json functions handle this; fallback to storing as-is for manual fix.
INSERT INTO `branch_context_state` (`branch_id`, `facts`, `context`, `summarized_up_to`, `facts_extracted_up_to`, `updated_at`)
SELECT
	b.`id`,
	CASE
		WHEN s.`core` = '[]' OR s.`core` IS NULL THEN '{}'
		ELSE (
			SELECT '{' || group_concat('"fact_' || (key + 1) || '": ' || json_quote(value), ', ') || '}'
			FROM json_each(s.`core`)
		)
	END,
	COALESCE(s.`context`, ''),
	COALESCE(s.`summarized_up_to`, 0),
	COALESCE(s.`summarized_up_to`, 0),
	COALESCE(s.`updated_at`, unixepoch())
FROM `summarization_state` s
JOIN `branch` b ON b.`chat_id` = s.`chat_id` AND b.`name` = 'main';
--> statement-breakpoint
DROP TABLE `summarization_state`;
--> statement-breakpoint
-- Add sticky facts columns to chat_table
ALTER TABLE `chat_table` ADD `sticky_facts_base_keys` text;
--> statement-breakpoint
ALTER TABLE `chat_table` ADD `sticky_facts_rules` text;
--> statement-breakpoint
-- Remove summarization columns from chat_table
ALTER TABLE `chat_table` DROP COLUMN `summarization_strategy`;
--> statement-breakpoint
ALTER TABLE `chat_table` DROP COLUMN `summarization_model`;
--> statement-breakpoint
ALTER TABLE `chat_table` DROP COLUMN `summarization_every`;
--> statement-breakpoint
ALTER TABLE `chat_table` DROP COLUMN `summarization_ratio`;
--> statement-breakpoint
ALTER TABLE `chat_table` DROP COLUMN `summarization_keep`;
