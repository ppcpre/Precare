CREATE TABLE `medication_doses` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_time_id` text NOT NULL,
	`due_on` text NOT NULL,
	`sent_at` text,
	`taken_at` text,
	FOREIGN KEY (`medication_time_id`) REFERENCES `medication_times`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_dose_time_day` ON `medication_doses` (`medication_time_id`,`due_on`);--> statement-breakpoint
CREATE TABLE `medication_times` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_med_time` ON `medication_times` (`medication_id`,`at`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`dose` text,
	`note` text,
	`start_on` text NOT NULL,
	`end_on` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_meds_family_user` ON `medications` (`family_id`,`user_id`);