CREATE TABLE `invariant` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`pattern` text NOT NULL,
	`case_sensitive` integer DEFAULT 0 NOT NULL,
	`severity` text NOT NULL,
	`prompt_hint` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invariant_name_unique` ON `invariant` (`name`);
