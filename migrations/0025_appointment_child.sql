-- นัดของลูกคนไหน — null = นัดของแม่/ครอบครัว (แบบเดิม)
ALTER TABLE `appointments` ADD `child_id` text REFERENCES children(id) ON DELETE set null;
