-- Add new columns to branch table
ALTER TABLE `branch` ADD `context_mode` text NOT NULL DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE `branch` ADD `summarization_trigger` text DEFAULT 'window';
--> statement-breakpoint
ALTER TABLE `branch` ADD `model` text;
--> statement-breakpoint
-- Migrate existing data: sliding_window_enabled=1 → context_mode='sliding-window'
UPDATE `branch` SET `context_mode` = 'sliding-window'
  WHERE `sliding_window_enabled` = 1;
--> statement-breakpoint
-- Migrate existing data: summarization_strategy IS NOT NULL → context_mode='summarization'
UPDATE `branch` SET `context_mode` = 'summarization'
  WHERE `summarization_strategy` IS NOT NULL AND `sliding_window_enabled` = 0;
--> statement-breakpoint
-- Map old summarization_strategy values to summarization_trigger
UPDATE `branch` SET `summarization_trigger` = `summarization_strategy`
  WHERE `summarization_strategy` IS NOT NULL;
--> statement-breakpoint
-- Step 1: Drop dependent tables (cascade won't help with rebuilds)
-- Save message_usage data first (depends on message_table)
CREATE TABLE `message_usage_save` AS SELECT * FROM `message_usage`;
--> statement-breakpoint
DROP TABLE `message_usage`;
--> statement-breakpoint
-- Save branch_context_state data
CREATE TABLE `branch_context_state_save` AS SELECT * FROM `branch_context_state`;
--> statement-breakpoint
DROP TABLE `branch_context_state`;
--> statement-breakpoint
-- Save message_table data
CREATE TABLE `message_table_save` AS SELECT * FROM `message_table`;
--> statement-breakpoint
DROP TABLE `message_table`;
--> statement-breakpoint
-- Step 2: Rebuild branch without old columns
CREATE TABLE `branch_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` integer NOT NULL,
	`name` text NOT NULL,
	`parent_branch_id` integer,
	`forked_at_msg_id` integer,
	`context_mode` text NOT NULL DEFAULT 'none',
	`model` text,
	`sliding_window_size` integer NOT NULL DEFAULT 20,
	`sticky_facts_enabled` integer NOT NULL DEFAULT 0,
	`sticky_facts_every` integer NOT NULL DEFAULT 1,
	`sticky_facts_model` text,
	`summarization_trigger` text DEFAULT 'window',
	`summarization_model` text,
	`summarization_every` integer,
	`summarization_ratio` real,
	`summarization_keep` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat_table`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `branch_new` (
	`id`, `chat_id`, `name`, `parent_branch_id`, `forked_at_msg_id`,
	`context_mode`, `model`, `sliding_window_size`,
	`sticky_facts_enabled`, `sticky_facts_every`, `sticky_facts_model`,
	`summarization_trigger`, `summarization_model`, `summarization_every`,
	`summarization_ratio`, `summarization_keep`, `created_at`
)
SELECT
	`id`, `chat_id`, `name`, `parent_branch_id`, `forked_at_msg_id`,
	`context_mode`, `model`, `sliding_window_size`,
	`sticky_facts_enabled`, `sticky_facts_every`, `sticky_facts_model`,
	`summarization_trigger`, `summarization_model`, `summarization_every`,
	`summarization_ratio`, `summarization_keep`, `created_at`
FROM `branch`;
--> statement-breakpoint
DROP TABLE `branch`;
--> statement-breakpoint
ALTER TABLE `branch_new` RENAME TO `branch`;
--> statement-breakpoint
-- Step 3: Recreate dependent tables with correct FK references to `branch`
CREATE TABLE `message_table` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `message_table` (`id`, `branch_id`, `role`, `content`, `created_at`)
SELECT `id`, `branch_id`, `role`, `content`, `created_at` FROM `message_table_save`;
--> statement-breakpoint
DROP TABLE `message_table_save`;
--> statement-breakpoint
CREATE TABLE `message_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`cost` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message_table`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `message_usage` (`id`, `message_id`, `input_tokens`, `output_tokens`, `total_tokens`, `cost`, `created_at`)
SELECT `id`, `message_id`, `input_tokens`, `output_tokens`, `total_tokens`, `cost`, `created_at` FROM `message_usage_save`;
--> statement-breakpoint
DROP TABLE `message_usage_save`;
--> statement-breakpoint
CREATE UNIQUE INDEX `message_usage_message_id_unique` ON `message_usage` (`message_id`);
--> statement-breakpoint
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
INSERT INTO `branch_context_state` (`id`, `branch_id`, `facts`, `context`, `summarized_up_to`, `facts_extracted_up_to`, `updated_at`)
SELECT `id`, `branch_id`, `facts`, `context`, `summarized_up_to`, `facts_extracted_up_to`, `updated_at` FROM `branch_context_state_save`;
--> statement-breakpoint
DROP TABLE `branch_context_state_save`;
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_context_state_branch_id_unique` ON `branch_context_state` (`branch_id`);
