CREATE TABLE `storage_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket` text NOT NULL,
	`key` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`kind` text NOT NULL,
	`family_id` text,
	`uploaded_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_objects_key_unique` ON `storage_objects` (`key`);--> statement-breakpoint
CREATE INDEX `idx_storage_family` ON `storage_objects` (`family_id`);