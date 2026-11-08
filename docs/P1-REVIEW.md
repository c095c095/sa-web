# ใบตรวจรับ G1: ฐานเว็บไซต์และรูปแบบหน้าจอ

8 พฤศจิกายน 2569 · G0 และธีม Furrow อนุมัติแล้ว · **P1 พร้อมตรวจรับ G1**

## สิ่งที่ได้

ฐานเว็บไซต์จริง Next.js 16.4.5 / TypeScript / Tailwind 4.3.5 / daisyUI 5.7.50 เชื่อม MariaDB 10.11.16 ใน XAMPP ชุดเดิม โค้ดและฐานทดลองชุดนี้ใช้พัฒนาต่อเป็นระบบเต็ม ไม่ต้องเริ่มเว็บไซต์ใหม่อีกชุด

หน้าที่เปิดตรวจรับได้:

| หน้า | URL | ทดลองอะไรได้ |
|---|---|---|
| SCR-03 คิวงานช่าง | http://127.0.0.1:3000/pilot/technician | ตัวกรอง/ค้นหา เก็บตัวกรองใน URL ดูรายละเอียด เลือกและทบทวนงาน |
| SCR-14 แจ้งจุดที่ต้องแก้ | http://127.0.0.1:3000/pilot/report | ฟอร์มไทย ตรวจช่องจำเป็น เลือกรูป/ลบออก ทบทวนรายการ โดยยังไม่ส่งข้อมูล |
| SCR-17 ติดตามการซ่อม | http://127.0.0.1:3000/pilot/status | สถานะไทย (CODE) เลือกเฉพาะ FIXED ดูสรุปก่อนบันทึกจริงในเฟสถัดไป |

ข้อมูลบนหน้าจอเป็น fixture สมมติที่แยกจากข้อมูลจริงของโครงการ ปุ่มทบทวนไม่ส่งหรือบันทึกจริง พนักงานและลูกค้ายังไม่ได้ login/link authentication ใน P1 จึงเปิดเพียงบริบทสมมติที่กำหนดไว้ ไม่รับ ID บ้านจากภายนอก

## ผลตรวจจริง

| ตรวจ | ผล | ขอบเขตหลักฐาน |
|---|---|---|
| DB/driver compatibility | **125 checks ผ่าน / 0 fail** | 77 prepared query checks + replay 21 TC เดิมบน MariaDB + 25 ข้อจำกัด/ทางเลือก + 2 concurrency checks |
| Runtime Query coverage | **77/77** | ชุดเดิมครอบคลุม 69 รายการ และเพิ่มทางเลือกอีก 8; ID/params เดิมรักษาไว้ |
| ข้อจำกัด DB | ผ่าน FK, unique บ้าน, active round, signature, file owner, role/craft, enum, NULL/XOR, case-sensitive token, ไทย และขีดจำกัดรหัส | evidence/db-compatibility.json |
| พร้อมกันหลาย connection | สองช่างรับจุดเดียวสำเร็จหนึ่งราย; 30 sequence values ไม่ซ้ำ | เป็น DB proof ยังไม่ใช่ HTTP service acceptance |
| Browser layouts | **24/24** | 3 หน้าที่ 320/375/390/768/1024/1280/1440/1920px; ไม่ล้น viewport |
| Browser interactions | **12/12** | filter/reload, empty/error/loading, selection, group focus, reporter radio/keyboard, white fields, validation, file limit/no POST, FIXED-only และ SSR ไม่มี JS |
| Accessibility อัตโนมัติ | **0 violations ในชุดที่ตรวจ** | axe WCAG2A/AA/2.1AA ที่ 390 และ 1280px ทั้ง 3 หน้า; ไม่อ้างว่าครอบคลุมทุกกรณี |
| Hallmark | **Floor 0 FAIL / Reflex 0 / Warn 0** | static + render จริง 3 URLs; 15 ภาพจาก render tier |
| Code/build | lint, TypeScript และ production build ผ่าน | ใช้ PostCSS แทนตัวโหลด CSS จากแม่แบบที่ build ไม่ผ่านบนเครื่องนี้ |
| Dependency audit | **0 รายการที่ npm audit รายงาน ณ รอบนี้** | scope package-lock รุ่นที่ส่ง; ไม่ใช่การรับรองความปลอดภัยทุกมิติ |
| Source integrity | ตรวจด้วย source-integrity.json | SA baseline 179 ไฟล์ และ info 4 ไฟล์; ไม่เขียนรายงาน/Figma |

หลักฐานนี้ยืนยัน P1 เท่านั้น **เว็บเต็ม 18 UC ยังไม่เสร็จ** ไม่ได้นำผล PGlite มาอ้างว่าแอปผ่าน Integration/E2E และยังไม่ได้เติมผลทดสอบในรายงาน SA

## รูปแบบที่ใช้

Furrow แบบ app screen: พื้นขาวอุ่น ตัวอักษรเข้ม เส้นแบ่งรายการ สีส้มสำหรับ action หลัก และสีสถานะที่มีคำกำกับ ใช้ IBM Plex Sans Thai มือถือเปลี่ยนตารางเป็นรายการและเมนูเป็น disclosure ไม่มี stock photo แทนหลักฐานจริง

ตรวจภาพตัวแทน desktop/mobile ทั้งสามหน้า และสถานะ form/error แล้ว ภาพใน evidence/screenshots/ มาจากการเปิดหน้าเว็บจริงบนเครื่อง ไม่ใช่ mock screenshot ของผลซ่อมบ้าน

## ขอรับ G1 สองส่วนตามแผน

1. **รูปแบบและวิธีใช้:** ทั้งสามหน้าชัดเจนหรือมีส่วนใดต้องปรับก่อนนำองค์ประกอบไปขยายครบ 19 หน้าจอ
2. **ข้อปรับทางเทคนิค AM-01–06:** marker จบการตรวจ, สิทธิ์รับงาน, ขอบเขตบ้านของลูกค้า, session/token, MariaDB adaptation และ NULL checks ตาม [TECHNICAL-AMENDMENTS.md](TECHNICAL-AMENDMENTS.md)

AM-04 เสนอเพิ่ม 1 ตารางเทคนิค app_session เพื่อ revoke/logout ได้จริง โดยคง 9 entity ธุรกิจเดิม และเก็บ link/session token เป็น digest การเปลี่ยนนี้ยังไม่ได้ใช้กับระบบที่เปิดตรวจรับ

เมื่อรับ G1 จะเริ่ม P2 shared services (login/session/token/validation/private file handlers) แล้วต่อ P3 QC 01–08, P4 ฝ่ายขายและคำขอ 09–13, P5 แจ้งจุด/รายงาน/ยอมรับ/เซ็น 14–18 ตาม dependency เดิม ก่อน G2 ตรวจ flow รวมและ G3 UAT

## เงื่อนไขที่ยังไม่ถือว่าผ่าน

login/logout, session revocation, token exchange, CRUD ผ่าน HTTP, การอัปโหลด/ดาวน์โหลดจริง, PDF ภาษาไทย, การยอมรับสภาพ/ลายเซ็น, full E2E 18 UC, backup/restore และ production deployment อยู่ในเฟสถัดไป ยังไม่มีผลผ่านของรายการเหล่านี้
