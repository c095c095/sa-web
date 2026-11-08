# หน้าแรก คิวงาน และรายงาน

- Autodesk แสดงงานที่ได้รับมอบหมาย สถานะ และกิจกรรมล่าสุดพร้อมลิงก์ไปยังงาน ในระบบนี้ใช้กฎ `journey` คำนวณยอดงานฝ่ายขายและ QC ตามสิทธิ์ และใช้คิวที่ระบบโหลดให้ช่างอยู่แล้ว [Autodesk Project Home](https://help.autodesk.com/cloudhelp/ENU/Build-Hub/files/Project_Home.html)
- Procore แยกการค้นหากับตัวกรองตามบริบท และให้ดูหลักฐานกับประวัติในรายละเอียดตรวจ ในระบบนี้ตัวกรองบ้านใช้โครงการและสถานะ ส่วนคิวช่างใช้หมวดและสถานะงาน ค่าตัวกรองติดไปกับลิงก์รายละเอียดและลิงก์กลับ [Procore Inspection Filters](https://support.procore.com/products/online/user-guide/project-level/inspections/tutorials/search-and-filter-for-inspections) · [Procore Perform an Inspection](https://support.procore.com/products/online/user-guide/project-level/inspections/tutorials/perform-an-inspection)
- Autodesk แยกสรุปตามสถานะออกจากรายละเอียดและรูป ในระบบนี้หน้ารายงานแสดงจุดค้างและความพร้อมก่อนสร้าง PDF และหน้าเช็กสถานะให้กรองตามสถานะหรือหมวด พร้อมหลักฐานและเอกสารที่ผู้ใช้มีสิทธิ์เปิด [Autodesk Issue Reports](https://help.autodesk.com/cloudhelp/ENU/Docs-Reports/files/report-types/Issue_Reports.html)
- GOV.UK ให้ผู้ใช้ทบทวนข้อมูลก่อนยืนยันและเห็นขั้นตอนถัดไป ระบบนี้เพิ่มขั้นทบทวนสำหรับคำขอตรวจ นัดหมาย และการแจ้งจุดก่อนรับมอบ [GOV.UK Check Answers](https://design-system.service.gov.uk/patterns/check-answers/) · [GOV.UK Confirmation Pages](https://design-system.service.gov.uk/patterns/confirmation-pages/)

## ขอบเขตข้อมูล

หน้าสรุปใช้ข้อมูลในฐานปัจจุบัน ยอดงานหน้าแรกนับบ้านหรือจุดตามประเภทคิว ยอดแอดมินที่ลิงก์ไปหน้าบ้านนับบ้านที่มีจุดค้าง ข้อมูลลิงก์ลูกค้าที่ฝ่ายขายเห็นเป็นสถานะและวันหมดอายุจากระเบียนล่าสุด ลิงก์แชร์ยังออกผ่านขั้นตอนออกลิงก์ตามสิทธิ์

## การตรวจรับ

- หน้าแรกและดัชนีงานตรวจยอดกับรายการที่ผู้ใช้มีสิทธิ์เปิด
- ทดสอบค้นหา กรอง เปิดรายละเอียด ย้อนกลับ และล้างตัวกรอง
- ทดสอบคำขอและการแจ้งจุดตั้งแต่ทบทวนจนถึงส่งจริง รวมถึงวันนัดเวลาไทย
- ทดสอบคิวช่าง ตรวจซ้ำ ปิด QC รายงาน PDF หลักฐาน และการรับมอบผ่านข้อมูลสมมติ
- ตรวจสิทธิ์ข้ามบทบาทและลิงก์ลูกค้า ตรวจคีย์บอร์ดและความกว้างมือถือ พร้อมรัน typecheck, lint และ production build

ผลบนฐานข้อมูลสมมติแยกใน workspace

| ชุดตรวจ | ผล |
| --- | --- |
| API และสิทธิ์เข้าถึง | ผ่าน 35 เคส |
| Workflow ผ่าน Edge | ผ่าน 17 เคส ตรวจ layout 152 ครั้ง และไม่พบข้อผิดพลาด JavaScript |
| ดัชนีหน้าคิว | ผ่าน 18 เคส |
| หน้าจอและการเข้าถึง | สแกน 38 ครั้ง ไม่พบข้อผิดพลาดจาก axe |
| แอดมินและบัญชี | ผ่าน 21 เคส สแกน 18 ครั้ง |
| Typecheck, ESLint ไฟล์ที่แก้, production build และ named routes | ผ่าน |
