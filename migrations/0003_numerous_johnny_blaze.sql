CREATE TABLE `care_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'peach' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_care_groups_family` ON `care_groups` (`family_id`);--> statement-breakpoint
ALTER TABLE `appointments` ADD `group_id` text REFERENCES care_groups(id);--> statement-breakpoint
ALTER TABLE `appointments` ADD `cost_satang` integer;--> statement-breakpoint
ALTER TABLE `appointments` ADD `claim_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `appointments` ADD `cost_note` text;--> statement-breakpoint
CREATE INDEX `idx_appts_group` ON `appointments` (`group_id`);--> statement-breakpoint
-- ผู้ใช้เดิมต้องไม่เห็นอะไรเปลี่ยน: สร้างกลุ่ม "ฝากครรภ์" ให้ทุกครอบครัวที่มีอยู่
-- แล้วย้ายนัดหมายเดิมทั้งหมดเข้ากลุ่มนั้น
-- ใช้ randomblob แทน uuid เพราะ SQLite ไม่มีฟังก์ชัน uuid ในตัว
-- id เป็น text อยู่แล้วจึงไม่ต้องตรงรูปแบบกับที่ crypto.randomUUID() สร้าง
INSERT INTO `care_groups` (`id`, `family_id`, `name`, `color`)
SELECT lower(hex(randomblob(16))), `id`, 'ฝากครรภ์', 'peach' FROM `families`;--> statement-breakpoint
UPDATE `appointments` SET `group_id` = (
  SELECT `g`.`id` FROM `care_groups` `g` WHERE `g`.`family_id` = `appointments`.`family_id` LIMIT 1
) WHERE `group_id` IS NULL;
