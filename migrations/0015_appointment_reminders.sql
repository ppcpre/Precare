CREATE TABLE `appointment_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`minutes_before` integer NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reminder_appt_minutes` ON `appointment_reminders` (`appointment_id`,`minutes_before`);--> statement-breakpoint
CREATE INDEX `idx_reminders_pending` ON `appointment_reminders` (`appointment_id`) WHERE sent_at IS NULL;--> statement-breakpoint
-- ย้ายของเดิมมาให้ครบ: นัดทุกนัดที่มีอยู่ได้เวลาเตือนหนึ่งครั้งเท่าที่เคยตั้งไว้
-- พร้อมสถานะ "เตือนแล้วหรือยัง" ของเดิม ไม่งั้นนัดที่เตือนไปแล้วจะถูกเตือนซ้ำ
-- และนัดที่ยังไม่ถึงคิวจะเงียบไปเลยเพราะไม่มีแถวให้ตัวจับเวลาเจอ
INSERT INTO `appointment_reminders` (`id`, `appointment_id`, `minutes_before`, `sent_at`)
SELECT lower(hex(randomblob(16))), `id`, `reminder_minutes_before`, `reminder_sent_at`
FROM `appointments`;
