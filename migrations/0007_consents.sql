CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`version` text NOT NULL,
	`granted_at` text DEFAULT (datetime('now')) NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_consents_user` ON `consents` (`user_id`,`kind`);