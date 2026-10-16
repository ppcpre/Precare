CREATE TABLE `pregnancy_profile_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`field` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`changed_by` text NOT NULL,
	`changed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_profile_changes_family` ON `pregnancy_profile_changes` (`family_id`,`changed_at`);--> statement-breakpoint
ALTER TABLE `pregnancy_profiles` ADD `height_cm` real;--> statement-breakpoint
ALTER TABLE `pregnancy_profiles` ADD `pre_pregnancy_weight` real;