-- Extra examples for the isolated demo database.
INSERT INTO project (project_name)
SELECT DISTINCT project_name FROM property_unit;
UPDATE property_unit u JOIN project p ON p.project_name=u.project_name
SET u.project_id=p.project_id;

INSERT INTO employee(employee_id, full_name, role, password_hash)
VALUES ('ADMIN','ผู้ดูแลระบบสาธิต','ADMIN','demo-setup-pending');
UPDATE app_control SET setup_finished_at=NOW(6) WHERE control_id=1;

-- A second open customer round starts with all repair work ready for reporting.
INSERT INTO customer(customer_id, id_card_no, full_name, phone_number, email)
VALUES ('CUS0008','1100000000088','พิมพ์ชนก บ้านตัวอย่าง','0898765408','demo.handover@example.com');
INSERT INTO property_unit(unit_id, project_id, project_name, house_no, unit_type, status, customer_id, registered_by, created_at)
SELECT 'H0011',project_id,project_name,'19/12','ทาวน์โฮม 2 ชั้น','IN_INSPECTION','CUS0008','EMP0001','2026-09-01 03:00'
FROM project WHERE project_name='ชลธาร ทาวน์โฮม';
INSERT INTO inspection_request(request_id, unit_id, customer_id, preferred_date, appointment, arrival, status, created_at)
VALUES ('REQ000006','H0011','CUS0008','2026-10-28','2026-10-28 03:00','2026-10-28 03:05','IN_PROGRESS','2026-10-25 04:00');
INSERT INTO inspection_round(round_id, unit_id, round_type, request_id, status, started_at)
VALUES ('RND0014','H0011','CUSTOMER_HANDOVER','REQ000006','OPEN','2026-10-28 03:05');
INSERT INTO defect(defect_id, round_id, category, description, location_pin, status, reported_by_type, technician_id, assigned_by, assigned_date, target_date, completed_date, created_at)
VALUES ('DEF202600018','RND0014','WALL','ซ่อมผนังไม้ด้านหน้าและเก็บผิวภายนอก','ผนังหน้าบ้าน','FIXED','CUSTOMER','EMP0007','EMP0008','2026-10-29 02:00','2026-11-05','2026-11-04 03:00','2026-10-28 03:20');
ALTER SEQUENCE seq_customer RESTART WITH 9;
ALTER SEQUENCE seq_unit RESTART WITH 13;
ALTER SEQUENCE seq_request RESTART WITH 7;
ALTER SEQUENCE seq_round RESTART WITH 16;
ALTER SEQUENCE seq_defect RESTART WITH 19;

-- Match descriptions to the subjects of the source photographs.
UPDATE defect SET category='WALL',description='ผิวไม้ด้านหน้าหลุดล่อนและต้องเก็บงาน',location_pin='ผนังหน้าบ้าน' WHERE defect_id='DEF202600001';
UPDATE defect SET description='ท่อน้ำพลาสติกมีน้ำซึมตามจุดต่อ',location_pin='แนวท่อน้ำข้างบ้าน' WHERE defect_id IN ('DEF202600002','DEF202600014');
UPDATE defect SET description='ผนังไม้ด้านหน้าเสื่อมสภาพ ต้องซ่อมและเก็บผิว',location_pin='ผนังหน้าบ้าน' WHERE defect_id IN ('DEF202600003','DEF202600015');
UPDATE defect SET category='WALL',technician_id='EMP0007',description='ผิวไม้รอบเฉลียงทรุดโทรม',location_pin='เฉลียงหน้าบ้าน' WHERE defect_id='DEF202600005';
UPDATE defect SET description='ฝ้าเพดานมีความชื้นและสีเริ่มล่อน',location_pin='ฝ้าเหนือทางเดิน' WHERE defect_id='DEF202600010';
UPDATE inspection_request SET accept_reason='ท่อน้ำข้างบ้านยังซึม และพบจุดใหม่เพิ่ม' WHERE request_id='REQ000002';

-- Dedicated examples for active / expired / revoked customer links.
UPDATE access_link SET revoked_at=NOW(6)-INTERVAL 2 DAY WHERE link_id='LNK000008';
INSERT INTO access_link(unit_id, customer_id, token, expires_at, created_by)
VALUES ('H0011','CUS0008',SHA2('demo-setup-pending',256),NOW(6)+INTERVAL 30 DAY,'EMP0001');

-- Replace legacy fixture files that pointed at an example domain.
DELETE FROM file;
DELETE FROM repair_report WHERE report_id NOT IN ('RPT00003','RPT00005');
UPDATE repair_report SET title='สรุปการซ่อมบ้าน 19/8 · ตัวอย่าง' WHERE report_id='RPT00003';
UPDATE repair_report SET title='สรุปการซ่อมบ้าน 19/9 · ตัวอย่าง' WHERE report_id='RPT00005';

-- Management views show both active records and examples in the archive.
INSERT INTO project(project_name,is_active) VALUES('สวนลม เรสซิเดนซ์',FALSE);
INSERT INTO property_unit(unit_id,project_id,project_name,house_no,unit_type,status,registered_by,created_at,archived_at,archive_reason)
SELECT 'H0012',project_id,project_name,'52/1','บ้านเดี่ยว 2 ชั้น','READY_TO_SELL','EMP0001','2026-09-01 03:00',NOW(6)-INTERVAL 2 DAY,'เก็บข้อมูลบ้านตัวอย่างหลังปิดโครงการ'
FROM project WHERE project_name='สวนลม เรสซิเดนซ์';
INSERT INTO inspection_round(round_id,unit_id,round_type,inspector_id,is_single_certify,recheck_date,recheck_result,status,started_at,closed_at)
VALUES('RND0015','H0012','QC_INTERNAL','EMP0003',TRUE,'2026-10-04','NO_DEFECT','CLOSED','2026-09-28 02:00','2026-10-04 08:00');
INSERT INTO audit_event(actor_id,actor_kind,actor_name,action_name,entity_type,entity_id,after_values,reason,created_at)
VALUES ('ADMIN','EMPLOYEE','ผู้ดูแลระบบสาธิต','เก็บบ้านเข้าคลัง','unit','H0012',JSON_OBJECT('archived',TRUE),'เก็บข้อมูลบ้านตัวอย่างหลังปิดโครงการ',NOW(6)-INTERVAL 2 DAY),
       ('ADMIN','EMPLOYEE','ผู้ดูแลระบบสาธิต','เพิกถอนลิงก์ลูกค้า','link','LNK000008',JSON_OBJECT('revoked',TRUE),'ลิงก์เดิมหมดความจำเป็น',NOW(6)-INTERVAL 2 DAY);
