DROP INDEX `idx_photos_family`;--> statement-breakpoint
-- SQLite ไม่ยอม ADD COLUMN ... NOT NULL ถ้าไม่มี DEFAULT (แม้ตารางจะว่าง)
ALTER TABLE `photos` ADD `taken_at` text NOT NULL DEFAULT (date('now'));--> statement-breakpoint
ALTER TABLE `photos` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_photos_family` ON `photos` (`family_id`,`taken_at`);