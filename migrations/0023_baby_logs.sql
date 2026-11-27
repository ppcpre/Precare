CREATE TABLE `baby_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text,
	`kind` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`left_sec` integer,
	`right_sec` integer,
	`side` text,
	`side_started_at` text,
	`ml` integer,
	`milk` text,
	`left_ml` integer,
	`right_ml` integer,
	`diaper` text,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_baby_logs_child` ON `baby_logs` (`family_id`,`child_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_baby_logs_open` ON `baby_logs` (`family_id`,`ended_at`);
