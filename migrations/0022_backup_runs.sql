CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`ran_at` text DEFAULT (datetime('now')) NOT NULL,
	`status` text NOT NULL,
	`object_key` text,
	`bytes` integer,
	`removed` integer DEFAULT 0 NOT NULL,
	`error` text
);--> statement-breakpoint
CREATE INDEX `idx_backup_runs_ran_at` ON `backup_runs` (`ran_at`);
