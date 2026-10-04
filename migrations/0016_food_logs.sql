CREATE TABLE `food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`eaten_on` text NOT NULL,
	`slot` text NOT NULL,
	`name` text NOT NULL,
	`portion` text,
	`kcal` integer,
	`carb_g` integer,
	`sugar_g` integer,
	`protein_g` integer,
	`source` text DEFAULT 'user' NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_food_family_date` ON `food_logs` (`family_id`,`eaten_on`);