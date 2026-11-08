# ส่วนต่อขยายจาก SA เดิม

Runtime เพิ่มผู้ดูแลระบบเฉพาะและการดูแลบัญชีตามคำขอที่อนุมัติใน website-plan/approval-management.json ไม่แก้ ACT/UC/Q/schema/รายงานต้นฉบับ โดย 18 UC และ 77 Q IDs เดิมยังเป็น business core ส่วนใหม่ใช้รหัส EXT ดังนี้

| รหัส | ความสามารถ/endpoint | ข้อมูลที่เกี่ยวข้อง | หลักฐานหลัก |
|---|---|---|---|
| EXT-ADM-01 | POST /api/setup | employee ADMIN, app_control, app_session, audit_event | ADM-01 |
| EXT-ACC-01 | GET /api/account, POST /api/account/profile | ข้อมูลตนเองใน employee/customer, audit_event | ACC-01, ADM-09 |
| EXT-ACC-02 | POST /api/account/password | employee, เพิกถอน app_session เดิมและออก session ใหม่ | ADM-05, ACC-02, ADM-12 |
| EXT-ACC-03 | POST /api/account/revoke-session | เฉพาะ session ของบัญชี/ลิงก์ตนเอง | ACC-02 |
| EXT-ADM-02 | manage/employee.create, employee.update, employee.reset | employee, app_session, audit_event | ADM-05/06/12/13 |
| EXT-ADM-03 | manage/employee.transfer | defect.technician_id และ audit; คงสถานะ/รูปเดิม | ADM-06 |
| EXT-ADM-04 | manage/project.create, project.update | project, ชื่อแสดงใน property_unit, audit | ADM-03/08 |
| EXT-ADM-05 | manage/unit.create, unit.update, unit.archive | property_unit, project และประวัติเดิม | ADM-04/07 |
| EXT-ADM-06 | manage/customer.create, customer.update | customer, ตรวจสถานะบ้านก่อนแก้ชื่อ | ADM-09 |
| EXT-ADM-07 | manage/unit.customer | property_unit, คำขอ SUBMITTED, access_link, app_session, audit | ADM-11 |
| EXT-ADM-08 | manage/link.create, link.revoke, session.revoke | access_link/app_session/audit | ADM-10/15 |
| EXT-ADM-09 | GET /api/manage?section=... | ทะเบียน/ตัวกรอง/เรียง/แบ่งหน้า/ภาพรวม/audit | ADM-14/15/16 |
| EXT-ADM-10 | GET /api/manage/unit/:id, employee/:id | ประวัติบ้าน/ไฟล์จริง และงานค้าง | ADM-06/16 |
| EXT-UX-01 | /home, task links, context-preserving continuation | read model ตามสิทธิ์ + UC เดิม | UX-01/02 |
| EXT-UX-02 | ลิงก์งานเก่าไม่แทนด้วยงานอื่น | ชี้เฉพาะ selected defect หรือแสดงว่าไม่พบ | UX-03, management-stale-task |

POST ส่วนจัดการ/บัญชีตรวจ Origin, server session, สิทธิ์ และ transaction ไม่อาศัยการซ่อนปุ่มใน browser แอดมินไม่ได้สิทธิ์ดำเนิน UC ตรวจ/ซ่อม/เซ็นตามบทบาทธุรกิจจากการเป็น ADMIN

Migration 003: เพิ่ม ADMIN/บังคับเปลี่ยนรหัส/version ใน employee, version ใน customer, project/archive/version ใน property_unit, revoked_at ใน access_link; เพิ่ม project (ทะเบียนธุรกิจ) และ app_control/audit_event (เทคนิค) รวม 9 ตารางธุรกิจเดิม + project + 3 ตารางเทคนิครวม app_session = 13 base tables

UC-01 เพิ่มการเลือกโครงการที่เปิดรับบ้านใหม่และเก็บ project_id โดยยังรักษาชื่อโครงการ/unique บ้านเดิม ทุก UC ที่ใช้ session รับผลจาก must-change-password และ revocation; การเขียนงานบ้านที่เก็บเข้าคลังถูกปฏิเสธ จึงรัน regression ของ core ใหม่ด้วย

รายงานเก่าเป็น snapshot ที่ออกไว้ ไม่เขียนทับ PDF ที่สร้างแล้วเมื่อแก้ชื่อโครงการ ประวัติการเปลี่ยนชื่ออยู่ใน audit ส่วนการเปลี่ยนลูกค้าหลังเริ่มตรวจถูกปฏิเสธแทนการเขียน FK ทับประวัติ
