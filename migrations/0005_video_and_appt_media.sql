-- วิดีโอในอัลบั้ม + ไฟล์แนบนัดหมาย
--
-- media_kind มี default 'photo' แถวเดิมจึงถูกต้องอยู่แล้วโดยไม่ต้อง backfill
--
-- ⚠️ ON DELETE SET NULL เติมด้วยมือ — drizzle-kit ตัดทิ้งตอน generate
--    (ALTER TABLE ADD COLUMN ของ SQLite รองรับ แต่ตัว generator ไม่ได้ใส่ให้)
--    ถ้าไม่มี การลบนัดหมายที่มีไฟล์แนบจะติด FK แล้วลบไม่ได้
--    snapshot ของ drizzle บันทึกเป็น set null ไว้แล้ว จึงไม่ขัดกัน
ALTER TABLE `photos` ADD `media_kind` text DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE `photos` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `appointment_id` text REFERENCES appointments(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `idx_photos_appt` ON `photos` (`appointment_id`);
