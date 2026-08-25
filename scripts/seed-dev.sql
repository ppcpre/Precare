-- Seed สำหรับ dev เท่านั้น — ห้ามรันกับ precare-db (production)
-- รันซ้ำได้ ลบของเดิมก่อนเสมอ
-- ใช้:  npm run db:seed:dev

DELETE FROM photos;
DELETE FROM appointments;
DELETE FROM weekly_logs;
DELETE FROM pregnancy_profiles;
DELETE FROM family_invites;
DELETE FROM family_members;
DELETE FROM families;
DELETE FROM account;
DELETE FROM session;
DELETE FROM user;

-- ผู้ใช้ 3 คน · ปกติ Better Auth เป็นคนสร้าง ที่นี่ insert ตรงเพื่อ seed
INSERT INTO user (id,name,email,email_verified,image,active_family_id,created_at,updated_at) VALUES ('u_owner','แม่ญาญ่า','yaya@example.com',0,NULL,'f_demo',1787626800,1787626800);
INSERT INTO user (id,name,email,email_verified,image,active_family_id,created_at,updated_at) VALUES ('u_editor','พี่นก','nok@example.com',0,NULL,'f_demo',1787626800,1787626800);
INSERT INTO user (id,name,email,email_verified,image,active_family_id,created_at,updated_at) VALUES ('u_viewer','คุณแม่มาลี','malee@example.com',0,NULL,'f_demo',1787626800,1787626800);

-- ครอบครัว + สมาชิก 3 role
INSERT INTO families (id,name,owner_id,created_at) VALUES ('f_demo','ครอบครัวใจดี','u_owner','2026-03-15 09:00:00');
INSERT INTO family_members (id,family_id,user_id,role,status,joined_at) VALUES ('m1','f_demo','u_owner','owner','active','2026-03-15 09:00:00');
INSERT INTO family_members (id,family_id,user_id,role,status,joined_at) VALUES ('m2','f_demo','u_editor','editor','active','2026-03-15 09:00:00');
INSERT INTO family_members (id,family_id,user_id,role,status,joined_at) VALUES ('m3','f_demo','u_viewer','viewer','active','2026-03-15 09:00:00');

-- คำเชิญที่ยังรอตอบรับ (ไว้ทดสอบหน้า /family)
INSERT INTO family_invites (id,family_id,invited_email,invited_role,invited_by,status,created_at,expires_at) VALUES ('i1','f_demo','somchai@example.com','editor','u_owner','pending','2026-08-24 10:00:00','2026-08-31 10:00:00');

-- ตั้งครรภ์: LMP 2026-03-10 -> EDD 2026-12-15 -> สัปดาห์ที่ 24 ณ 2026-08-25
INSERT INTO pregnancy_profiles (family_id,lmp_date,due_date,status,updated_at) VALUES ('f_demo','2026-03-10','2026-12-15','pregnant','2026-03-15 09:00:00');

-- บันทึกสุขภาพ 5 รายการ (สัปดาห์ 23 ความดันสูงกว่าเกณฑ์ ไว้ทดสอบ state ผิดปกติ)
INSERT INTO weekly_logs (id,family_id,recorded_by,week,weight,bp_systolic,bp_diastolic,symptoms,mood,note,log_date,created_at) VALUES ('l1','f_demo','u_owner',24,62.5,118,76,'["คลื่นไส้","ปวดหลัง"]','good','วันนี้รู้สึกดีขึ้นมาก กินข้าวได้เยอะขึ้น ลูกดิ้นบ่อยตอนกลางคืน','2026-08-12','2026-08-12 20:00:00');
INSERT INTO weekly_logs (id,family_id,recorded_by,week,weight,bp_systolic,bp_diastolic,symptoms,mood,note,log_date,created_at) VALUES ('l2','f_demo','u_editor',23,62.1,142,91,'["บวม","เหนื่อยง่าย"]','tired','ขาบวมมากขึ้นตอนเย็น จะถามคุณหมอในนัดหน้า','2026-08-05','2026-08-05 20:00:00');
INSERT INTO weekly_logs (id,family_id,recorded_by,week,weight,bp_systolic,bp_diastolic,symptoms,mood,note,log_date,created_at) VALUES ('l3','f_demo','u_owner',22,61.5,120,78,'["นอนไม่หลับ"]','okay',NULL,'2026-07-29','2026-07-29 20:00:00');
INSERT INTO weekly_logs (id,family_id,recorded_by,week,weight,bp_systolic,bp_diastolic,symptoms,mood,note,log_date,created_at) VALUES ('l4','f_demo','u_owner',21,61.0,116,74,'[]','great','ไปอัลตราซาวด์มา ลูกแข็งแรงดี','2026-07-22','2026-07-22 20:00:00');
INSERT INTO weekly_logs (id,family_id,recorded_by,week,weight,bp_systolic,bp_diastolic,symptoms,mood,note,log_date,created_at) VALUES ('l5','f_demo','u_owner',20,60.4,119,75,'["คลื่นไส้"]','good',NULL,'2026-07-15','2026-07-15 20:00:00');

-- นัดหมาย 3 รายการ
INSERT INTO appointments (id,family_id,created_by,appt_datetime,title,doctor_name,location,note,reminder_enabled,reminder_minutes_before) VALUES ('a1','f_demo','u_owner','2026-08-28T14:30:00','ตรวจครรภ์ตามนัด','นพ.สมชาย','รพ.รามาธิบดี',NULL,1,60);
INSERT INTO appointments (id,family_id,created_by,appt_datetime,title,doctor_name,location,note,reminder_enabled,reminder_minutes_before) VALUES ('a2','f_demo','u_owner','2026-09-11T09:00:00','อัลตราซาวด์','พญ.มาลี','รพ.รามาธิบดี','อดอาหารก่อน 6 ชม.',1,1440);
INSERT INTO appointments (id,family_id,created_by,appt_datetime,title,doctor_name,location,note,reminder_enabled,reminder_minutes_before) VALUES ('a3','f_demo','u_owner','2026-09-25T10:30:00','ตรวจเลือด','นพ.สมชาย','รพ.รามาธิบดี',NULL,1,60);
