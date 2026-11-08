# ระบบตรวจและส่งมอบบ้าน — P1

โปรเจกต์นี้เป็นฐานโค้ดสำหรับเว็บไซต์จริงตาม SA เดิม ขณะนี้เสร็จช่วง foundation/database proof และหน้าทดลองที่ต้องตรวจรับ G1 ยังไม่ได้เปิด login, mutation, upload, PDF หรือครบ 18 UC

## เปิดตรวจรับ

- http://127.0.0.1:3000/pilot/technician — SCR-03 คิวงานช่าง
- http://127.0.0.1:3000/pilot/report — SCR-14 แบบฟอร์มแจ้งจุดและเลือกรูปในอุปกรณ์
- http://127.0.0.1:3000/pilot/status — SCR-17 รายการซ่อมและการเลือกเฉพาะ FIXED

เป็นหน้าทดลองจากโค้ด Next.js และ MariaDB จริง แต่ข้อมูลเป็น fixture สมมติ การทบทวนรายการไม่ส่งหรือบันทึกข้อมูล ไม่ใช้ภาพตัวอย่างเป็นหลักฐานซ่อมบ้านจริง

## เริ่มจากเครื่องนี้

เปิด XAMPP Database ไว้ แล้วใช้ PowerShell ในโฟลเดอร์ `C:/Users/Mocatzy/Documents/Kasetsart/sa/lastest/sa-web`

```powershell
npm ci
npm run build
npm start -- --hostname 127.0.0.1
```

ต้องมี `.env.local` ที่สร้างไว้โดย setup-db และฐานข้อมูล P1 เดิมอยู่แล้ว ห้ามคัดลอกไฟล์นี้ไปเผยแพร่; `.env.example` มีเพียงชื่อค่าที่ต้องใช้ ไม่มีรหัสจริง การรันเว็บไซต์ใช้บัญชี app เฉพาะ ไม่ใช้ root

หากเตรียมสภาพแวดล้อมใหม่และชื่อ DB นี้ยังไม่ถูกใช้:

```powershell
npm run db:generate
npm run db:setup
```

setup สร้างเฉพาะ `sa_web_dev_p1` และ `sa_web_test_p1` กับบัญชี `sa_web_p1` ใช้บัญชีดูแลเฉพาะตอนเตรียม DB; ถ้ามีรหัสผ่านให้กำหนด `SA_DB_ADMIN_PASSWORD` ใน environment โดยไม่เขียนลง source หากพบชื่อ DB/account เดิมที่ไม่มี ownership record จะหยุด ไม่เขียนทับ

`db:setup` ไม่ reset DB ที่มีแล้ว ส่วน `test:db` reset ได้เฉพาะฐาน `sa_web_test_p1` ที่มี ownership record ไม่ใช่ dev/DB อื่น

## ตรวจงาน

```powershell
npm run lint
npm run typecheck
npm run test:db
npm run test:pilot
```

test:db ต้องใช้ MariaDB ที่เปิดอยู่และสิทธิ์ดูแลสำหรับรีเซ็ต fixture ของฐานทดสอบเท่านั้น test:pilot ต้องมีเว็บไซต์เปิดพอร์ต 3000 และ Edge ติดตั้งอยู่

## เอกสารหลัก

- docs/P1-REVIEW.md — ใบตรวจรับ G1 และผลตรวจจริง
- docs/TECHNICAL-AMENDMENTS.md — AM-01–06 ที่เสนอรับก่อนขยายระบบ
- docs/PERMISSIONS-API.md — role/resource/state และ endpoint contract สำหรับ P2 เป็นต้นไป
- design.md — Furrow/daisyUI ที่ผู้ใช้เลือก
- docs/BUILD-NOTE.md — วิธีแก้การประมวลผล CSS ของแม่แบบบนเครื่องนี้

evidence/ เก็บผล DB, browser, Hallmark, audit, build และ screenshots ข้อมูล local credentials อยู่ใน `.local/` ซึ่งถูกละเว้นจาก Git ไม่เผยแพร่

ต้นฉบับใน sa-report-kit, sa-report-work, info และ Figma ไม่ใช่พื้นที่แก้ไขของโปรเจกต์เว็บนี้
