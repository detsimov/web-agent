CREATE TABLE `mcp_server` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_server_name_unique` ON `mcp_server` (`name`);
--> statement-breakpoint
CREATE TABLE `branch_mcp_override` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`branch_id` integer NOT NULL REFERENCES `branch`(`id`) ON DELETE CASCADE,
	`mcp_server_id` integer NOT NULL REFERENCES `mcp_server`(`id`) ON DELETE CASCADE,
	`enabled` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `branch_mcp_override_branch_id_mcp_server_id_unique` ON `branch_mcp_override` (`branch_id`, `mcp_server_id`);
