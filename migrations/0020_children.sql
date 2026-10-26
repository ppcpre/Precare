CREATE TABLE `child_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`measured_on` text NOT NULL,
	`weight_kg` real,
	`height_cm` real,
	`head_cm` real,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_child_meas` ON `child_measurements` (`child_id`,`measured_on`);--> statement-breakpoint
CREATE TABLE `child_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`kind` text NOT NULL,
	`achieved_on` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_child_milestone` ON `child_milestones` (`child_id`,`kind`);--> statement-breakpoint
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_children_family` ON `children` (`family_id`,`birth_date`);--> statement-breakpoint
ALTER TABLE `photos` ADD `child_id` text REFERENCES children(id);--> statement-breakpoint
CREATE INDEX `idx_photos_child` ON `photos` (`child_id`,`taken_at`);