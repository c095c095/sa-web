# รายงาน Phase 1A: F12 Silent Unit Selection และ Q7 Deep Link (9 พฤศจิกายน 2569)

สถานะ: **พร้อมตรวจรับ** ยังไม่ commit ยังไม่ push ทดสอบบน environment แยก (`sa-web-isolated-p1a`, พอร์ต 3003, test DB `sa_web_test_p1`)

## 1. ขอบเขตที่อนุมัติ

- F12: ห้ามเลือกบ้านให้เองเมื่อไม่มี unit ทั้งฝั่ง page และ API (`workspace.ts`)
- Q6: F5 แยก Scope ไม่แก้ในรอบนี้
- Q7 (ตัวเลือก A): ขยาย Scope ไป `home-hub.tsx` เฉพาะการรักษา deep link ผ่าน `next` ที่ allowlist เฉพาะ `/app` ภายใน
- Q8: ลูกค้าคงพฤติกรรมเดิม ไม่ใช้ `units[0]` เมื่อมีหลายบ้าน
- SCR-01 ไม่ต้องบริบทบ้าน
- ห้ามแก้ Authorization, Business Rule, Permission, F1, F2, F7 หรือ Navigation Redesign ในรอบนี้

## 2. Changed Files

### Application (Scope ที่อนุมัติ)

| ไฟล์ | การเปลี่ยนแปลง | หมายเหตุ |
|---|---|---|
| `src/lib/deep-link.ts` | **ใหม่** `parseNext`, `buildAppPath`, `requiresHouse` | pure, ไม่มี IO |
| `src/server/workspace.ts` | ไม่มี unit → ไม่เลือกบ้าน (พนักงาน); ลูกค้าใช้บ้านเดียวได้เฉพาะเมื่อมีบ้านเดียว | F12 และ Q8 |
| `src/app/app/page.tsx` | พนักงาน + หน้าที่ต้องบ้าน + ไม่มี unit → redirect `/home?next=…` | F12 และ Q7 |
| `src/app/home/page.tsx` | รับ `next`, ตรวจด้วย `parseNext`, ส่ง `deepLink` ให้ HomeHub | Q7 |
| `src/components/home-hub.tsx` | แบนเนอร์ "เลือกบ้านก่อนเปิด…" และลิงก์บ้านเก็บปลายทางเมื่อ `next` ผ่าน | Q7 เฉพาะส่วนนี้ ไม่แก้ส่วนอื่นของหน้า |

**ไฟล์ค้างจาก Sprint UI-1 ที่อยู่ใน `home-hub.tsx`** ยังอยู่ครบ ไม่ถูกเขียนทับ (เทียบกับ baseline ใน `evidence/phase-1a/changes.patch` มีเฉพาะบรรทัดของ Phase 1A)

### Test Infrastructure และเทสต์

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `scripts/db-common.mjs` | `SA_TEST_PORT` (default 3001), `testBase` (รอบก่อน) |
| `scripts/prepare-runtime-test.mjs`, `test-runtime.mjs`, `test-runtime-browser.mjs`, `test-runtime-visual.mjs`, `test-management.mjs`, `test-stale-task.mjs` | ใช้ `testBase` (รอบก่อน) |
| `scripts/test-runtime-visual.mjs` | **precondition**: เปิด `/app?screen=SCR-03` ของช่างต้องมี `&unit=` ของบ้านที่ช่างเห็น (เดิมพึ่งการเลือกบ้านเงียบ) |
| `scripts/test-unit-selection.mjs` | **ใหม่** T-01 ถึง T-10 |
| `scripts/test-deep-link.mjs` | **ใหม่** unit test ของ allowlist 35 กรณี |
| `scripts/test-sec-01-login.mjs` | **ใหม่** SEC-T1 ถึง T5 (Scope SEC-01 ไม่ใช่ Phase 1A ใส่ไว้เพื่อบันทึกอยู่ในที่เดียว) |

**ไม่ได้แก้:** `journey.ts`, `manage-ui.tsx`, `workbench.tsx`, `scopedUnit`, `login()`, `enforceOrigin`, schema, `next.config.ts`, `package.json`, `.graphifyignore`

## 3. Diff

ฉบับอ้างอิงของ commit คือ `git show HEAD` ของ commit Phase 1A (รายการไฟล์ใน §14.6) ไฟล์ `evidence/phase-1a/changes.patch` เป็นผลก่อน staging และไม่ตรงกับ commit ทุกประการ ไฟล์ใหม่สามไฟล์ (`deep-link.ts`, `test-unit-selection.mjs`, `test-deep-link.mjs`) ไม่มี baseline

## 4. Test Results

### 4.1 Red (ก่อนแก้ ชุดทดสอบฉบับปัจจุบัน รันบน build เดิม พอร์ต 3002)

| รหัส | ผล | หมายเหตุ |
|---|---|---|
| T-01 | FAIL | เลือกบ้านที่สร้างล่าสุดเงียบ ๆ |
| T-02 | FAIL | เมนูจาก `/home` เลือกบ้านเงียบ ๆ |
| T-03 | FAIL | API คืน unit ที่สร้างล่าสุด |
| T-04 | FAIL | บ้านปรากฏก่อนรีเฟรช |
| T-05 | FAIL | ไม่มี picker/next |
| T-10 | FAIL | ไม่มีแบนเนอร์/ลิงก์ที่เก็บปลายทาง |
| T-06, T-07, T-08, T-09 | PASS | regression และ guard ที่ต้องผ่านอยู่แล้วก่อนแก้ |

### 4.2 Green (หลังแก้ Phase 1A บน 3003)

| ชุด | ผล |
|---|---|
| `test-unit-selection.mjs` (T-01 ถึง T-10) | **PASS 10/10** |
| `test-deep-link.mjs` (valid/invalid next, builder, requiresHouse) | **PASS 35/35** |
| `test:runtime` | **PASS 35/35** |
| `test:runtime:browser` | ดู §14.2 (staged-only: violation 0) | ตัวเลข F7 ก่อนหน้าวัดบน working tree ที่มี UI-1 (ดู §14.3) |
| `test:runtime:visual` | ดู §14.2 (staged-only: violation 0) | ตัวเลข F7 ก่อนหน้าวัดบน working tree ที่มี UI-1 (ดู §14.3) |
| `test:management` | ดู §14.2 (staged-only: violation 0) | ตัวเลข F7 ก่อนหน้าวัดบน working tree ที่มี UI-1 (ดู §14.3) |
| `test:stale-task` | PASS |
| `audit:runtime` | PASS 77 query IDs |
| `typecheck` | PASS |
| `lint` | PASS (ไม่มี warning ในไฟล์ที่แก้) |
| `test:pilot` | BLOCKED (retired test) | ไม่ใช่ FAIL ของ Phase 1A: route ถูกยกเลิกแล้ว (ดู §11.1) |
| `test-sec-01-login.mjs` | SEC-T1, T1b, T2 FAIL (คาดไว้ เป็น SEC-01 ยังไม่แก้) SEC-T3, T4, T5 PASS |

**การตรวจ regression:** บน staged-only tree violation ของ browser, visual และ management เป็น 0 (§14.2) ตัวเลข 8 / 36 / 18 ก่อนหน้าวัดบน working tree ที่มี UI-1 จึงไม่ใช่ regression ของ Phase 1A (ดู §14.3)

### 4.3 การแก้เทสต์ระหว่างทาง (เปิดเผย)

- T-04 precondition: ย้ายจาก SCR-09 เป็น SCR-01 เพราะหน้า house-scoped ไม่มี unit อีกแล้ว (redirect ไป picker)
- T-01, T-02, T-05, T-09, T-10: แก้ selector ที่จับลิงก์เมนู "เปิดบ้านและดูแลระหว่างลูกค้าตรวจ" ผิด และรอ URL ของ client navigation แทนการรอ load event
- `showsNewestHouse`: ตรวจว่าบ้านถูกเลือกจริงโดยดูว่าไม่มีรายการ picker ปรากฏ เพราะ picker แสดงชื่อบ้านทุกหลัง
- `test-runtime-visual.mjs`: precondition ของช่าง (ดู Changed Files)
- `test-sec-01-login.mjs`: ย้าย key `status` ที่ชนกับ HTTP status เป็น `http_status`

### 4.4 Test ที่ไม่เกี่ยวหรือยังไม่ได้ทำ

- `test:pilot` รันจากสำเนาเพื่อไม่ให้เขียนทับ evidence หลัก ชี้ไป 3000 ซึ่งรัน build ก่อนแก้ จึงไม่ได้วัด Phase 1A ผลครั้งนี้ล้มที่ assertion ของหน้า no-JS static ซึ่งต่างจากครั้งก่อนที่ล้มที่ฟอนต์ ยังอธิบายความต่างไม่ได้
- ยังไม่ได้รัน `test:runtime:browser` ฉบับ no-JS สำหรับ SCR อื่นนอกจากที่ทดสอบ

## 5. Evidence

| หลักฐาน | ที่อยู่ |
|---|---|
| ผล T-01..T-10 (green) | `sa-web-isolated-p1a/evidence/unit-selection.json` |
| ผล T-01..T-10 (red, build เดิม, เวอร์ชันเทสต์ปัจจุบัน) | `sa-web-isolated/evidence/unit-selection.json` (เป็นผลของการรันครั้งล่าสุดบน 3002 ก่อนแก้โค้ด) |
| Diff | `sa-web/evidence/phase-1a/changes.patch` |
| Baseline ไฟล์ก่อนแก้ | `C:\Users\Mocatzy\AppData\Local\Temp\p1a-baseline-004246\` (ดู `p1a-baseline-path.txt`) |
| Hash ไฟล์ก่อนแก้ 9 รายการ | `docs/UX-PHASE-PLAN.md` §0 และ §12.5 |
| Build ที่ใช้ | `sa-web-isolated-p1a/.next` BUILD_ID `1GnPzAj5qTvFGOPzJwgnT` |

## 6. DoR (ตรวจแล้ว)

| รายการ | ผล |
|---|---|
| อนุมัติ Q6–Q8 และ Q7 ตัวเลือก A | ผ่าน |
| Baseline ของไฟล์ที่จะแตะ (`home-hub.tsx` และอื่น ๆ) เก็บแล้ว และตรวจ diff ค้าง | ผ่าน |
| Build ล่าสุดของ working tree และ hash ตรง | ผ่าน (91 ไฟล์ ไม่มี mismatch) |
| Test DB `sa_web_test_p1` และ storage แยก | ผ่าน |
| Red ก่อนแก้ | ผ่าน (4.1) |

## 7. DoD (ตรวจแล้ว)

| รายการ | ผล |
|---|---|
| T-01 ถึง T-06 และ T-07 ถึง T-10 ผ่าน | ผ่าน |
| Regression ของ `test:runtime`, `test:stale-task`, `audit:runtime` | ผ่าน |
| `test:runtime:browser`, `visual`, `management` ไม่มี regression ใหม่ | ผ่าน: violation 0 บน staged-only tree (§14.2) |
| `typecheck`, `lint` ผ่าน | ผ่าน |
| ไม่แก้ไฟล์นอก Scope | ผ่าน (รายการใน §2 เท่านั้น) |
| ไม่ commit ไม่ push | ผ่าน |
| `graphify update .` และ `graphify affected` | ผ่าน: `workspace()` มี caller 3 จุด (API GET, AppPage, HomePage) ตรวจแล้ว |
| หลักฐานก่อนและหลัง | ผ่าน (red และ green ใน evidence) |

**ข้อจำกัดของ DoD:** ยังไม่ได้ตรวจด้วยภาพหน้าจอสำหรับแบนเนอร์และ picker (ไม่มีกฎ DoD ข้อนี้ในแผน แต่แนะนำให้ทำก่อนรวม)

## 8. ECC (Acceptance Criteria)

| ECC | สถานะ | หลักฐาน |
|---|---|---|
| AC-1 ไม่เลือกบ้านให้เองเมื่อไม่มีบ้าน | ผ่าน | T-01, T-02, T-03 |
| AC-2 บ้านที่เลือกอยู่ใน URL และหัวหน้าจอ | ผ่าน | T-05 |
| AC-5 สิทธิ์ไม่เปลี่ยน | ผ่าน | T-06 (ช่างที่ไม่ได้รับมอบหมาย) และ `test:runtime` (AUTH-05) |
| AC-11 รีโหลดจากสถานะไม่มีบ้านไม่สร้างบ้าน | ผ่าน | T-04 (ด้วย SCR-01 ตามข้อ 4.3) |
| AC-12 SCR-01 ไม่ต้องบ้าน | ผ่าน | T-08 |
| AC-15 ลูกค้าได้บ้านของตนเองโดยไม่มีพารามิเตอร์ (Q8) | ผ่าน | T-07 |
| AC-16 ช่าง/ฝ่ายตรวจที่เปิดหน้าต้องใช้บ้านโดยไม่มีบ้านถูกส่งไป `/home` | ผ่าน | T-01, T-03 |
| Q7-AC-1 `next` ที่ถูกต้องพาไปปลายทางหลังเลือกบ้าน | ผ่าน | T-05, T-10 และ deep-link valid cases |
| Q7-AC-2 `next` ที่ไม่ถูกต้องถูกละเว้น (external, protocol-relative, traversal, unit, duplicate, malformed) | ผ่าน | T-09 และ deep-link invalid cases (30 กรณี) |
| Q7-AC-3 ไม่มี open redirect (หน้า `/home` ไม่ redirect ไป `next`) | ผ่าน | โค้ดตรวจแล้ว และ deep-link ปฏิเสธ `//` และ `\` |
| AC-6, AC-8, AC-13, AC-14 | นอก Phase 1A | เป็น Phase 1C และ 1D และ 1B |
| AC-10 (F5) | นอก Scope ตาม Q6 | |
| AC-3, AC-4, AC-7 | บล็อกโดย Q1–Q4 | Phase 2 |
| AC-9 | Phase 3 | |

## 9. ข้อจำกัดที่ยังมี

1. **Q8 เชิงอนาคต:** ลูกค้าที่มีหลายบ้านจะได้ `unit: null` แต่ยังไม่มี UI ให้ลูกค้าเลือกบ้าน ปัจจุบันระบบไม่มีลูกค้าที่มีหลายบ้าน จึงไม่กระทบ ต้องทำก่อนเปิดใช้งานหลายบ้าน
2. **F7 ไม่ใช่ Known Failure ของ Phase 1A:** `aria-prohibited-attr` จาก `<label aria-label="ปิดเมนู">` อยู่ใน `manage-ui.tsx` ของ UI-1 ที่ยัง unstaged ไม่ได้อยู่ใน `HEAD` หรือ Phase 1A (ดู §14.3) ต้องแก้ใน UI-1 ก่อนตรวจรับหรือ commit UI-1
3. **Graph:** `graphify` เก็บโฟลเดอร์ `sa-web-isolated*` ไว้ด้วย ทำให้ชื่อ `workspace` ซ้ำ ควรเพิ่ม `sa-web-isolated*/` ใน `.graphifyignore` (ไม่ได้แก้เองเพราะอยู่นอก Scope)
4. **Environment:** `prepare` รีเซ็ตรหัสทุกบัญชีในฐาน test ที่ใช้ร่วมกัน ต้องรันทีละ environment
5. **Process:** 3001 และ 3002 และ 3003 ที่เปิดด้วย shell ของเซสชันนี้ยังทำงานอยู่ แต่อาจหายได้เมื่อ shell สิ้นสุด 3000 เปิดใหม่ตามที่อนุมัติ
6. **การแก้เทสต์** ตามข้อ 4.3 ทุกข้อเป็นการเปลี่ยน precondition หรือ selector ไม่ใช่การลดความเข้มของการตรวจ

## 10. ประเด็นที่ต้องตัดสินใจก่อนดำเนินการต่อ

1. ตรวจรับ Phase 1A และอนุมัติให้ commit หรือยัง (ยังไม่ commit)
2. ต้องการภาพหน้าจอของแบนเนอร์และ picker ก่อนรวมหรือไม่
3. อนุมัติให้เพิ่ม `sa-web-isolated*/` ใน `.graphifyignore`
4. Phase ถัดไป: SEC-01 รอการตรวจ §11 ของ `SECURITY-FINDING-LOGIN-GET.md` ก่อนแก้

---

## 11. รอบตรวจรับ (ปิดเงื่อนไขก่อน Commit)

### 11.1 test:pilot (แก้เงื่อนไขแล้ว: ระบุเหตุผลที่ใช้ผลนี้ตรวจรับไม่ได้)

- route ทั้ง `/pilot/technician`, `/pilot/report`, `/pilot/status` เป็น **retired**: `src/app/pilot/*/page.tsx` เรียก `redirect("/app")`
- สคริปต์ `test-pilot.mjs` ไม่ล็อกอิน จึงถูกส่งต่อไป `/login`:
  - ตรวจแล้ว: `curl -L /pilot/technician` ได้ `/login` บนทั้ง 3000 และ 3003
  - การ "route PASS" ทั้ง 24 รายการวัดหน้า `/login` ไม่ใช่หน้า pilot
  - ทั้ง 11 interaction FAIL เพราะหน้าที่ได้ไม่มีองค์ประกอบ pilot
- **ความต่างระหว่างการรันครั้งก่อนกับล่าสุด:** การรันครั้งแรกล้มที่ฟอนต์ เพราะ process 3000 ชุดแรกเริ่มก่อน build 23:25 และอาจวัดหน้าอื่นที่ไม่ใช่ `/login` (ไม่มีหลักฐานเก็บไว้) process ปัจจุบันเริ่ม 00:43 น. วันที่ 9 พ.ย. ทำให้ล้มที่ assertion ของ no-JS ซึ่งเป็นผลจาก redirect ไม่ใช่ความต่างของ Phase 1A
- **รันบน Build ที่ถูกต้อง:** รันสคริปต์เดิมกับ 3003 (Phase 1A build, copy เท่านั้น) ผล route PASS ทั้งหมดแต่วัด `/login` และ interaction FAIL ทั้งหมด
- **ข้อสรุป:** test:pilot **ไม่สามารถใช้ตรวจรับ Phase 1A ได้** เพราะทดสอบ route ที่ถูกยกเลิกแล้ว จึงบันทึกเป็น **BLOCKED (retired test)** ไม่สรุปว่า PASS
- หลักฐาน: `sa-web-isolated-p1a/evidence/pilot-browser.json` (ผลจาก 3003)
- **ข้อเสนอ (ยังไม่ดำเนินการ):** ยกเลิก `test:pilot` จาก pipeline และแทนด้วยชุด P1 ที่ตรงกับเส้นทางปัจจุบัน ต้องได้รับอนุมัติก่อนแก้

### 11.2 ภาพหน้าจอ (ข้อมูลทดสอบสังเคราะห์ จาก `sa_web_test_p1` และ seed ที่ระบุว่าเป็นข้อมูลสมมติ)

ที่ `evidence/phase-1a/screenshots/` (ความกว้าง 1280, บัญชี SALES ทดสอบ):

| ไฟล์ | แสดงอะไร |
|---|---|
| `01-banner-no-house-context.png` | แบนเนอร์ "เลือกบ้านก่อนเปิด…" เมื่อ deep link `/app?screen=SCR-09` ไม่มีบ้าน ระบบส่งไป `/home?next=…` |
| `02-house-picker-before-selection.png` | House Picker ก่อนเลือกบ้าน แสดงรายการบ้านทั้งหมด พร้อมลิงก์ "เปิดบ้าน" ที่มีปลายทาง |
| `03-after-house-selected.png` | หลังเลือกบ้าน URL เป็น `/app?screen=SCR-09&unit=H0002` แสดงหัวบ้าน 88/2 และหน้า SCR-09 |
| `04-deep-link-return-after-reload.png` | หลังรีโหลด ยังอยู่ที่ SCR-09 ของบ้านเดิม (`unit` ยังอยู่ใน URL) |
| `capture-log.json` | ลำดับ URL ของแต่ละขั้นตอน |

**ข้อสังเกตจากการตรวจภาพ (ไม่แก้ในรอบนี้ เพราะจะต้องทดสอบซ้ำ):**
1. ข้อความแบนเนอร์เขียนติดกันเป็น "เลือกบ้านก่อนเปิดส่งลิงก์เข้าสู่ระบบให้ลูกค้า" อ่านไม่ชัด ข้อเสนอคือ "เลือกบ้านก่อน จึงจะเปิด: ส่งลิงก์เข้าสู่ระบบให้ลูกค้า" (ต้องอนุมัติ)
2. Picker ไม่มีสถานะ "เลือกแล้ว" เพราะหลังคลิกจะย้ายไปหน้าบ้านทันที ภาพ 03 แทนสถานะหลังเลือก
3. ภาพยืนยันว่าเมนูซ้ายซ้อนกันสองชุดบน desktop (F1) อยู่ใน Phase 1B ตามเดิม
4. ชื่อบุคคลในภาพมาจาก seed สมมติ `db/seed-p1.sql` ซึ่งระบุว่าชื่อคนและข้อมูลติดต่อเป็นข้อมูลสมมติ

### 11.3 `.graphifyignore`

- เพิ่มเฉพาะบรรทัด `sa-web-isolated*/` ท้ายไฟล์ ไม่แก้กฎอื่น
- ผลหลัง `graphify update .`: ไม่มี node จาก `sa-web-isolated*` ใน `graph.json` และ `graphify affected "sa_web_src_server_workspace_workspace"` ยังได้ caller เดิม 3 จุด

### 11.4 Final Diff และ DoD / ECC

- Diff ของไฟล์ที่มี baseline: `evidence/phase-1a/changes.patch`
- Diff ของไฟล์ใหม่: `evidence/phase-1a/new-files.patch` (ไฟล์ใหม่ 3 ไฟล์ และ `deep-link.ts`)
- ขนาดการเปลี่ยนแปลง (บรรทัด): `workspace.ts` +7/−1, `app/app/page.tsx` +11/−0, `app/home/page.tsx` +12/−3, `home-hub.tsx` +19/−2, `test-runtime-visual.mjs` +10/−2
- DoD และ ECC ตามข้อ 7 และ 8 ไม่มีการเปลี่ยนสถานะ ยกเว้น test:pilot ที่เปลี่ยนเป็น BLOCKED (retired test)

### 11.5 Known Limitations ที่ผู้ตรวจรับยอมรับ

1. ลูกค้าที่มีหลายบ้านยังไม่มี UI เลือกบ้าน (งานก่อนมีลูกค้าลักษณะนี้จริง)
2. F7 ไม่ใช่ Known Failure ของ Phase 1A (ดู §14.3) ต้องแก้ใน UI-1 ก่อนตรวจรับหรือ commit UI-1
3. Graphify เก็บ isolated environment เป็นประเด็นแยก (แก้แล้วด้วย `.graphifyignore`)

---

## 12. รอบหลังอนุมัติ: ถอด test:pilot, แก้ Banner, ตรวจซ้ำ (9 พฤศจิกายน 2569)

ส่วนนี้มีผลแทน §7 และ §11.2 ข้อ 1–2 ที่ระบุข้อความ banner และสถานะเดิม

### 12.1 สิ่งที่ทำตามการอนุมัติ

| รายการ | การเปลี่ยนแปลง | ไม่เปลี่ยน |
|---|---|---|
| test:pilot | ถอดออกจากขั้นตอนตรวจงานใน `README-P1.md` และรายการทดสอบซ้ำใน `docs/UX-PHASE-PLAN.md` | `scripts/test-pilot.mjs`, entry ใน `package.json`, หลักฐานเดิมทั้งหมด, สถานะ BLOCKED (retired test) |
| Banner | `src/components/home-hub.tsx` เปลี่ยนข้อความเป็น "เลือกบ้านก่อน แล้วจึงจะส่งลิงก์ได้" และลบ import `screens` ที่ไม่ได้ใช้แล้ว (ป้องกัน lint error) | logic, role, URL, การตรวจ `next` ทั้งหมด |
| ข้อความที่ค้นหาใน T-09 และ T-10 | `scripts/test-unit-selection.mjs` เปลี่ยน string ที่ค้นหาเป็นข้อความใหม่ 2 จุด (การเปลี่ยน string เท่านั้น ไม่ลดการตรวจ) | จำนวน เงื่อนไข และ selector อื่น |
| Screenshot | ถ่ายใหม่ 4 ภาพหลังแก้ banner ภาพ 01 เดิมตัดแบนเนอร์ออก จึงปรับ clip จาก 420 เป็น 480 px ใน `scripts/phase-1a-screenshots.mjs` (ใน isolated copy) | ข้อมูลทดสอบ |

### 12.2 ผลทดสอบหลังแก้ (isolated 3003, build หลังแก้ banner, รัน `prepare` ก่อนทุกชุด)

| ชุด | ผล | รายละเอียด |
|---|---|---|
| `typecheck` | PASS | `next typegen && tsc --noEmit` |
| `lint` | PASS | ไม่มี error หลังลบ import ที่ไม่ได้ใช้ |
| `test-unit-selection` (T-01–T-10) | PASS 10/10 | ข้อความ banner ใหม่ |
| `test-deep-link` | PASS 35/35 | |
| `test-runtime` | PASS 35/35 | |
| `test-stale-task` | PASS | |
| `runtime-traceability` (`audit:runtime`) | PASS | Mapped 77 query IDs |
| `test-runtime-browser` | FAIL (วัดบน working tree ที่มี UI-1) | 16/16 กรณี PASS, 152 layout, violation 8 ของ F7 ซึ่งเป็นของ UI-1 ไม่ใช่ Phase 1A, ไม่มี page error |
| `test-management` | FAIL (วัดบน working tree ที่มี UI-1) | 21/21 กรณี PASS, violation 18 ของ F7 ซึ่งเป็นของ UI-1 ไม่ใช่ Phase 1A, ไม่มี page error |
| `test-runtime-visual` | FAIL (วัดบน working tree ที่มี UI-1) | violation 36 ของ F7 ซึ่งเป็นของ UI-1 ไม่ใช่ Phase 1A |
| `test-pilot` | BLOCKED (retired test) | ไม่รัน เพราะถูกถอดออกจาก pipeline ตามอนุมัติ |

จำนวน violation 8 / 18 / 36 ด้านบนวัดบน working tree ที่มี UI-1 ไม่ใช่ `HEAD` และไม่ใช่หลักฐานของ Phase 1A บน staged-only tree ผลบน staged-only tree คือ 0 ทั้งสามชุด (§14.2) ดู §14.3

Log และ evidence: `evidence/phase-1a/regression-after-banner/`

### 12.3 ภาพหน้าจอ (ถ่ายใหม่ 9 พ.ย. ข้อมูลสังเคราะห์ใน `sa_web_test_p1`, viewport 1280)

| ไฟล์ | ตรวจแล้ว |
|---|---|
| `evidence/phase-1a/screenshots/01-banner-no-house-context.png` | แบนเนอร์ใหม่ "เลือกบ้านก่อน แล้วจึงจะส่งลิงก์ได้" อยู่ใต้ช่องค้นหา |
| `evidence/phase-1a/screenshots/02-house-picker-before-selection.png` | รายการบ้านทั้งหมดพร้อมแบนเนอร์ (ภาพแบบเต็มหน้า) |
| `evidence/phase-1a/screenshots/03-after-house-selected.png` | หลังเลือก 88/2 หน้า SCR-09 "ส่งลิงก์เข้าสู่ระบบให้ลูกค้า" |
| `evidence/phase-1a/screenshots/04-deep-link-return-after-reload.png` | SHA-256 เท่ากับ 03 (ยืนยันว่าหลังรีโหลดยังอยู่หน้าเดิม) |

ข้อสังเกตที่ยังไม่แก้: Picker ไม่มีสถานะ "เลือกแล้ว" เพราะคลิกแล้วย้ายหน้าทันที และภาพ 02 แสดงเมนูซ้ายซ้อนสองชุดบน desktop (F1, Phase 1B)

### 12.4 Changed Files และ Diff (เทียบ baseline snapshot หรือ HEAD ตามคอลัมน์ฐาน)

| ไฟล์ | สถานะ | +/− | ฐาน |
|---|---|---|---|
| `src/server/workspace.ts` | แก้ | +7 / −1 | HEAD |
| `src/app/app/page.tsx` | แก้ | +11 / −0 | HEAD |
| `src/app/home/page.tsx` | แก้ | +12 / −3 | HEAD |
| `src/components/home-hub.tsx` | แก้ | +18 / −1 | baseline (ดู 12.5) |
| `src/lib/deep-link.ts` | ใหม่ | | |
| `scripts/db-common.mjs` | แก้ | +10 / −0 | HEAD |
| `scripts/prepare-runtime-test.mjs`, `test-runtime.mjs`, `test-runtime-browser.mjs`, `test-management.mjs`, `test-stale-task.mjs` | แก้ (พอร์ตจาก env) | +2 / −2 ต่อไฟล์ | HEAD |
| `scripts/test-runtime-visual.mjs` | แก้ | +12 / −4 | HEAD |
| `scripts/test-unit-selection.mjs` | ใหม่ | | |
| `scripts/test-deep-link.mjs` | ใหม่ | | |
| `README-P1.md` | แก้เอกสาร | | ถอด test:pilot |
| `docs/UX-PHASE-PLAN.md` | แก้เอกสาร | | ถอด test:pilot |
| `docs/PHASE-1A-REPORT.md` | แก้เอกสาร | | รายงานนี้ |
| `lastest/.graphifyignore` (นอก sa-web) | แก้ | +1 บรรทัด | ดู 12.6 |

Patch: `evidence/phase-1a/changes.patch` (ไฟล์เดิม) และ `evidence/phase-1a/new-files.patch` (ไฟล์ใหม่ 3 ไฟล์ รวม 345 บรรทัด)

**ไม่อยู่ใน Phase 1A และต้องไม่รวมใน commit นี้:**
- งาน UI-1 ที่ยังไม่ commit: `src/components/manage-ui.tsx`, `workbench.tsx`, `admin-panel.tsx`, `pilot-shell.tsx`, `src/app/globals.css` (Phase 1A ไม่แตะ `manage-ui.tsx` และ `workbench.tsx` ตรวจแล้วว่าเหมือน baseline)
- `src/components/home-hub.tsx` มี 45 บรรทัดจากงาน UI-1 ปนอยู่ (ดู 12.5)
- ไฟล์ `evidence/*` ที่ tracked ใน sa-web ซึ่งถูกเขียนทับจากการรันเทสต์
- Login ทั้งหมด (`src/app/login/*`, `src/components/login-form.tsx`, `src/server/auth.ts`), `scripts/test-sec-01-login.mjs`, `docs/SECURITY-*`: งาน SEC-01 แยก Phase
- `package.json`: ไม่เปลี่ยน

### 12.5 ประเด็นก่อน commit (พบในรอบนี้)

`home-hub.tsx` มีการเปลี่ยนแปลง 2 ชนิดปนกัน: Phase 1A 19 บรรทัด และงาน UI-1 ที่ยังไม่ commit 45 บรรทัด ถ้า commit ทั้งไฟล์ UI-1 จะเข้าไปใน Phase 1A ทันที
- ข้อเสนอ: stage เฉพาะ hunk ของ Phase 1A ผ่าน patch (`git apply --cached`) โดยไม่แตะ working tree ของ UI-1 หรือแยก UI-1 เป็น commit ของตัวเองหลังตรวจรับ
- ยังไม่ได้ stage หรือ commit ใด ๆ

### 12.6 `.graphifyignore`

- เพิ่มบรรทัดที่ 37 `sa-web-isolated*/` เท่านั้น บรรทัด 36 `graphify-out/` เป็นของเดิม
- ไฟล์อยู่ใน repo `sa` และยังไม่ tracked (`??`) จึงไม่มี git diff เทียบ ยืนยันจากเนื้อไฟล์แล้ว

### 12.7 DoD และ ECC ฉบับสุดท้าย

| DoD | สถานะ | หลักฐาน |
|---|---|---|
| T-01 ถึง T-10 | PASS | §12.2 |
| Deep-link 35 กรณี | PASS | §12.2 |
| Regression `test:runtime`, `test:stale-task`, `audit:runtime` | PASS | §12.2 |
| `test:runtime:browser`, `visual`, `management` ไม่มี regression ใหม่ | PASS: violation 0 บน staged-only tree | §14.2 |
| `typecheck`, `lint` | PASS | §12.2 |
| `test:pilot` | **BLOCKED (retired test)** ไม่นับเป็น PASS | §11.1, §12.1 |
| ภาพหน้าจอ banner และ picker | PASS (ถ่ายใหม่ 4 ภาพ) | §12.3 |
| ไม่แก้ไฟล์นอก Scope | PASS พร้อมหมายเหตุ: แก้เอกสาร `README-P1.md` และ `UX-PHASE-PLAN.md` เพื่อถอด test:pilot ตามอนุมัติ ไม่แก้ login, auth, `manage-ui.tsx`, `workbench.tsx`, `package.json` | §12.4 |
| `.graphifyignore` | PASS เฉพาะบรรทัดที่อนุมัติ | §12.6 |
| ไม่ commit ไม่ push | PASS, HEAD ยังเป็น `e569c83` | ตรวจแล้ว |
| Commit gate | **ยังไม่ผ่าน** รอการอนุมัติและการแก้ประเด็น 12.5 | |

| ECC | สถานะ |
|---|---|
| AC-1, AC-2, AC-5, AC-11, AC-12, AC-15, AC-16 | PASS (เดิม) |
| Q7-AC-1, Q7-AC-2, Q7-AC-3 | PASS (เดิม) |
| Banner copy | ไม่มี AC ของตัวเอง ผลต่อ T-09 และ T-10 ผ่านการตรวจซ้ำ |

ยืนยันว่า `src/app/login/*`, `src/components/login-form.tsx` และ `src/server/auth.ts` ไม่มีการเปลี่ยนแปลงเทียบ `HEAD` ณ วันที่ตรวจ

### 12.8 ข้อเสนอชุดทดสอบ P1 (เสนอเท่านั้น ยังไม่สร้างหรือเปลี่ยน pipeline)

- **Scope:** แทน `test:pilot` ด้วยชุดที่ครอบคลุมเส้นทางปัจจุบัน ได้แก่ การเลือกบ้าน (T-01–T-10), deep link (35 กรณี), SEC-01 (SEC-T1–T5b หลังแก้โค้ด), runtime, stale-task และ traceability
- **Acceptance:** ทุกชุด PASS, `typecheck` และ `lint` PASS, ไม่มี `/pilot/*` ในชุดทดสอบ (F7 ไม่ใช่เงื่อนไขของ P1 เพราะต้นเหตุอยู่ใน UI-1 ที่ยังไม่ commit)
- **ต้องอนุมัติก่อน** จึงจะเขียนสคริปต์หรือแก้ `package.json`

---

## 13. Commit Gate: Staged Diff (ยังไม่ commit)

- HEAD: `e569c83` ไม่เปลี่ยน ยังไม่มี commit หรือ push
- Staged 15 ไฟล์ (12 แก้ไข และ 3 ไฟล์ใหม่ คือ `src/lib/deep-link.ts`, `scripts/test-unit-selection.mjs`, `scripts/test-deep-link.mjs`): `git diff --cached --stat` = 15 files, +467 / −21
- Full diff: `evidence/phase-1a/staging/staged.diff`, stat: `staged.stat`, รายชื่อ: `staged.names`
- `src/components/home-hub.tsx`: stage เฉพาะ hunk ของ Phase 1A (+18 / −1) โดยสร้างเนื้อจาก HEAD ด้วย anchor ที่ต้องพบเพียงครั้งเดียว (`staging/build-staged-home-hub.mjs`) แล้ว apply patch `staging/stage-home-hub.patch` เข้า index ด้วย `git apply --cached`
  - การ `patch` ตรงกับ hunk ของ baseline ล้มที่ hunk import เพราะ context ของ hunk รวมบรรทัดของ UI-1 (`const statusBadgeMap`) ที่ไม่มีใน HEAD จึงไม่บังคับ apply ใช้วิธี anchor แทน
  - ตรวจแล้ว: ชุดบรรทัด UI-1 ที่ต่างระหว่าง staged กับ working tree (45 บรรทัด) ตรงกับชุดที่ต่างระหว่าง HEAD กับ baseline ทุกบรรทัด และไม่มีบรรทัดเพิ่มของ UI-1 อยู่ในส่วน staged (0 จาก 26)
- ไฟล์ที่ไม่ได้ stage: งาน UI-1 (`manage-ui.tsx`, `workbench.tsx`, `admin-panel.tsx`, `pilot-shell.tsx`, `globals.css`, ส่วน UI-1 ของ `home-hub.tsx`), `evidence/*` ที่ tracked, docs ที่ยังไม่ track, `evidence/phase-1a/`, `scripts/test-sec-01-login.mjs`
- ไม่มี login code, `auth.ts`, `package.json` หรือไฟล์นอก Scope ใน staged
- Working tree: checksum 57 ไฟล์ ก่อนและหลัง stage ตรงกันทั้งหมด (`staging/worktree-before.sha256`)
- ตรวจ staged tree แยก (export ของ index ไปโฟลเดอร์ชั่วคราว): `next typegen`, `tsc --noEmit`, `eslint` ผ่านทั้งหมด
  - ผล staged-only ดูใน §14 (เทสต์ก่อนหน้านี้รันบน working tree ที่มี UI-1 จึงไม่ใช่หลักฐานของ staged tree โดยตรง)
- `.graphifyignore` อยู่ใน repo `sa` (ไม่ใช่ `sa-web`) และยังไม่ track จึงไม่อยู่ใน staged diff ของ sa-web

**Commit gate:** รอการอนุมัติ ห้าม commit หรือ push จนกว่าจะได้รับการอนุมัติอย่างชัดเจน

---

## 14. Staged-only Verification และ Final Commit Gate

### 14.1 วิธีตรวจ

- สร้างพื้นที่ทดสอบจาก Git index ด้วย `git checkout-index -a` ไปที่ `lastest/sa-web-isolated-staged/` เนื้อหาเท่ากับ `git diff --cached` และไม่มีไฟล์ UI-1 ที่ยัง unstaged (ไฟล์ UI-1 ใน index เท่ากับ HEAD)
- ตรวจแล้ว: sha256 ของ `manage-ui.tsx`, `workbench.tsx`, `admin-panel.tsx`, `pilot-shell.tsx`, `globals.css` ใน export เท่ากับ HEAD ส่วน `home-hub.tsx`, `home/page.tsx`, `app/page.tsx`, `workspace.ts`, `deep-link.ts` เท่ากับ index (ตัด CR ก่อนเปรียบเทียบ)
- ไฟล์ที่ export ออกมาเป็น CRLF เพราะ `core.autocrlf=true` ขณะ checkout (blob ใน index เป็น LF) เนื้อหาไม่ต่างกันเมื่อตัด CR
- Isolated environment: `.env.local` คัดลอกจาก isolated copy และเปลี่ยนพอร์ตเป็น 3004 (`SA_TEST_PORT=3004`) ใช้ฐาน `sa_web_test_p1` เท่านั้น ไม่แตะ dev หรือ production DB
- ไม่มี commit, ไม่มี push, ไม่เปลี่ยน HEAD, ไม่แก้ working tree ของ `sa-web`
- Build: `next typegen` และ `next build` ผ่าน (exit 0) และ `next start` บนพอร์ต 3004 ตอบ 200

### 14.2 ผลตามจริง (staged-only, `prepare` ก่อนทุกชุด)

| ชุด | ผล | รายละเอียด |
|---|---|---|
| `typecheck` (`tsc --noEmit`) และ `lint` (`eslint`) บนการ export | PASS | ผ่านก่อนหน้า ก่อน build |
| `build` | PASS | exit 0 |
| `test-unit-selection` (T-01–T-10) | PASS 10/10 | |
| `test-deep-link` | PASS 35/35 | |
| `test-runtime` | PASS 35/35 | |
| `test-stale-task` | PASS | |
| `audit:runtime` | PASS | Mapped 77 query IDs |
| `test-runtime-browser` | PASS 16/16 | 152 layouts, violation 0, errors 0 |
| `test-management` | PASS 21/21 | 18 scans, violation 0, page errors 0 |
| `test-runtime-visual` | PASS | 38 screens, violation 0 |
| `test:pilot` | BLOCKED (retired test) | ถอดออกจาก pipeline แล้ว ไม่รันซ้ำ |

Log และ JSON: `evidence/phase-1a/staged-only/` (ไม่อยู่ใน commit ดู 14.5)

### 14.3 การแก้ไขข้อความเดิมเรื่อง F7 (สำคัญ)

- ใน staged-only tree ไม่มี violation `aria-prohibited-attr` เลยในทุกชุด (browser 0, management 0, visual 0)
- ใน staged-only tree ไม่มี violation `aria-prohibited-attr` ในทุกชุด (browser 0, management 0, visual 0)
- ตัวเลข 8 / 36 / 18 ที่บันทึกก่อนหน้า วัดบน working tree ซึ่งมีงาน UI-1 ที่ยังไม่ commit ไม่ใช่บน `HEAD`
- ตรวจแล้ว: `aria-label="ปิดเมนู"` และ `drawer-overlay` มีอยู่ใน `manage-ui.tsx` ของ working tree (2 และ 1 จุด) แต่ไม่มีใน `HEAD` (0 และ 0 จุด)
- **การตัดสินของผู้ตรวจรับ:** F7 ไม่ใช่ Known Failure ของ Phase 1A เพราะ Phase 1A ไม่มี violation ดังกล่าว ต้นเหตุอยู่ใน UI-1 ที่ unstaged และต้องแก้ก่อนตรวจรับหรือ commit UI-1 รอบนี้ไม่แก้ UI-1 และไม่นำ UI-1 เข้า commit Phase 1A
- เอกสาร `docs/UX-PHASE-PLAN.md` §12 ที่บันทึกตัวเลข baseline ก่อนแก้ ไม่ได้ commit และวัดบน working tree จึงใช้เป็นประวัติเท่านั้น

### 14.4 DoD และ ECC ฉบับสุดท้าย (Phase 1A, staged-only)

| DoD | สถานะ | หลักฐาน |
|---|---|---|
| T-01–T-10 | PASS | §14.2 |
| Deep link 35 กรณี | PASS | §14.2 |
| Regression `test:runtime`, `test:stale-task`, `audit:runtime` | PASS | §14.2 |
| `test:runtime:browser`, `visual`, `management` ไม่มี regression ใหม่ | PASS | violation 0 ทั้งสามชุดบน staged tree |
| `typecheck`, `lint`, `build` | PASS | §14.2 |
| `test:pilot` | BLOCKED (retired test) ไม่นับเป็น PASS | §11.1 |
| ภาพหน้าจอ banner และ picker | PASS | §12.3 |
| ไม่แก้ไฟล์นอก Scope | PASS | §13 staged list ไม่มี login, `auth.ts`, `package.json`, UI-1 |
| `.graphifyignore` | อยู่นอก repo `sa-web` ไม่อยู่ใน commit | §12.6 |
| ไม่ commit ไม่ push | PASS | HEAD ยังเป็น `e569c83` |
| Commit gate | รออนุมัติ | |

| ECC | สถานะ |
|---|---|
| AC-1, AC-2, AC-5, AC-11, AC-12, AC-15, AC-16 | PASS |
| Q7-AC-1, Q7-AC-2, Q7-AC-3 | PASS |
| Banner copy | ไม่มี AC ของตัวเอง ผลต่อ T-09 และ T-10 ผ่าน |

### 14.5 ข้อจำกัดของการอ้างอิง Evidence (รายงานนี้อ้างอิงไฟล์ที่ไม่ได้อยู่ใน commit)

รายงานนี้อ้างอิงไฟล์เหล่านี้ แต่ **ไม่อยู่ใน commit นี้** ผู้อ่านจาก repo จะเปิดไม่ได้จนกว่าจะมีการ commit แยก หรือเข้าถึงจากเครื่องที่รันการทดสอบ:

- `evidence/phase-1a/` ทั้งโฟลเดอร์ (patch, screenshots, regression log, staging และ staged-only logs) ยังไม่ได้ stage
- `docs/UX-PHASE-PLAN.md` ซึ่งเป็น Master Plan ยังไม่ได้ stage ตามคำตัดสิน
- `docs/SECURITY-FINDING-LOGIN-GET.md`, `docs/SECURITY-SEC-01-PLAN-v2.md`, `docs/UX-WORKFLOW-REVIEW.md` ยังไม่ได้ stage
- `scripts/test-sec-01-login.mjs` ยังไม่ได้ stage (SEC-01 แยก Scope)
- `scripts/phase-1a-screenshots.mjs`, `scripts/test-pilot-3003.mjs` และ `sa-web-isolated*/` อยู่ใน isolated copy ที่อยู่นอก commit
- `.graphifyignore` อยู่ใน repo `sa` ระดับบนและยังไม่ track
- ไฟล์ `sa-web-isolated-p1a/evidence/pilot-browser.json` ที่ §11.1 อ้างอิง อยู่นอก repo

### 14.6 Final Staged File List

16 ไฟล์ที่อนุมัติ: โค้ดและ harness 15 ไฟล์ (+467 / −21) และรายงานนี้ `docs/PHASE-1A-REPORT.md` (+426) รวม +893 / −21 รายการไฟล์ตาม `git diff --cached --name-status` ได้แก่ `README-P1.md`, `docs/PHASE-1A-REPORT.md`, `scripts/db-common.mjs`, `scripts/prepare-runtime-test.mjs`, `scripts/test-deep-link.mjs`, `scripts/test-management.mjs`, `scripts/test-runtime-browser.mjs`, `scripts/test-runtime-visual.mjs`, `scripts/test-runtime.mjs`, `scripts/test-stale-task.mjs`, `scripts/test-unit-selection.mjs`, `src/app/app/page.tsx`, `src/app/home/page.tsx`, `src/components/home-hub.tsx`, `src/lib/deep-link.ts`, `src/server/workspace.ts`

**Commit gate:** ยังไม่อนุมัติ Commit หรือ Push ตามคำตัดสินรอบนี้
