-- การแจ้งเตือนของบันทึกประจำวันลูก — ของคนตั้ง ยิงเข้าเครื่องคนตั้งเท่านั้น
CREATE TABLE `baby_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`child_id` text,
	`kind` text NOT NULL,
	`every_min` integer NOT NULL,
	`quiet_from` text,
	`quiet_to` text,
	`active` integer DEFAULT true NOT NULL,
	`last_anchor` text,
	`last_sent_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_baby_reminders_user` ON `baby_reminders` (`user_id`,`family_id`);
--> statement-breakpoint
CREATE INDEX `idx_baby_reminders_active` ON `baby_reminders` (`active`);
