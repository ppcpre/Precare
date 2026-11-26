-- ยาประจำของลูกที่เตือนไปแล้ว — กันเตือนซ้ำ
CREATE TABLE `child_med_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`med_id` text NOT NULL,
	`due_on` text NOT NULL,
	`at` text NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`med_id`) REFERENCES `child_meds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_child_med_sent` ON `child_med_sent` (`med_id`,`due_on`,`at`);
--> statement-breakpoint
CREATE INDEX `idx_child_med_sent_at` ON `child_med_sent` (`sent_at`);
