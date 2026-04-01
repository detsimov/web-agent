CREATE TABLE `machine_instances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL REFERENCES `branch`(`id`) ON DELETE CASCADE,
	`definition_id` text NOT NULL,
	`current_state` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`history` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
