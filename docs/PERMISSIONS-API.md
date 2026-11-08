# สิทธิ์และ API contract สำหรับพัฒนาหลัง G1

สถานะ: แบบสำหรับตรวจรับ ยังไม่ได้เปิด mutation endpoints ใน P1 ทุก path ด้านล่างเป็นเส้นทางที่เสนอ ส่วนที่รันได้ตอนนี้มีเพียง /pilot/technician, /pilot/report และ /pilot/status ซึ่งอ่าน fixture เฉพาะและไม่มี POST

หลักร่วม: identity มาจาก session เท่านั้น; ฝั่งลูกค้า derive unit/customer จาก link, ตรวจ expiry และ resource chain; ตรวจ input ฝั่ง server; UPDATE/DELETE มี status guard และ transaction; ไม่ถือว่าซ่อนปุ่มเป็นการบังคับสิทธิ์

| UC/SCR | ผู้มีสิทธิ์ | Endpoint ที่เสนอ | การตรวจเพิ่มก่อนเปลี่ยนข้อมูล |
|---|---|---|---|
| SCR-00 | employee active | POST /api/auth/login; POST /api/auth/logout | password hash จริง, throttle, rotate/revoke session |
| UC-01 | SALES | POST /api/units | บ้านโครงการ/เลขที่ไม่ซ้ำ; registered_by จาก session |
| UC-02 | INSPECTOR | GET/POST /api/units/:id/qc/defects; PATCH/DELETE /api/defects/:id; POST /api/rounds/:id/finish | IN_QC, QC round ยังเปิด, finish marker, defect WAITING_ASSIGN, ผู้ตรวจตาม scope |
| UC-03 | TECHNICIAN / HEAD_TECHNICIAN | GET /api/technician/jobs?view=queue; POST /api/technician/jobs/accept | craft ตรงหรือ head ดูแลทุกประเภท; WAITING_ASSIGN; recheck ใน transaction |
| UC-04 | TECHNICIAN / HEAD_TECHNICIAN | GET /api/technician/jobs?view=mine; POST /api/defects/:id/repair | technician_id ตรง session, ASSIGNED/REWORK; รูปหลังซ่อมของรอบซ่อมล่าสุดอย่างน้อย 1 |
| UC-05 | INSPECTOR | POST /api/defects/:id/review | FIXED ใน QC round; อนุมัติหรือส่งกลับตาม method |
| UC-06 | INSPECTOR | POST /api/rounds/:id/recheck | schedule เมื่อทุกจุด VERIFIED; ผลพบจุด/ไม่พบจุดตาม guards |
| UC-07 | INSPECTOR | POST /api/rounds/:id/close | NO_DEFECT, co-inspector XOR single-certify; ผู้ตรวจร่วมไม่ใช่คนเดิม |
| UC-08 | INSPECTOR | POST /api/units/:id/ready-sale | QC round CLOSED, unit IN_QC; ไม่สร้าง notification |
| UC-09 | SALES | POST /api/units/:id/access-links | ผูก customer ถูกบ้าน, READY_TO_SELL→CONTRACTED; token random/digest, 30 วัน |
| UC-10 | CUSTOMER session | GET /api/customer/home; POST /api/customer/inspection-choice | token/context ถูกต้อง; ไม่ต้องการตรวจเปลี่ยน CONTRACTED→READY_HANDOVER |
| UC-11 | CUSTOMER session | POST /api/customer/requests | customer และ unit จาก link; requested_by=NULL; ป้องกันคำขอซ้ำ |
| UC-12 | SALES | POST /api/units/:id/requests | customer/unit สอดคล้อง, requested_by จาก session, unit CONTRACTED |
| UC-13 | SALES | PATCH /api/requests/:id/appointment; POST /api/requests/:id/arrival | status เดิมถูกต้อง, มาแล้วเปิดรอบได้เพียงหนึ่ง, ผิดนัดเลื่อนใน request เดิม |
| UC-14 | CUSTOMER session | POST /api/customer/defects | CUSTOMER_HANDOVER round OPEN ในบ้านตาม link; reported_by CUSTOMER/EXTERNAL; upload ตรวจสิทธิ์ |
| UC-15 | HEAD_TECHNICIAN เท่านั้น | PATCH /api/defects/:id/category | NEW→WAITING_ASSIGN, ประเภท enum ที่ถูกต้อง; ไม่เพิ่ม actor |
| UC-16 | INSPECTOR | POST /api/rounds/:id/reports | รอบที่ซ่อมครบและเป็นไปตาม contract; generate PDF สำเร็จจึงบันทึกผล |
| UC-17 | CUSTOMER session | GET /api/customer/repairs; POST /api/customer/acceptance | บ้านตาม link; เลือกไม่ผ่านได้เฉพาะ FIXED, เหตุผลเมื่อไม่ผ่าน; accept ทุกจุดพร้อม, update request/round/unit atomic |
| UC-18 | CUSTOMER session | POST /api/customer/handover | READY_HANDOVER; signature owner เป็น unit; หนึ่ง signature ต่อบ้าน; HANDED_OVER+timestamp atomic |

GET/download file ต้องไล่ owner จาก file → defect/round หรือ report/round หรือ unit เสมอ ไม่เปิดด้วย file ID อย่างเดียว กรณี scope ไม่ตรงให้ตอบเหมือนหา resource ไม่พบ และไม่คืนรายละเอียดของบ้านอื่น

Error contract เสนอ `{ error: { code, message, fields?, requestId } }` โดยไม่คืน SQL/password/token/internal stack; 401 ไม่ได้ยืนยันตัวตน, 403 role ไม่อนุญาต, 404 resource ไม่อยู่ใน scope, 409 สถานะเปลี่ยน/ถูกผู้อื่นรับแล้ว, 422 validation, 503 DB/storage ไม่พร้อม

นายชวนากรเป็นหัวหน้ากลุ่มรายงาน ไม่ใช่ HEAD_TECHNICIAN ของแอปโดยอัตโนมัติ บัญชีใน P1 เป็นบุคคลสมมติจาก fixture เท่านั้น
