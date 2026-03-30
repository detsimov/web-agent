-- Create global_facts table
CREATE TABLE `global_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_facts_key_unique` ON `global_facts` (`key`);
--> statement-breakpoint
-- Create branch_working_memory table
CREATE TABLE `branch_working_memory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branch`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_working_memory_branch_id_unique` ON `branch_working_memory` (`branch_id`);
--> statement-breakpoint
-- Add working memory columns to branch table
ALTER TABLE `branch` ADD `working_memory_mode` text NOT NULL DEFAULT 'off';
--> statement-breakpoint
ALTER TABLE `branch` ADD `working_memory_model` text;
--> statement-breakpoint
ALTER TABLE `branch` ADD `working_memory_every` integer NOT NULL DEFAULT 1;
--> statement-breakpoint
-- Add facts extraction columns to chat_table
ALTER TABLE `chat_table` ADD `facts_extraction_model` text;
--> statement-breakpoint
ALTER TABLE `chat_table` ADD `facts_extraction_rules` text;
