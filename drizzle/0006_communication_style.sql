-- Create personalization table (singleton)
CREATE TABLE `personalization` (
	`id` integer PRIMARY KEY NOT NULL,
	`communication_style` text NOT NULL DEFAULT 'normal',
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
-- Add communication_style column to branch table
ALTER TABLE `branch` ADD `communication_style` text;
