# Final Verification Report (9 พฤศจิกายน 2569)

สถานะ: **ทำตาม Decision 1–4 แล้ว และ commit เป็นก้อนเดียว (ยังไม่ push)** · branch `codex/p1-foundation` · ฐานก่อน commit คือ `7c1b867`
เอกสารนี้เป็นฉบับสุดท้ายของงาน Phase 1B–2A (เมนู, หน้า landing ของแต่ละเมนู, SCR-01, SCR-09, legacy redirect, แก้ test harness) ใช้เป็นบันทึกสำหรับดูแลและพัฒนาต่อ

> หลักฐานที่อ้างถึง (`evidence/…`) เก็บไว้ในเครื่องผู้พัฒนา **ไม่ได้อยู่ใน repository** ตามที่ตกลงกัน ชื่อโฟลเดอร์ใช้เพื่อการอ้างอิงเท่านั้น

## 0. โครงสร้างและเส้นทาง (สำหรับผู้ดูแล)

**เส้นทางใหม่ `/tasks/[screen]`** (`src/app/tasks/[screen]/page.tsx`): หน้า landing ของแต่ละเมนู เลือกบ้านหรืองานที่เกี่ยวข้อง แล้วไปหน้า action `/app?screen=SCR-XX&unit=…` (กติกาเดิม)

| ส่วน | หน้าที่ |
|---|---|
| `src/lib/task-landing.ts` (บริสุทธิ์ ไม่มี IO) | บอกว่าเมนูใดมี landing และชนิดใด (`houses`, `jobs`, `register`), `redirectsToLanding`, `canIssueLink` (กฎ Visibility ของ SCR-09), `landingPath`, `jobTab` |
| `src/server/tasks.ts` | โหลด units/rounds/defects/requests ทีเดียวแล้วเรียก `journey()` ต่อบ้าน (**กฎว่าบ้านใดอยู่ในขั้นตอนใดมาจาก `src/lib/journey.ts` เท่านั้น**) |
| `src/components/task-landing.tsx` | `TaskLanding` (รายการ ไม่มีฟอร์ม; กลุ่ม `data-group="primary|secondary"`), `RegisterLanding` (SCR-01) |
| `src/components/home-hub.tsx` | ช่างใช้ HomeHub tabs เป็น landing (SCR-03 → queue, SCR-04 → mine, SCR-15 → new) ผ่าน prop `active`, `title`, `initialTab` |
| `src/components/manage-ui.tsx` | `buildNav` สร้างเมนูเดียวสำหรับ `/home`, `/app`, `/account` ("งานของฉัน" รายการแรก); เมนูเดียวที่ซ้ายสุด; เมนูมือถือเป็น `<button>` + `aria-expanded`/`aria-controls`, Escape ปิด, focus เข้า/กลับ |
| `src/app/app/page.tsx` | Legacy redirect: `/app?screen=X` ไม่มี `unit` → `/tasks/X` เมื่อ X อยู่ใน allowlist ของบทบาทและมี landing (ชนิด houses/jobs) และลิงก์ไม่มี `defect` ไม่เช่นนั้นใช้ทางเดิมของ Phase 1A (`/home?next=`) |

**ลำดับตรวจสิทธิ์ของ `/tasks/[screen]`:** ไม่ล็อกอิน → `/login` · ต้องเปลี่ยนรหัสผ่าน → `/account` · ADMIN → `/admin` · ลูกค้า → `/home` (Q12 ไม่เปลี่ยน) · screen ไม่อยู่ใน `screenRoles` ของบทบาท → `/home` · ไม่มี landing → `/app?screen=X` · อื่น ๆ แสดง landing ทุกคำขอตรวจใหม่ ไม่ cache

**กฎที่ต้องรักษา:** ห้ามเลือกบ้านหรือสร้างลิงก์โดยอัตโนมัติ · SCR-01 **ห้าม** redirect กลับ landing (ปุ่ม "ลงทะเบียนบ้านใหม่" ชี้ `/app?screen=SCR-01` จะเกิด loop) · เมนูที่มี landing ไม่พกบ้านที่เปิดอยู่ · ลูกค้าไม่เปลี่ยน

**เพิ่ม landing ให้เมนูใหม่:** เพิ่มใน `task-landing.ts` (และ `journey.ts` ถ้าบ้านใดอยู่ขั้นตอนนี้) → เพิ่มเคสใน `scripts/test-task-landing.mjs`

**ทดสอบ (รันจากโฟลเดอร์โปรเจกต์ โดยเซิร์ฟเวอร์ทดสอบใช้ DB `sa_web_test_p1` และ `SA_TEST_PORT`):** `node scripts/test-task-landing.mjs`, `test-menu-nav.mjs`, `test-claim-race.mjs` (`RACE_ROUNDS`), `test-runtime.mjs`, `test-unit-selection.mjs`, `test-deep-link.mjs` · รัน `prepare-runtime-test.mjs` ก่อนแต่ละชุด · ไม่มี script `npm run test:*` สำหรับชุดใหม่

## 1. สิ่งที่ทำตามคำตัดสิน

| Decision | ผล |
|---|---|
| 1 SCR-09 Option A | ทำแล้ว: `/tasks/SCR-09` แสดงบ้านทั้ง 5 สถานะ · **ขั้นตอนหลัก** (READY_TO_SELL, CONTRACTED) ใช้ชื่อ/คำอธิบายจาก `journey()` ปุ่มหลัก · **ออกลิงก์ใหม่ให้ลูกค้าเดิม** (WAITING_INSPECTION, IN_INSPECTION, READY_HANDOVER) ปุ่มรอง ใช้ถ้อยคำเดิมของหน้าจอ · Legacy redirect เปิดแล้ว · ไม่สร้างลิงก์/ไม่เลือกบ้านเอง |
| 2 UC03 | แก้ assertion เท่านั้น (ไม่แตะ API/`auth.ts`) + สคริปต์ใหม่ `test-claim-race.mjs` |
| 3 Test isolation | แก้ harness (ไม่แตะ production) ด้วย Dedicated Test Identity |
| 4 Commit | เห็นชอบหลักการ commit เดียว ยังไม่ stage |

### 1.1 SCR-09: การตรวจ Mapping กับเซิร์ฟเวอร์ (หลักฐาน)
- ไม่แก้ `journey.ts`, `workflows.ts`, `auth.ts` และไม่ refactor เซิร์ฟเวอร์ จึง **ไม่มีแผน/diff เซิร์ฟเวอร์ที่ต้องเสนอ**
- **ไม่คัดลอกชุดสถานะของเซิร์ฟเวอร์** กฎ Visibility `canIssueLink` (`src/lib/task-landing.ts`) คือกฎเดียวกับหน้าจอ SCR-09 เดิม (`workbench.tsx:1064,1086`: `READY_TO_SELL` หรือมีลูกค้าผูกและไม่ใช่ `HANDED_OVER`) ไม่ใช่รายการสถานะของ UC-09
- **พิสูจน์ว่าตรงกับเซิร์ฟเวอร์** (T-LAND-17 ยิง UC-09 จริงกับบ้านทุกหลักใน fixture): 10 หลัง → 7 หลังที่ landing แสดง ถูกรับ 200 ครบ (READY_TO_SELL, CONTRACTED, WAITING_INSPECTION ×2, IN_INSPECTION, READY_HANDOVER ×2) · 3 หลังที่ไม่แสดง (IN_QC ×2, HANDED_OVER) ถูกปฏิเสธ 409 · ลิงก์ที่เกิดขึ้นเท่ากับจำนวนที่ถูกรับ ผลนี้ **ผ่านบน build ก่อนมี landing ด้วย** (`evidence/phase-1b/red-4/`) แปลว่ากฎตรงกับเซิร์ฟเวอร์อยู่แล้ว ไม่ใช่การปรับให้ตรง
- ข้อจำกัดที่เหลือ: กฎ Visibility ยังซ้ำกันสองที่ฝั่ง client (หน้าจอ SCR-09 กับ `canIssueLink`) กันด้วยเทสต์ ถ้าต้องการให้ใช้ฟังก์ชันเดียว ต้องแก้ `workbench.tsx` (ไม่ได้ทำ ขออนุมัติ) · กรณีทฤษฎี: บ้าน `IN_QC` ที่มี `customer_id` (ไม่เกิดจาก flow) กฎหน้าจอจะแสดงแต่เซิร์ฟเวอร์ปฏิเสธ

### 1.2 UC03 (Decision 2)
- `test-runtime.mjs` (UC03 concurrent claim): ตรวจว่ามีผู้ชนะ **เพียงคนเดียว** (`200` พอดี 1) · DB: `status=ASSIGNED`, `assigned_date` มีค่า, `technician_id` เป็นผู้ชนะ · ผู้แพ้: ช่างแพ้ → **404** (มองไม่เห็นงาน) · หัวหน้าแพ้ → **409** (เห็นงานแต่รับไม่สำเร็จ) ไม่มีการยอมรับ status ใดก็ได้
- `scripts/test-claim-race.mjs` (ใหม่): ทุกรอบรีเซ็ต fixture ทดสอบ แล้วตรวจข้างต้น + **ทั้งตาราง `defect` มีแถวเดียวที่เปลี่ยน**
  - 24 รอบ: ช่างชนะ 21 (head=409), หัวหน้าชนะ 3 (tech=404), ผ่านครบ
  - 12 รอบ (ใน regression สุดท้าย): ช่างชนะ 12 ผ่านครบ
  - เส้นทาง 404 ถูกทดสอบจริง 3 ครั้งในรอบ 24 (หัวหน้าชนะ) ไม่ได้พิสูจน์ด้วยการเดา

### 1.3 Test isolation (Decision 3) วิเคราะห์ → แก้
- **ต้นเหตุ:** ตัวจำกัดล็อกอินเก็บตัวนับในหน่วยความจำของเซิร์ฟเวอร์ (`auth.ts:32`) ต่อรหัสพนักงาน 15 นาที ล็อกเมื่อผิด 5 ครั้ง มีเพียงล็อกอินสำเร็จที่ล้างตัวนับ (`auth.ts:194`) `prepare-runtime-test.mjs` รีเซ็ต DB แต่ไม่แตะหน่วยความจำนั้น
- **สองจุดที่สะสมข้ามรอบ** (เจอจริงสองจุด): (1) AUTH-07 ยิงผิด 5 ครั้งกับ `EMP0010` → รอบถัดไป 429 (2) AUTH-03 ยิงบัญชีที่ปิดใช้งาน `EMP0011` รอบละ 1 ครั้ง ล้างไม่ได้เพราะล็อกอินสำเร็จไม่ได้ → **รอบที่ 6** ล้ม 429 (ผมเจอจริงตอนรันซ้ำระหว่างตรวจสอบ ตรงกับที่คำนวณจากโค้ด)
- **ทางเลือกที่พิจารณา:** Dedicated Test Identity ✅ · Isolated Test Server ❌ (หนักและไม่จำเป็น) · Test-only limiter reset ❌ (ต้องแก้โค้ด production)
- **การแก้ (harness เท่านั้น):** AUTH-07 ใช้รหัสเฉพาะรอบ `TST` + hex 8 ตัว (ตัวจำกัดนับรหัสที่ไม่มีบัญชีเหมือนกัน ผ่านเส้นทางโค้ดเดียวกัน) · AUTH-03 สร้างบัญชี inactive เฉพาะรอบ (แถวจริง `is_active=0`) ลองล็อกอิน แล้วลบทิ้งใน `finally` และยังตรวจว่า fixture `EMP0011` ยัง `is_active=0` โดยไม่ล็อกอิน · บัญชี `EMP0002` ที่ลองรหัสผิดถูกล้างโดยล็อกอินสำเร็จในเคสหลัง (ของเดิม)
- **พิสูจน์:** `test-runtime` 35/35 ติดต่อกัน **10+ รอบบนเซิร์ฟเวอร์เดียวกันโดยไม่ restart** รวมรอบที่รันบนเซิร์ฟเวอร์ซึ่งตัวนับ `EMP0011` ค้างอยู่ (สภาพที่เคยล้ม) · ไม่เหลือบัญชี `TST*` ใน DB ทดสอบ · ไม่แตะ production, login/auth API
- **ข้อจำกัด:** ยืนยันเฉพาะ `test-runtime` ชุดอื่นไม่ได้รันซ้ำเกิน 2 ครั้งบนเซิร์ฟเวอร์เดียว

## 2. Changed Files และ Diff

Diff ทั้งหมดอยู่ใน `evidence/phase-1b/diffs/` (GENERATED) · ดัชนีหลักฐาน `evidence/phase-1b/INDEX.md`

| ไฟล์ | ประเภท | ขนาด | หมายเหตุ |
|---|---|---|---|
| `src/app/app/page.tsx` | **Phase 1A ที่ push แล้ว ถูกแก้เพิ่ม** | +8/−1 vs HEAD | Legacy redirect |
| `scripts/test-unit-selection.mjs` | **Phase 1A ถูกแก้เพิ่ม** | +14/−8 | T-01 ใช้ `/app?screen=SCR-09&defect=12` (ยังทดสอบหน้าเลือกบ้าน) · T-02 คาดว่าไป `/tasks/SCR-09` (ไม่มี unit, ไม่เลือกบ้าน) ตามที่ SCR-09 มี landing |
| `scripts/test-runtime.mjs` | **Phase 1A/เดิม ถูกแก้เพิ่ม** | +65/−12 vs HEAD | UC03, AUTH-03, AUTH-07 (§1.2, §1.3) |
| `src/components/manage-ui.tsx` | UI-1 + งาน 1B–2A | +79/−30 vs baseline | ไม่เปลี่ยนรอบนี้ |
| `src/components/workbench.tsx` | UI-1 + 1C | +1/−7 | ไม่เปลี่ยนรอบนี้ |
| `src/components/home-hub.tsx` | UI-1 + 2A | +17/−7 | ไม่เปลี่ยนรอบนี้ |
| `src/lib/task-landing.ts` (ใหม่) | | | + SCR-09, `canIssueLink`, `redirectsToLanding` |
| `src/server/tasks.ts` (ใหม่) | | | + แถวหลัก/รองของ SCR-09 |
| `src/components/task-landing.tsx` (ใหม่) | | | + กลุ่มผลลัพธ์ (`data-group`) |
| `src/app/tasks/[screen]/page.tsx` (ใหม่) | | | |
| `scripts/test-task-landing.mjs`, `test-menu-nav.mjs` (ใหม่), `test-claim-race.mjs` (ใหม่) | | | |

ตรงกับ HEAD: `home/page.tsx`, `deep-link.ts`, `workspace.ts`, `journey.ts`, `runtime-contracts.ts`, `auth.ts`, `workflows.ts`, `login/*`, `db-common.mjs`, `package.json`, `package-lock.json` · UI-1 อื่น (`globals.css`, `admin-panel.tsx`, `pilot-shell.tsx`) ตรง checksum

## 3. Route / Redirect ทุกบทบาท (T-LAND, `evidence/phase-1b/final-4/task-landing-final4.json` 18/18)

| หัวข้อ | เคส |
|---|---|
| เมนู → landing ทุกบทบาท | T-LAND-01, 06, 09, 11 |
| รายการตรง `journey()` และตรงสถานะ DB | T-LAND-02, 03 |
| เลือกแถว → หน้า action พร้อม `unit` ของแถวนั้น | T-LAND-04 |
| Empty state | T-LAND-05 |
| Direct URL ใน browser ใหม่, ไม่ล็อกอิน → `/login`, ไม่มีสิทธิ์ → `/home`, screen ไม่รู้จัก | T-LAND-07 |
| ลูกค้าไม่เปลี่ยน | T-LAND-08, 13 |
| Legacy redirect ไม่เกิน 1 hop ไม่ loop, `unit` ว่าง, มี unit ไม่ redirect, defect ไม่หาย, SCR-01 ไม่ redirect | T-LAND-12, 13 |
| Back navigation | T-LAND-14 |
| **ไม่เลือกบ้าน/สร้างลิงก์/ผูกลูกค้าอัตโนมัติ** (นับ `access_link` และสถานะบ้านก่อน-หลัง) | T-LAND-16 |
| ADMIN → `/admin`, บัญชีที่ต้องเปลี่ยนรหัสผ่าน → `/account` | T-LAND-18 |
| a11y (axe) 1280/390 | T-LAND-10 |

T-LAND-17 และ T-LAND-18 แก้ข้อมูลใน DB ทดสอบ (สร้างลิงก์/ผูกลูกค้า, สลับ role ชั่วคราวและคืนค่าเดิมเสมอ) จึงรันท้ายสุด; fixture ถูกรีเซ็ตด้วย `prepare-runtime-test.mjs` ก่อนทุกชุด (เป็นการรีเซ็ต **DB ทดสอบที่ own** ตามที่ใช้มาตลอด ไม่ใช่ Dev DB)

## 4. Regression (build เดียวกันทั้งหมด, src ตรงกับ `sa-web`)

| ชุด | ผล |
|---|---|
| `test-task-landing` | 18/18 PASS |
| `test-menu-nav` | 17/17 PASS (SCR-09 ไป `/tasks`) |
| `test-unit-selection` (Phase 1A) | 10/10 PASS |
| `test-deep-link` | 35/35 PASS |
| `test-runtime` | 35/35 PASS ×2 ติดกัน + อีก 3 + 3 ติดกัน ไม่ restart |
| `test-claim-race` | 24 รอบ + 12 รอบ PASS |
| `test-stale-task` | PASS |
| `test-runtime-browser` | 16/16, layouts 152, violations 0 |
| `test-management` | 21/21, violations 0 |
| `test-runtime-visual` | 38 หน้า, violations 0 |
| traceability | 77 IDs |

Red ก่อนแก้ SCR-09: `evidence/phase-1b/red-4/` (T-LAND-01, 02, 03, 07, 09, 12, 13, 15, 10 และ T-NAV-03, 04 และ Phase 1A T-02 ล้มตามที่คาด) · Red ของ UC03/AUTH เป็นหลักฐานจากการสืบสวน: `evidence/phase-2a-followup/uc03-race-distribution.json` และ log ที่ล้ม (`final-4/regression/test-runtime-after-race.log` ล้ม 429 ที่ AUTH-03 ก่อนแก้)

## 5. TypeScript, ESLint, Production Build (isolated, หลังการเปลี่ยนสุดท้าย)
- `npm run typecheck` ✔ · `npm run lint` ✔ · `npm run build` ✔ (BUILD_ID `OxPUSPsLBxtKojALHdAxD`; route `/tasks/[screen]` อยู่ในรายการ) โดยมีโฟลเดอร์ `evidence/phase-1a/staging` และ `phase-1b/baseline` ใน tree ด้วย
- `tsc --noEmit` ทั้งโปรเจกต์ใน `sa-web` สะอาด · ไม่มี `.ts/.tsx` หลงอยู่ใต้ `evidence/`
- ผมไม่ได้ `next build` ใน `sa-web` (คง `next dev` ตามที่สั่ง)

## 6. Port 3000 และ Process
- `next dev` PID 12256 → 18396 (+ worker 35892, 33424) คงเดิม ไม่ restart ไม่เปลี่ยนเป็น `next start` ไม่ได้แตะ
- 3001–3004 ปิดหมด (3003 ที่ผมเปิดสำหรับตรวจ ปิดแล้ว) ไม่มี force kill (ตรวจ command line ก่อนปิดทุกครั้ง)
- ตรวจบน 3000 แบบไม่ล็อกอิน: `/tasks/SCR-09`, `/app?screen=SCR-09`, `/tasks/SCR-01` → 307 `/login`, `/login` 200 · ไม่ล็อกอินเข้า Dev DB
- โฟลเดอร์ `sa-web-isolated*` ยังอยู่ (ไม่ลบ) ไม่มี process

## 7. หลักฐาน (ORIGINAL / RECREATED)
ดู `evidence/phase-1b/INDEX.md` สรุป: ต้นฉบับ `final` ของ 1D หายจากความผิดพลาดของผม · `final-1d/` ผสม (json/log ต้นฉบับ, ภาพถ่ายใหม่) · `final-1d-regenerated/` สร้างใหม่ทั้งหมด · โฟลเดอร์อื่น ORIGINAL · `diffs/` GENERATED

## 8. การจำแนกปัญหา (Product / Test / Environment)
| ปัญหา | ประเภท | สถานะ |
|---|---|---|
| UC03 404 vs 409 | **Test bug** (สมมติฐานผิด) พฤติกรรม API เป็นไปตามออกแบบ | แก้ assertion |
| 429 จาก AUTH-07 และ AUTH-03 สะสมข้ามรอบ | **Test isolation / Environment** (ตัวนับอยู่ในหน่วยความจำเซิร์ฟเวอร์) | แก้ harness |
| บทบาทที่ตัวจำกัดล็อกอินเป็นต่อบัญชี เก็บในหน่วยความจำ ไม่แชร์ข้าม process | ข้อสังเกต Product (ความปลอดภัย) ไม่ใช่บั๊กที่พิสูจน์ได้ | **ไม่แก้** ควรอยู่ใน SEC-01 |
| ปัญหา Product ใหม่ในโค้ดที่ทำรอบนี้ | ไม่พบ | – |

## 9. ข้อจำกัดที่เหลือ
- fixture ไม่มีแถวของ SCR-07, 08, 16 (ยืนยันได้แค่ "ว่างตรง `journey()`")
- ADMIN ใน T-LAND-18 ใช้การสลับ role ของบัญชีทดสอบชั่วคราว ไม่ใช่บัญชีแอดมินจริงของระบบ
- ถ้อยคำบน landing ("เพิ่มบ้านหลังใหม่เข้าระบบ", "ขั้นตอนหลัก", empty state) ผมเขียนเอง ควรให้เจ้าของถ้อยคำตรวจ ส่วน "ออกลิงก์ใหม่ให้ลูกค้าเดิม" และ "ลูกค้า … ลิงก์ใหม่มีอายุ 30 วัน" ใช้ข้อความเดิมของหน้าจอ
- เมนูมือถือไม่มี focus trap · ไม่ได้ทดสอบ `/account` ของลูกค้า
- ผมไม่ได้เทียบการทำงานบน 3000 แบบล็อกอิน (เลี่ยงการเขียน session ลง Dev DB)

## 10. ขอบเขตของ commit
- **รวม:** `src/app/app/page.tsx`, UI-1 6 ไฟล์ (`globals.css`, `admin-panel.tsx`, `home-hub.tsx`, `manage-ui.tsx`, `pilot-shell.tsx`, `workbench.tsx`), `src/lib/task-landing.ts`, `src/server/tasks.ts`, `src/components/task-landing.tsx`, `src/app/tasks/[screen]/page.tsx`, `scripts/test-menu-nav.mjs`, `test-task-landing.mjs`, `test-claim-race.mjs`, `test-runtime.mjs`, `test-unit-selection.mjs` และเอกสารฉบับนี้
- **ไม่รวม:** `evidence/*`, `scripts/test-sec-01-login.mjs`, เอกสาร SEC-01 และเอกสารแผน/รายงานระหว่างทาง (`docs/UX-*.md`, `PHASE-1B-2A-REPORT.md`, `FINAL-REVIEW-ROUND-2.md`, `SCR-09-MAPPING-PROPOSAL.md`) ซึ่งถูกแทนที่หรือซ้ำกับเอกสารนี้
- `home-hub.tsx` และ `manage-ui.tsx` มี UI-1 ปนอยู่ทั้งไฟล์ จึง commit เป็นก้อนเดียว
- ไม่ลบโฟลเดอร์ isolated · ไม่ reset Dev DB · ไม่ force kill
