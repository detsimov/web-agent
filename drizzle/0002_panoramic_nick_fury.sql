CREATE TABLE `summarization_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` integer NOT NULL,
	`core` text NOT NULL,
	`context` text NOT NULL,
	`summarized_up_to` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chat_table`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `summarization_state_chat_id_unique` ON `summarization_state` (`chat_id`);--> statement-breakpoint
ALTER TABLE `chat_table` ADD `summarization_strategy` text;--> statement-breakpoint
ALTER TABLE `chat_table` ADD `summarization_model` text;--> statement-breakpoint
ALTER TABLE `chat_table` ADD `summarization_every` integer;--> statement-breakpoint
ALTER TABLE `chat_table` ADD `summarization_ratio` real;--> statement-breakpoint
ALTER TABLE `chat_table` ADD `summarization_keep` integer;