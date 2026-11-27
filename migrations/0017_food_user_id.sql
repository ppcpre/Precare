-- แยกบันทึกอาหารตามคน: เพิ่ม user_id (เจ้าของมื้อ) แยกจาก created_by (คนกรอก)
--
-- ที่ drizzle-kit สร้างมาใช้ไม่ได้ เพราะ SQLite เพิ่มคอลัมน์ NOT NULL ที่ไม่มี
-- default ลงตารางที่มีแถวอยู่แล้วไม่ได้ และไม่มีการ backfill ให้
-- จึงสร้างตารางใหม่แล้วย้ายข้อมูล ซึ่งเป็นวิธีเดียวที่ได้ทั้ง NOT NULL และ FK ครบ
--
-- ไม่มีตารางไหนอ้างถึง food_logs จึงไม่ต้องปิดการตรวจ FK ระหว่างย้าย
-- และแถวที่ย้ายไปผ่าน FK ทั้งหมดอยู่แล้ว (family_id, created_by มีจริง)
CREATE TABLE `food_logs_new` (
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
	`user_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- user_id = created_by ถูกต้องสำหรับข้อมูลเดิม เพราะที่ผ่านมาทุกคนกรอกของตัวเอง
INSERT INTO `food_logs_new`
	(`id`, `family_id`, `eaten_on`, `slot`, `name`, `portion`, `kcal`, `carb_g`,
	 `sugar_g`, `protein_g`, `source`, `confirmed`, `user_id`, `created_by`, `created_at`)
SELECT
	`id`, `family_id`, `eaten_on`, `slot`, `name`, `portion`, `kcal`, `carb_g`,
	`sugar_g`, `protein_g`, `source`, `confirmed`, `created_by`, `created_by`, `created_at`
FROM `food_logs`;
--> statement-breakpoint
DROP TABLE `food_logs`;
--> statement-breakpoint
ALTER TABLE `food_logs_new` RENAME TO `food_logs`;
--> statement-breakpoint
CREATE INDEX `idx_food_family_user_date` ON `food_logs` (`family_id`,`user_id`,`eaten_on`);
--> statement-breakpoint
CREATE INDEX `idx_food_family_date` ON `food_logs` (`family_id`,`eaten_on`);
