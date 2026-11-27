CREATE TABLE `visit_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`created_by` text NOT NULL,
	`text` text NOT NULL,
	`asked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_visit_q_family` ON `visit_questions` (`family_id`,`asked_at`);