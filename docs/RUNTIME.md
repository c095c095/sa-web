# การเปิดและตรวจระบบบน Windows

สถานะปัจจุบันเพิ่มส่วนจัดการและการเดินงานใหม่แล้ว ดู [ADMIN-REVIEW.md](ADMIN-REVIEW.md) ผู้ดูแลครั้งแรกตั้งบัญชีผ่านลิงก์ใน `.local/ADMIN-SETUP.md` ส่วนรายละเอียด P2–P5 เดิมด้านล่างเป็นฐานที่ใช้ต่อ

## เปิดระบบที่ติดตั้งแล้ว

1. เปิด MySQL ใน XAMPP
2. เปิดโฟลเดอร์ `sa-web` แล้วใช้ `npm run build` และ `npm start -- --hostname 127.0.0.1`
3. เปิด `http://127.0.0.1:3000/login` บัญชีและรหัสผ่านสมมติอยู่ใน `.local/LOGIN.md`
4. ฝ่ายขายสร้างลิงก์จากหน้าผูกลูกค้าแล้วส่งให้ผู้ตรวจรับ ส่วนลิงก์บ้านสมมติตั้งต้นอยู่ใน `.local/customer-demo-links.json` ลิงก์ที่หมดอายุต้องออกใหม่ด้วยฝ่ายขาย

ไม่มีการ reset ฐานข้อมูลเมื่อเปิดเว็บ `.env.local`, `.local/`, ฐานข้อมูล และไฟล์แนบเป็นของเฉพาะเครื่อง ไม่ถูก commit และไม่ควรนำรหัสผ่านชุดสมมติไปใช้กับข้อมูลจริง `SESSION_SECRET` ที่ตกค้างจาก P1 ไม่ได้ถูกใช้เป็นหลักฐานการเข้าสู่ระบบ ปัจจุบันใช้ session สุ่มที่ตรวจและเพิกถอนได้จาก server

## โครงสร้างและขอบเขต

- Next server เป็น backend เชื่อม MariaDB 10.11.16 ด้วยบัญชีจำกัดสิทธิ์ ไม่ได้เพิ่ม PHP API
- 9 ตารางธุรกิจเดิม, `app_session` ตาม AM-04 และ migration 003 เพิ่ม `project`, `app_control`, `audit_event` ตามแผนส่วนจัดการที่อนุมัติ
- `/login` เป็น SCR-00; `/app?screen=SCR-01` ถึง `SCR-18` ใช้เมนูตาม role ทั้ง 4 actor; HEAD_TECHNICIAN อยู่ภายใต้ actor ช่าง
- ทุก mutation ผ่าน `POST /api/actions/UC-01` ถึง `UC-18` โดยแยก mode สำหรับ add/edit/delete/finish และขั้นตอนย่อย
- `GET /api/workspace` เป็น read model ตามสิทธิ์; `/api/files/<opaque-key>` ตรวจสิทธิ์ทุกครั้ง; ไม่มีไฟล์แนบใน public directory
- `/api/auth/login`, `/api/auth/access`, `/api/auth/logout` และ `GET /api/auth/session` จัดการ session
- ลิงก์ 30 วัน เก็บ SHA-256 digest; session อายุสูงสุด 8 ชั่วโมงและไม่เกินวันหมดอายุลิงก์ ตรวจ active role/craft/บ้าน/สถานะอีกครั้งก่อนบันทึก
- คำสั่ง SQL และค่าที่รับเข้าแยกกัน ส่งผ่าน mysql2 placeholder escaping ไม่มีการต่อข้อความที่ผู้ใช้กรอกเข้ากับ SQL
- รูป JPEG/PNG/WebP ไม่เกิน 5 MB/รูป สูงสุด 10 รูปและรวมคำขอไม่เกิน 25 MB ตรวจเนื้อไฟล์แล้วแปลง WebP; ลายเซ็นต้องมีรอยเขียน; PDF เกิดจากข้อมูลและรูปที่มีจริงใน storage
- RPT-01 เป็น PDF ภาษาไทย A4 แนวตั้ง ส่วน RPT-02 ใน SCR-17 สรุปสถานะของรอบตรวจก่อนรับมอบล่าสุด พร้อมประวัติรอบก่อนหน้า รูปประกอบ และไฟล์ PDF ของบ้าน

## ทดสอบแยก

ข้อมูลใช้งาน local อยู่ใน `sa_web_dev_p1` ส่วนชุด automated test ใช้ **เฉพาะ `sa_web_test_p1`** และ `.local/test-storage` ห้ามเปลี่ยนชื่อเป้าหมายใน script ไปเป็นฐานข้อมูลอื่น

ก่อนเริ่ม test run ใหม่ หยุด server ทดสอบเดิม แล้วใช้ `node scripts/prepare-runtime-test.mjs` ซึ่ง reset เฉพาะฐานทดสอบที่มี ownership record และย้าย storage ทดสอบเดิมไปเก็บใน private backup ภายใน workspace จากนั้นเปิด server ทดสอบด้วยตัวแปร:

```powershell
$env:DB_NAME='sa_web_test_p1'
$env:APP_URL='http://127.0.0.1:3001'
$env:APP_STORAGE_DIR='.local/test-storage'
npm run dev -- --hostname 127.0.0.1 --port 3001
```

ในอีก terminal รันตามลำดับ:

```powershell
node scripts/test-runtime.mjs
node scripts/test-runtime-browser.mjs
node scripts/test-runtime-visual.mjs
node scripts/test-management.mjs
node scripts/test-stale-task.mjs
```

Browser test ใช้ Microsoft Edge ที่ติดตั้งอยู่ PDF ใช้ Chrome หรือ Edge ในเครื่อง สามารถระบุ `CHROME_PATH` ได้ ชุดทดสอบเขียนข้อมูลสมมติและรูปเส้นทดสอบจริง ไม่ใช่หลักฐานผลตรวจบ้านจริง

ตรวจโค้ดด้วย `npm run typecheck`, `npm run lint`, `npm run build` อ่านหลักฐานใน `evidence/runtime-*.json` ไม่ใช้ PASS ใน `testplan-expected.json` หรือผล PGlite เดิมแทนผล runtime นี้

## ข้อจำกัดก่อน G3

G2 เดิมรับแล้วและส่วนจัดการพร้อมให้ตรวจ A5 ส่วน UAT โดยผู้ใช้ การทดลอง restore backup และสถานการณ์ storage เต็ม/ไฟดับ/DB ขาดการเชื่อมต่อระหว่าง commit อยู่ใน P6 หลัง G2 การใช้ LAN/โดเมน/public deployment ยังไม่อยู่ในขอบเขต local นี้

ลายเซ็นเป็นภาพประกอบการรับมอบตามโครงงาน ผู้ถือ access link มีสิทธิ์ของลูกค้า/บริษัทตรวจนอกตามบ้านนั้น ไม่มีการเพิ่มระบบพิสูจน์บุคคลภายนอกเหนือ source

## เหตุขัดข้องที่พบระหว่างตรวจ

MariaDB Windows ชุดนี้หยุดด้วย exception `0xc0000005` เมื่อใช้ binary prepared statement อ่าน workspace JOIN มี stack ผ่าน `Field::clone` ใน log เวลา 19:20:41 วันที่ 8 พฤศจิกายน 2569 จึงเปิดฐานข้อมูลเดิมกลับด้วย config เดิมและเปลี่ยน runtime เป็น mysql2 `query(sql, values)` ที่ escape parameters ให้ หลีกเลี่ยง binary prepare path ไม่ได้อัปเกรดหรือเปลี่ยน config ของ XAMPP และยังไม่ยืนยันหมายเลข upstream bug สาเหตุระดับ engine โดยละเอียดเป็นข้อจำกัดของการวินิจฉัยครั้งนี้

การทดสอบที่พบปัญหาและผลหลังปรับถูกบันทึกแยกใน `evidence/runtime-debug-ledger.json` ต้องติดตามหากเกิดซ้ำและไม่ถือว่าผลผ่านหนึ่ง run พิสูจน์ว่า engine ปราศจากปัญหาทุกกรณี
