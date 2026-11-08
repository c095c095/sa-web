# ข้อปรับทางเทคนิคเพื่อรับที่ G1

สถานะ: ข้อเสนอที่พิสูจน์ใน P1 แล้วบางส่วน รอผู้ใช้ตรวจรับก่อนใช้เป็น baseline ของ P2–P5

ขอบเขตธุรกิจยังเป็น CONTRACT v0.3.3: 4 actors, 18 UC, 19 SCR และ 9 ตารางธุรกิจ ไม่มีการแก้ไฟล์ SA เดิม SQL สำหรับแอปอยู่ใน db/ แยกจาก SQL PostgreSQL/PGlite ต้นฉบับ

| รหัส | ข้อปรับที่เสนอ | สิ่งที่ทำ/ตรวจจริงใน P1 | สิ่งที่จะทำหลังรับ G1 |
|---|---|---|---|
| AM-01 | เพิ่ม `inspection_round.inspection_finished_at DATETIME(6) NULL` เป็น marker ว่า finishInspection แล้ว ไม่ใช้ round CLOSED แทน | candidate schema มีคอลัมน์; ทดสอบเขียน marker และ guarded edit แล้วแก้หลัง finish ไม่ได้ | ตรวจ marker ฝั่ง server ทุก edit/delete ใน UC-02 และคงอยู่หลัง reload; ยังไม่เพิ่ม state ธุรกิจใหม่ |
| AM-02 | บังคับ role/is_active/category และสถานะเมื่อรับงาน ไม่พึ่งตัวกรองคิวอย่างเดียว | ทดสอบ direct claim ข้ามประเภทถูกปฏิเสธ; สอง connection รับงานเดียวกันสำเร็จหนึ่งราย | service ตรวจ role/craft และใช้ guarded UPDATE ภายใน transaction ทุกครั้ง |
| AM-03 | ทุกคำขอลูกค้าต้อง derive unit/customer จาก access link และตรวจ resource chain | ทดสอบ token บ้านอื่นกับ defect ID แล้วไม่พบข้อมูล และ token บ้านที่ถูกต้องพบได้ | ใช้ guard กลางกับ request/round/defect/file/report ทุก read และ mutation; ไม่รับ customer_id/unit_id จาก browser เป็นสิทธิ์ |
| AM-04 | session แบบ opaque cookie และ link token เก็บ digest แทน raw token | P1 ยังไม่มี login/link exchange, session cookie หรือ session table; fixture ใช้ token สมมติเดิมเพื่อพิสูจน์ query parity | เพิ่ม 1 ตารางเทคนิค `app_session` ตามรายละเอียดด้านล่าง; เก็บ token SHA-256 digest, revoke logout ได้ และตรวจ employee/link ทุก sensitive request |
| AM-05 | แปลง PostgreSQL schema เป็น MariaDB โดยคงรหัสและความหมาย | 9 enum-bearing business tables, 9 sequences จำกัด MAXVALUE, 2 generated unique keys; 77 query compile/execute; Q02.8 แปลง DELETE USING เป็น joined DELETE; INSERT RETURNING ใช้ได้บน MariaDB 10.11.16 จริง | ล็อก migration และ adapter สำหรับ target นี้; ไม่อ้างว่า portable ไป Oracle MySQL โดยไม่ทดสอบ |
| AM-06 | ทำ CHECK ที่ nullable ให้บังคับตามข้อความ contract จริง | COMPLETED + NULL accept_result และ CLOSED QC + NULL recheck_result ถูก DB ปฏิเสธ; ไม่อาศัย CHECK UNKNOWN | ใช้ server validation ซ้ำและ tests คงไว้; ไม่มีการเปลี่ยนผลธุรกิจจากข้อกำหนดที่อนุมัติ |

## ข้อเสนอ session ที่ตรวจรับได้

`app_session` เป็นตารางเทคนิคเพิ่มจาก 9 ตารางธุรกิจ ไม่ใช่ actor/UC ใหม่ มีคอลัมน์เสนอ:

- `session_id CHAR(64)` เป็น digest ของ random token ไม่เก็บ token ใช้จริง
- `session_kind` เป็น EMPLOYEE หรือ CUSTOMER
- `employee_id` หรือ `link_id` ต้องมีอย่างใดอย่างหนึ่งตาม session_kind พร้อม FK
- `created_at`, `expires_at`, `revoked_at` เป็นเวลาที่เก็บแบบ UTC
- อายุ session เสนอ 8 ชั่วโมงสำหรับ local demo; ฝั่งลูกค้าต้องไม่เกิน expires_at ของ access link อายุ 30 วันเดิม

cookie เป็น HttpOnly, SameSite=Lax, path=/, Secure เมื่อใช้ HTTPS; ยกเว้น Secure เฉพาะ localhost ที่ใช้ HTTP ในงานสาธิต Logout revoke session บน server และล้าง cookie ไม่พึ่งการลบ cookie อย่างเดียว

ลิงก์ลูกค้า: สุ่ม token 32 bytes → ส่ง raw token ในลิงก์ → เก็บ SHA-256 digest 64 ตัวใน `access_link.token` → hash token ที่รับเข้าก่อน query เมื่อตรวจลิงก์ผ่านจึง exchange เป็น cookie และ redirect ไป URL ที่ไม่มี token ใช้ no-referrer และไม่ log token

การป้องกัน: ตรวจ Origin ของ mutation, แยก session พนักงาน/ลูกค้า, ตรวจ employee.is_active/role จาก DB, ตรวจ link expiry และ scope ซ้ำทุก request ที่เกี่ยวข้อง รหัสพนักงานเป็น seed ไม่มีหน้า admin สร้างพนักงานเพิ่ม

login throttling เสนอให้มีสำหรับ local demo โดยคีย์ผสมบัญชี/IP และข้อความผิดพลาดไม่เปิดเผยว่ามีบัญชีหรือไม่ การรองรับหลาย instance/production ต้องวาง rate-limit store เพิ่มใน scope ภายหลัง ไม่อ้างว่าทำแล้ว

## นโยบายไฟล์ที่เสนอสำหรับ P2

- ภาพ JPEG/PNG/WebP ไม่เกิน 5 MB ต่อรูป เป็นขีดจำกัดที่เสนอ ไม่ใช่ตัวเลขจากข้อมูลธุรกิจ
- ตรวจ signature/MIME ของเนื้อไฟล์จริง ชื่อและ path สุ่มจาก server ไม่ใช้ path ที่ผู้ส่งระบุ
- เก็บไฟล์นอก public/ และดาวน์โหลดผ่าน handler ที่ตรวจ resource scope
- staging → DB metadata transaction → finalize พร้อม cleanup เมื่อขั้นใดล้มเหลว
- ไฟล์ PDF/ลายเซ็นมี usage/owner ตาม contract และมีรายงานการกู้คืนไฟล์กำพร้า
- URL metadata ยังมีรูปแบบ http(s) และยาวไม่เกิน 255 ตาม schema; สร้างจาก APP_URL ที่กำหนดไว้ ไม่รับ URL ภายนอกอิสระจากผู้ส่ง

## สิ่งที่ไม่ได้เปลี่ยน

หัวหน้าช่างเป็น role ใน actor ช่าง; ลูกค้า/บริษัทตรวจนอกเป็น actor เดียว; ลิงก์อายุ 30 วัน; ข้ามการตรวจไปเซ็นได้ตาม UC-10/18; ไม่เพิ่ม NO_SHOW; UC-08 ไม่มีบริการ notification ใหม่

ผล P1 ใน evidence/db-compatibility.json เป็นการทดสอบ DB/driver จริงกับ fixture สมมติ ไม่ใช่หลักฐานว่าแอปครบ 18 UC หรือผ่าน E2E แล้ว
