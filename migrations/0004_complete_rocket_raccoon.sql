CREATE TABLE `tracking_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`created_by` text NOT NULL,
	`kind` text DEFAULT 'kick' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`target_count` integer DEFAULT 10 NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`note` text,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tracking_family` ON `tracking_sessions` (`family_id`,`kind`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_tracking_open` ON `tracking_sessions` (`family_id`,`ended_at`);