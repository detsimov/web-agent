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
CREATE UNIQUE INDEX `message_usage_message_id_unique` ON `message_usage` (`message_id`);