-- P1 fixture adapted from original simulated data. Names and measurements are fictional.
-- =====================================================================
-- SA Project — Contract v0.3 — SEED DATA
-- ข้อมูลตัวอย่าง (สมมติ) · ใช้สาธิตระบบเท่านั้น ไม่ใช่ข้อมูลหรือสถิติทางธุรกิจจริง
-- ชื่อคน เลขบัตร เบอร์โทร อีเมล token และ URL ทั้งหมดเป็นข้อมูลสมมติ
-- Target: schema.sql (Simulated Schema, PostgreSQL 16 / PGlite) — NOT an integration test
-- รันต่อจาก schema.sql:  node run-seed.mjs schema.sql seed.sql
--
-- เรื่องราวของข้อมูล (1 บ้าน = 1 สถานะของ ST-01 อย่างน้อย 1 หลัง)
--   H0001 IN_QC              รอบ QC RND0001 OPEN มีจุดครบ WAITING_ASSIGN/ASSIGNED/FIXED/REWORK/VERIFIED
--   H0002 IN_QC              รอบ QC RND0002 RECHECK_SCHEDULED (ทุกจุด VERIFIED รอวันตรวจซ้ำ)
--   H0003 READY_TO_SELL      รอบ QC RND0003 CLOSED แบบยืนยันผลคนเดียว (is_single_certify)
--   H0004 CONTRACTED         ผูกลูกค้า CUS0001 + ลิงก์ LNK000001 ยังไม่ตอบ D05
--   H0005 WAITING_INSPECTION ลูกค้ายื่นคำขอเอง REQ000001 (SUBMITTED, มีนัด) · ลิงก์เก่าหมดอายุแล้วออกใหม่
--   H0006 IN_INSPECTION      ฝ่ายขายยื่นแทน REQ000002 (IN_PROGRESS, REJECTED ครั้งแรก) รอบ RND0011 OPEN
--   H0007 READY_HANDOVER     REQ000003 COMPLETED/ACCEPTED รอบ RND0012 CLOSED มีเอกสารสรุป 2 ฉบับ
--   H0008 HANDED_OVER        REQ000004 COMPLETED รอบ RND0013 CLOSED + ไฟล์ลายเซ็น + handed_over_at
--   H0009 READY_HANDOVER     ลูกค้าตอบ "ไม่ต้องการตรวจ" (UC-10 alt) ไม่มีคำขอ
--   H0010 WAITING_INSPECTION ฝ่ายขายยื่นแทน REQ000005 (SUBMITTED, ยังไม่กำหนดนัด)
-- =====================================================================

BEGIN;

-- ---------- T01 employee (master data: GAP-12) ----------
INSERT INTO employee (employee_id, full_name, phone_number, email, role, craft_category, password_hash, is_active) VALUES
('EMP0001','ณัฐพล ศรีสุข',     '0812345601','nattaphon.s@example.com','SALES',          NULL,          '$2b$10$DEMOONLY.hash.EMP0001.notreal', TRUE),
('EMP0002','วรรณา ใจดี',       '0812345602','wanna.j@example.com',    'SALES',          NULL,          '$2b$10$DEMOONLY.hash.EMP0002.notreal', TRUE),
('EMP0003','ธีรวัฒน์ มั่นคง',    '0812345603','theerawat.m@example.com','INSPECTOR',      NULL,          '$2b$10$DEMOONLY.hash.EMP0003.notreal', TRUE),
('EMP0004','กนกวรรณ แสงทอง',   '0812345604','kanokwan.s@example.com', 'INSPECTOR',      NULL,          '$2b$10$DEMOONLY.hash.EMP0004.notreal', TRUE),
('EMP0005','สมศักดิ์ บุญมา',     '0812345605',NULL,                     'TECHNICIAN',     'ELECTRICAL',  '$2b$10$DEMOONLY.hash.EMP0005.notreal', TRUE),
('EMP0006','ประเสริฐ ทองดี',    '0812345606',NULL,                     'TECHNICIAN',     'PLUMBING',    '$2b$10$DEMOONLY.hash.EMP0006.notreal', TRUE),
('EMP0007','อนุชา พรหมมา',     '0812345607',NULL,                     'TECHNICIAN',     'WALL',        '$2b$10$DEMOONLY.hash.EMP0007.notreal', TRUE),
('EMP0008','วิชัย รุ่งเรือง',     '0812345608','wichai.r@example.com',   'HEAD_TECHNICIAN',NULL,          '$2b$10$DEMOONLY.hash.EMP0008.notreal', TRUE),
('EMP0009','มานพ จันทร์เพ็ญ',   '0812345609',NULL,                     'TECHNICIAN',     'FLOOR',       '$2b$10$DEMOONLY.hash.EMP0009.notreal', TRUE),
('EMP0010','สุริยา แก้วกาญจน์', '0812345610',NULL,                     'TECHNICIAN',     'CEILING',     '$2b$10$DEMOONLY.hash.EMP0010.notreal', TRUE),
('EMP0011','ไพโรจน์ สายทอง',   '0812345611',NULL,                     'TECHNICIAN',     'DOOR_WINDOW', '$2b$10$DEMOONLY.hash.EMP0011.notreal', FALSE);

-- ---------- T02 customer ----------
INSERT INTO customer (customer_id, id_card_no, full_name, phone_number, email) VALUES
('CUS0001','1100000000011','ปิยะพงษ์ เรืองศรี', '0898765401','piyapong.r@example.com'),
('CUS0002','1100000000022','ศิริพร วงศ์ใหญ่',   '0898765402','siriporn.w@example.com'),
('CUS0003','1100000000033','ธนากร พูลสวัสดิ์',  '0898765403',NULL),
('CUS0004','1100000000044','อรอุมา สุขประเสริฐ','0898765404','onuma.s@example.com'),
('CUS0005','1100000000055','กิตติพัฒน์ ชัยมงคล','0898765405','kittiphat.c@example.com'),
('CUS0006','1100000000066','จิราพร นาคสุข',     '0898765406',NULL),
('CUS0007','1100000000077','ภานุวัฒน์ อินทร์แก้ว','0898765407','panuwat.i@example.com');

-- ---------- T03 property_unit ----------
INSERT INTO property_unit (unit_id, project_name, house_no, unit_type, status, customer_id, registered_by, created_at, handed_over_at) VALUES
('H0001','ร่มไม้ทาวน์ บางเขน','88/1', 'ทาวน์โฮม 2 ชั้น','IN_QC',             NULL,     'EMP0001','2026-10-20 09:00',NULL),
('H0002','ร่มไม้ทาวน์ บางเขน','88/2', 'ทาวน์โฮม 2 ชั้น','IN_QC',             NULL,     'EMP0001','2026-10-20 09:10',NULL),
('H0003','ร่มไม้ทาวน์ บางเขน','88/3', 'ทาวน์โฮม 2 ชั้น','READY_TO_SELL',     NULL,     'EMP0001','2026-09-01 09:00',NULL),
('H0004','ร่มไม้ทาวน์ บางเขน','88/4', 'ทาวน์โฮม 3 ชั้น','CONTRACTED',        'CUS0001','EMP0002','2026-08-15 09:00',NULL),
('H0005','ร่มไม้ทาวน์ บางเขน','88/5', 'ทาวน์โฮม 3 ชั้น','WAITING_INSPECTION','CUS0002','EMP0002','2026-08-15 09:10',NULL),
('H0006','ชลธาร ทาวน์โฮม',   '19/7', 'ทาวน์โฮม 2 ชั้น','IN_INSPECTION',     'CUS0003','EMP0001','2026-08-01 10:00',NULL),
('H0007','ชลธาร ทาวน์โฮม',   '19/8', 'ทาวน์โฮม 2 ชั้น','READY_HANDOVER',    'CUS0004','EMP0001','2026-08-01 10:10',NULL),
('H0008','ชลธาร ทาวน์โฮม',   '19/9', 'ทาวน์โฮม 2 ชั้น','HANDED_OVER',       'CUS0005','EMP0002','2026-07-20 10:00','2026-10-30 14:00'),
('H0009','ชลธาร ทาวน์โฮม',   '19/10','ทาวน์โฮม 3 ชั้น','READY_HANDOVER',    'CUS0006','EMP0002','2026-07-20 10:10',NULL),
('H0010','ชลธาร ทาวน์โฮม',   '19/11','ทาวน์โฮม 3 ชั้น','WAITING_INSPECTION','CUS0007','EMP0001','2026-07-20 10:20',NULL);

-- ---------- T05 inspection_request (before T04: T04.request_id references it) ----------
INSERT INTO inspection_request (request_id, unit_id, customer_id, requested_by, preferred_date, appointment, arrival, status, accept_result, accept_reason, accepted_at, created_at) VALUES
-- UC-11 ลูกค้ายื่นเอง, ฝ่ายขายกำหนดนัดแล้ว (Q13.2)
('REQ000001','H0005','CUS0002',NULL,     '2026-11-12','2026-11-12 10:00',NULL,              'SUBMITTED',  NULL,      NULL,                                   NULL,              '2026-11-02 19:30'),
-- UC-12 ฝ่ายขายยื่นแทน, ลูกค้ามาแล้ว, D07 = ไม่ผ่าน (Q17.10) รอซ่อมใหม่ (GAP-03)
('REQ000002','H0006','CUS0003','EMP0002','2026-10-25','2026-10-28 10:00','2026-10-28 10:05','IN_PROGRESS','REJECTED','ท่อใต้ซิงก์ครัวยังซึม และพบจุดใหม่เพิ่ม','2026-11-03 16:20','2026-10-20 11:00'),
-- UC-11 ผ่านครบ (Q17.7) — เคยไม่ผ่านมาก่อน 1 ครั้ง เหตุผลเดิมยังเก็บไว้
('REQ000003','H0007','CUS0004',NULL,     '2026-10-05','2026-10-06 13:00','2026-10-06 13:10','COMPLETED',  'ACCEPTED','รอบแรก: ผนังห้องนอนยังมีรอยร้าว',     '2026-10-20 15:00','2026-09-28 20:15'),
-- UC-12 ผ่านครบแล้วเซ็นรับมอบ
('REQ000004','H0008','CUS0005','EMP0001','2026-10-01','2026-10-01 09:30','2026-10-01 09:40','COMPLETED',  'ACCEPTED','รอบแรก: ฝ้าห้องน้ำมีคราบน้ำ',          '2026-10-25 11:00','2026-09-22 10:00'),
-- UC-12 ฝ่ายขายยื่นแทน ยังไม่กำหนดนัด
('REQ000005','H0010','CUS0007','EMP0001','2026-11-15',NULL,              NULL,              'SUBMITTED',  NULL,      NULL,                                   NULL,              '2026-11-05 14:00');

-- ---------- T04 inspection_round ----------
INSERT INTO inspection_round (round_id, unit_id, round_type, request_id, inspector_id, co_inspector_id, is_single_certify, recheck_date, recheck_result, status, started_at, closed_at) VALUES
('RND0001','H0001','QC_INTERNAL',      NULL,       'EMP0003',NULL,     FALSE,NULL,        NULL,       'OPEN',             '2026-10-22 09:00',NULL),
('RND0002','H0002','QC_INTERNAL',      NULL,       'EMP0004',NULL,     FALSE,'2026-11-09',NULL,       'RECHECK_SCHEDULED','2026-10-22 13:00',NULL),
('RND0003','H0003','QC_INTERNAL',      NULL,       'EMP0003',NULL,     TRUE, '2026-09-20','NO_DEFECT','CLOSED',           '2026-09-03 09:00','2026-09-20 16:00'),
('RND0004','H0004','QC_INTERNAL',      NULL,       'EMP0004','EMP0003',FALSE,'2026-08-30','NO_DEFECT','CLOSED',           '2026-08-17 09:00','2026-08-30 15:00'),
('RND0005','H0005','QC_INTERNAL',      NULL,       'EMP0003','EMP0004',FALSE,'2026-08-31','NO_DEFECT','CLOSED',           '2026-08-17 13:00','2026-08-31 15:00'),
('RND0006','H0006','QC_INTERNAL',      NULL,       'EMP0004','EMP0003',FALSE,'2026-08-20','NO_DEFECT','CLOSED',           '2026-08-03 09:00','2026-08-20 15:00'),
('RND0007','H0007','QC_INTERNAL',      NULL,       'EMP0003',NULL,     TRUE, '2026-08-21','NO_DEFECT','CLOSED',           '2026-08-03 13:00','2026-08-21 15:00'),
('RND0008','H0008','QC_INTERNAL',      NULL,       'EMP0004','EMP0003',FALSE,'2026-08-10','NO_DEFECT','CLOSED',           '2026-07-22 09:00','2026-08-10 15:00'),
('RND0009','H0009','QC_INTERNAL',      NULL,       'EMP0003','EMP0004',FALSE,'2026-08-11','NO_DEFECT','CLOSED',           '2026-07-22 13:00','2026-08-11 15:00'),
('RND0010','H0010','QC_INTERNAL',      NULL,       'EMP0004',NULL,     TRUE, '2026-08-12','NO_DEFECT','CLOSED',           '2026-07-23 09:00','2026-08-12 15:00'),
('RND0011','H0006','CUSTOMER_HANDOVER','REQ000002',NULL,     NULL,     FALSE,NULL,        NULL,       'OPEN',             '2026-10-28 10:05',NULL),
('RND0012','H0007','CUSTOMER_HANDOVER','REQ000003',NULL,     NULL,     FALSE,NULL,        NULL,       'CLOSED',           '2026-10-06 13:10','2026-10-20 15:00'),
('RND0013','H0008','CUSTOMER_HANDOVER','REQ000004',NULL,     NULL,     FALSE,NULL,        NULL,       'CLOSED',           '2026-10-01 09:40','2026-10-25 11:00');

-- ---------- T06 defect ----------
INSERT INTO defect (defect_id, round_id, category, description, location_pin, status, reported_by_type, reported_by_employee, technician_id, assigned_by, assigned_date, target_date, completed_date, verified_by, verified_at, rework_count, created_at) VALUES
-- RND0001 รอบ QC ที่ยังเปิด (H0001)
('DEF202600001','RND0001','ELECTRICAL', 'ปลั๊กไฟหลวม เสียบแล้วไม่แน่น',      'ห้องนอน 2 ผนังทิศเหนือ', 'WAITING_ASSIGN','INSPECTOR','EMP0003',NULL,     NULL,     NULL,              NULL,        NULL,              NULL,     NULL,              0,'2026-10-22 09:40'),
('DEF202600002','RND0001','PLUMBING',   'ก๊อกอ่างล้างหน้ามีน้ำหยด',          'ห้องน้ำชั้น 2',          'ASSIGNED',      'INSPECTOR','EMP0003','EMP0006',NULL,     '2026-10-23 08:30',NULL,        NULL,              NULL,     NULL,              0,'2026-10-22 09:55'),
('DEF202600003','RND0001','WALL',       'ผนังมีรอยร้าวแนวทแยงยาวประมาณหนึ่งคืบ','ห้องนั่งเล่น ผนังข้างบันได','FIXED',     'INSPECTOR','EMP0003','EMP0007',NULL,     '2026-10-23 09:00',NULL,        '2026-10-27 16:00',NULL,     NULL,              0,'2026-10-22 10:10'),
('DEF202600004','RND0001','CEILING',    'ฝ้ามีคราบน้ำเป็นวง',                'ห้องนอน 1 มุมหน้าต่าง',  'REWORK',        'INSPECTOR','EMP0003','EMP0010',NULL,     '2026-10-23 09:20',NULL,        '2026-10-26 15:00',NULL,     NULL,              1,'2026-10-22 10:25'),
('DEF202600005','RND0001','DOOR_WINDOW','บานเลื่อนระเบียงฝืด ปิดไม่สนิท',    'ระเบียงชั้น 2',          'VERIFIED',      'INSPECTOR','EMP0003','EMP0011',NULL,     '2026-10-23 10:00',NULL,        '2026-10-25 11:00','EMP0003','2026-10-28 10:00',0,'2026-10-22 10:40'),
-- RND0002 รอบ QC รอตรวจซ้ำ (H0002) ทุกจุด VERIFIED
('DEF202600006','RND0002','FLOOR',      'กระเบื้องพื้นโก่ง 2 แผ่น',           'ห้องครัว',              'VERIFIED',      'INSPECTOR','EMP0004','EMP0009',NULL,     '2026-10-23 08:30',NULL,        '2026-10-29 17:00','EMP0004','2026-11-02 10:00',0,'2026-10-22 13:30'),
('DEF202600007','RND0002','ELECTRICAL', 'สวิตช์ไฟโถงบันไดกดไม่ติด',         'โถงบันไดชั้น 1',         'VERIFIED',      'INSPECTOR','EMP0004','EMP0005',NULL,     '2026-10-23 09:00',NULL,        '2026-10-30 14:00','EMP0004','2026-11-03 09:30',1,'2026-10-22 13:45'),
-- รอบ QC ที่ปิดแล้ว
('DEF202600008','RND0003','WALL',       'สีผนังด่าง',                       'ห้องนอน 3',             'VERIFIED',      'INSPECTOR','EMP0003','EMP0007',NULL,     '2026-09-04 09:00',NULL,        '2026-09-10 16:00','EMP0003','2026-09-12 10:00',0,'2026-09-03 10:00'),
('DEF202600009','RND0004','PLUMBING',   'ชักโครกกดแล้วน้ำไหลไม่หยุด',        'ห้องน้ำชั้น 1',          'VERIFIED',      'INSPECTOR','EMP0004','EMP0006',NULL,     '2026-08-18 09:00',NULL,        '2026-08-20 15:00','EMP0004','2026-08-22 10:00',0,'2026-08-17 10:00'),
-- RND0011 รอบตรวจก่อนรับมอบที่ยังเปิด (H0006) — ลูกค้า/บริษัทนอกแจ้ง
('DEF202600010','RND0011',NULL,         'น้ำซึมบริเวณขอบอ่างอาบน้ำ',         'ห้องน้ำชั้น 2',          'NEW',           'CUSTOMER', NULL,     NULL,     NULL,     NULL,              NULL,        NULL,              NULL,     NULL,              0,'2026-11-03 16:30'),
('DEF202600011','RND0011',NULL,         'รอยต่อวงกบประตูหลังมีช่องแสงลอด',    'ประตูหลังบ้าน',          'NEW',           'EXTERNAL', NULL,     NULL,     NULL,     NULL,              NULL,        NULL,              NULL,     NULL,              0,'2026-11-03 16:40'),
('DEF202600012','RND0011','FLOOR',      'ยาแนวกระเบื้องหลุดเป็นแนว',         'ระเบียงชั้น 2',          'WAITING_ASSIGN','CUSTOMER', NULL,     NULL,     'EMP0008',NULL,              '2026-11-12',NULL,              NULL,     NULL,              0,'2026-11-03 16:45'),
('DEF202600013','RND0011','ELECTRICAL', 'ไฟเพดานห้องครัวกะพริบ',             'ห้องครัว',              'FIXED',         'CUSTOMER', NULL,     'EMP0005','EMP0008','2026-10-29 09:00','2026-11-04','2026-10-30 15:00',NULL,     NULL,              0,'2026-10-28 10:30'),
('DEF202600014','RND0011','PLUMBING',   'ท่อใต้ซิงก์ครัวซึม',                'ห้องครัว ใต้ซิงก์',       'REWORK',        'EXTERNAL', NULL,     'EMP0006','EMP0008','2026-10-29 09:30','2026-11-04','2026-10-31 11:00',NULL,     NULL,              1,'2026-10-28 10:45'),
-- RND0012, RND0013 รอบตรวจก่อนรับมอบที่ปิดแล้ว (ลูกค้ายืนยัน: verified_by = NULL ตาม Q17.6)
('DEF202600015','RND0012','WALL',       'ผนังห้องนอนมีรอยร้าวเล็ก',          'ห้องนอน 1',             'VERIFIED',      'CUSTOMER', NULL,     'EMP0007','EMP0008','2026-10-07 09:00','2026-10-14','2026-10-16 15:00',NULL,     '2026-10-20 15:00',1,'2026-10-06 13:30'),
('DEF202600016','RND0012','DOOR_WINDOW','มุ้งลวดหน้าต่างขาด',               'ห้องนอน 2',             'VERIFIED',      'EXTERNAL', NULL,     'EMP0011','EMP0008','2026-10-07 09:10','2026-10-14','2026-10-09 11:00',NULL,     '2026-10-20 15:00',0,'2026-10-06 13:45'),
('DEF202600017','RND0013','CEILING',    'ฝ้าห้องน้ำมีคราบน้ำ',               'ห้องน้ำชั้น 2',          'VERIFIED',      'CUSTOMER', NULL,     'EMP0010','EMP0008','2026-10-02 09:00','2026-10-09','2026-10-20 15:00',NULL,     '2026-10-25 11:00',1,'2026-10-01 10:00');

-- ---------- T08 repair_report ----------
INSERT INTO repair_report (report_id, round_id, created_by, title, created_at) VALUES
('RPT00001','RND0011','EMP0003','เอกสารสรุปการซ่อม H0006 ฉบับที่ 1','2026-11-01 10:00'),
('RPT00002','RND0012','EMP0004','เอกสารสรุปการซ่อม H0007 ฉบับที่ 1','2026-10-10 10:00'),
('RPT00003','RND0012','EMP0004','เอกสารสรุปการซ่อม H0007 ฉบับที่ 2','2026-10-17 10:00'),
('RPT00004','RND0013','EMP0003','เอกสารสรุปการซ่อม H0008 ฉบับที่ 1','2026-10-12 10:00'),
('RPT00005','RND0013','EMP0003','เอกสารสรุปการซ่อม H0008 ฉบับที่ 2','2026-10-21 10:00');

-- ---------- T07 file (เจ้าของ 1 ตัวพอดี: defect / repair_report / property_unit) ----------
INSERT INTO file (file_id, unit_id, defect_id, report_id, file_url, file_usage, uploaded_at) VALUES
('FIL000001',NULL,   'DEF202600001',NULL,      'https://storage.example.com/demo/defect/DEF202600001-before.jpg','BEFORE_FIX', '2026-10-22 09:41'),
('FIL000002',NULL,   'DEF202600002',NULL,      'https://storage.example.com/demo/defect/DEF202600002-before.jpg','BEFORE_FIX', '2026-10-22 09:56'),
('FIL000003',NULL,   'DEF202600003',NULL,      'https://storage.example.com/demo/defect/DEF202600003-before.jpg','BEFORE_FIX', '2026-10-22 10:11'),
('FIL000004',NULL,   'DEF202600003',NULL,      'https://storage.example.com/demo/defect/DEF202600003-after.jpg', 'AFTER_FIX',  '2026-10-27 15:55'),
('FIL000005',NULL,   'DEF202600004',NULL,      'https://storage.example.com/demo/defect/DEF202600004-before.jpg','BEFORE_FIX', '2026-10-22 10:26'),
('FIL000006',NULL,   'DEF202600004',NULL,      'https://storage.example.com/demo/defect/DEF202600004-after.jpg', 'AFTER_FIX',  '2026-10-26 14:55'),
('FIL000007',NULL,   'DEF202600005',NULL,      'https://storage.example.com/demo/defect/DEF202600005-before.jpg','BEFORE_FIX', '2026-10-22 10:41'),
('FIL000008',NULL,   'DEF202600005',NULL,      'https://storage.example.com/demo/defect/DEF202600005-after.jpg', 'AFTER_FIX',  '2026-10-25 10:55'),
('FIL000009',NULL,   'DEF202600010',NULL,      'https://storage.example.com/demo/defect/DEF202600010-before.jpg','BEFORE_FIX', '2026-11-03 16:31'),
('FIL000010',NULL,   'DEF202600011',NULL,      'https://storage.example.com/demo/defect/DEF202600011-before.jpg','BEFORE_FIX', '2026-11-03 16:41'),
('FIL000011',NULL,   'DEF202600013',NULL,      'https://storage.example.com/demo/defect/DEF202600013-before.jpg','BEFORE_FIX', '2026-10-28 10:31'),
('FIL000012',NULL,   'DEF202600013',NULL,      'https://storage.example.com/demo/defect/DEF202600013-after.jpg', 'AFTER_FIX',  '2026-10-30 14:55'),
('FIL000013',NULL,   'DEF202600014',NULL,      'https://storage.example.com/demo/defect/DEF202600014-before.jpg','BEFORE_FIX', '2026-10-28 10:46'),
('FIL000014',NULL,   'DEF202600014',NULL,      'https://storage.example.com/demo/defect/DEF202600014-after.jpg', 'AFTER_FIX',  '2026-10-31 10:55'),
('FIL000015',NULL,   NULL,          'RPT00001','https://storage.example.com/demo/report/RPT00001.pdf',            'SUMMARY_PDF','2026-11-01 10:01'),
('FIL000016',NULL,   NULL,          'RPT00002','https://storage.example.com/demo/report/RPT00002.pdf',            'SUMMARY_PDF','2026-10-10 10:01'),
('FIL000017',NULL,   NULL,          'RPT00003','https://storage.example.com/demo/report/RPT00003.pdf',            'SUMMARY_PDF','2026-10-17 10:01'),
('FIL000018',NULL,   NULL,          'RPT00004','https://storage.example.com/demo/report/RPT00004.pdf',            'SUMMARY_PDF','2026-10-12 10:01'),
('FIL000019',NULL,   NULL,          'RPT00005','https://storage.example.com/demo/report/RPT00005.pdf',            'SUMMARY_PDF','2026-10-21 10:01'),
('FIL000020','H0008',NULL,          NULL,      'https://storage.example.com/demo/signature/H0008.png',            'SIGNATURE',  '2026-10-30 13:58');

-- ---------- T09 access_link (token = SHA-256 ของข้อความสมมติ, 64 ตัวอักษร) ----------
-- expires_at อ้างอิงเวลาที่รัน (now() ± interval) เพื่อให้ลิงก์ที่ใช้ได้ยังใช้ได้ และลิงก์หมดอายุยังหมดอายุ ไม่ว่าจะรันวันไหน (G1 m8)
INSERT INTO access_link (link_id, unit_id, customer_id, token, expires_at, created_by, created_at) VALUES
('LNK000001','H0004','CUS0001','c4998ab63c6659269b380ef9a5a5c1cf89235c677e673885385a26e2d3535542',now() + INTERVAL 28 DAY,'EMP0002','2026-11-04 17:00'),
('LNK000002','H0005','CUS0002','c8a28fe9afb79af3da3819ca941151e454008f4c2f9131e16055e98d2726aa13',now() - INTERVAL 5 DAY,'EMP0002','2026-09-20 12:00'),  -- หมดอายุแล้ว (alt Q10.1)
('LNK000003','H0005','CUS0002','12f6cde8e58ca865feb44a292a3cd27b0cd696b81312d6340099eb7955fea5ca',now() + INTERVAL 25 DAY,'EMP0002','2026-11-01 18:00'),  -- ออกใหม่ด้วย Q09.5
('LNK000004','H0006','CUS0003','5427c59eeda33f103797695e2905c4d9359cddcbca325d6af33a08997d35d377',now() + INTERVAL 12 DAY,'EMP0001','2026-10-19 11:00'),
('LNK000005','H0007','CUS0004','e11dcdefdc209422913c890e730fb6f903f92105bcab43873b92e539fb55689e',now() + INTERVAL 20 DAY,'EMP0001','2026-09-28 09:00'),
('LNK000006','H0008','CUS0005','8c351ad33fe5be5bf7f550705a3a3fade69bc04641415dafa10c9437897071b9',now() + INTERVAL 14 DAY,'EMP0002','2026-09-21 10:00'),
('LNK000007','H0009','CUS0006','504fbb1d18fcd61fbb2f1381051ea3007224bafed6a9f08980c5b907f0920e06',now() + INTERVAL 19 DAY,'EMP0002','2026-10-26 15:00'),
('LNK000008','H0010','CUS0007','aa1f8bb5b0f5d488fa9aca24618380b2fdb44bd283d32f3f60e63e4aafa25523',now() + INTERVAL 27 DAY,'EMP0001','2026-11-03 13:00');

-- ---------- ขยับ sequence ให้ต่อจากข้อมูลตัวอย่าง (ID ถัดไปจะไม่ชน) ----------
ALTER SEQUENCE seq_employee RESTART WITH 12;
ALTER SEQUENCE seq_customer RESTART WITH 8;
ALTER SEQUENCE seq_unit RESTART WITH 11;
ALTER SEQUENCE seq_round RESTART WITH 14;
ALTER SEQUENCE seq_request RESTART WITH 6;
ALTER SEQUENCE seq_defect RESTART WITH 18;
ALTER SEQUENCE seq_file RESTART WITH 21;
ALTER SEQUENCE seq_report RESTART WITH 6;
ALTER SEQUENCE seq_link RESTART WITH 9;

COMMIT;
