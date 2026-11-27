-- ON DELETE SET NULL เขียนเอง — drizzle-kit ตัดทิ้งตอน generate เป็น ALTER TABLE ADD COLUMN
-- ถ้าไม่มี การลบรูปที่ถูกตั้งเป็นหน้าปกจะติด FK แล้วลบไม่ผ่าน
ALTER TABLE `pregnancy_profiles` ADD `cover_photo_id` text REFERENCES photos(id) ON DELETE SET NULL;
