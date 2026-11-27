-- ยาของลูก (ทั้งบ้านเห็น) · ครั้งที่ให้ยา · วัดไข้
CREATE TABLE `child_meds` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text NOT NULL,
	`name` text NOT NULL,
	`dose` text,
	`mode` text NOT NULL,
	`min_gap_min` integer,
	`times` text,
	`note` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_child_meds_child` ON `child_meds` (`family_id`,`child_id`);
--> statement-breakpoint
CREATE TABLE `child_med_doses` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`med_id` text NOT NULL,
	`given_at` text NOT NULL,
	`given_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`med_id`) REFERENCES `child_meds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`given_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_child_med_doses_med` ON `child_med_doses` (`med_id`,`given_at`);
--> statement-breakpoint
CREATE TABLE `child_temps` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`child_id` text NOT NULL,
	`measured_at` text NOT NULL,
	`temp_tenths` integer NOT NULL,
	`site` text NOT NULL,
	`symptoms` text,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_child_temps_child` ON `child_temps` (`family_id`,`child_id`,`measured_at`);
