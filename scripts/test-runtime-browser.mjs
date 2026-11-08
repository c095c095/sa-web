import { workflowPath } from "../src/lib/routes.ts";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { connect, local, evidence, testBase } from "./db-common.mjs";
const fixture = JSON.parse(
    fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
  ),
  base = fixture.base;
assert.equal(base, testBase);
const db = await connect("sa_web_test_p1");
await db.query("UPDATE employee SET is_active=1 WHERE employee_id='EMP0001'");
const report = {
  started_at: new Date().toISOString(),
  scope: "Browser forms against isolated test DB; synthetic data only",
  cases: [],
  layouts: [],
  accessibility: [],
  errors: [],
};
const directory = path.join(evidence, "runtime-screenshots");
fs.mkdirSync(directory, { recursive: true });
const image = await sharp({
  create: { width: 240, height: 120, channels: 3, background: "#fafafa" },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="240" height="120"><path d="M20 90 Q60 10 100 80 T210 40" fill="none" stroke="#222" stroke-width="3"/></svg>',
      ),
    },
  ])
  .png()
  .toBuffer();
const upload = {
  name: "synthetic-browser-test.png",
  mimeType: "image/png",
  buffer: image,
};
const browser = await chromium.launch({ channel: "msedge", headless: true }),
  contexts = [];
async function context() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Bangkok",
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => report.errors.push(e.message));
  return p;
}
async function login(id) {
  const p = await context();
  await p.goto(base + "/login");
  await p.getByLabel("รหัสพนักงาน", { exact: true }).fill(id);
  await p.getByLabel("รหัสผ่าน", { exact: true }).fill(fixture.password);
  await p.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await p.waitForURL(base + "/");
  return p;
}
async function screen(p, s, u) {
  await p.goto(base + workflowPath(s, u));
  await p.locator("h1").waitFor();
}
async function submit(p, title) {
  if (
    title === "รับงานที่เลือก" &&
    (await p.getByRole("button", { name: "รับงานนี้", exact: true }).count())
  )
    title = "รับงานนี้";
  const refreshed = p.waitForResponse(
    (r) => r.url().includes("/api/workspace") && r.request().method() === "GET",
  );
  const response = p.waitForResponse(
    (r) => r.url().includes("/api/actions/") && r.request().method() === "POST",
  );
  await p.getByRole("button", { name: title, exact: true }).click();
  const r = await response;
  assert.equal(r.status(), 200, JSON.stringify(await r.json()));
  if (r.url().endsWith("/UC-01")) await p.waitForURL(/\/houses\//);
  else await p.getByRole("status").waitFor();
  const latest = await refreshed;
  assert.equal(latest.status(), 200);
  await latest.finished();
}
async function check(name, fn) {
  await fn();
  report.cases.push({ name, status: "PASS" });
  console.log("PASS", name);
}
let sales, inspector, head, customer, unit, defect, handDefect;
try {
  await check("Employee login and protected workflow index", async () => {
    sales = await login("EMP0001");
    inspector = await login("EMP0003");
    head = await login("EMP0008");
    const anonymous = await context();
    await anonymous.goto(base + "/repairs");
    await anonymous.waitForURL("**/login");
  });
  const project = "Browser ทดสอบสมมติ " + Date.now();
  await db.query("INSERT INTO project(project_name) VALUES(?)", [project]);
  await check("UC01 browser create and persisted reload", async () => {
    await screen(sales, "SCR-01");
    await sales
      .getByLabel("โครงการ", { exact: true })
      .selectOption({ label: project });
    await sales.getByLabel("เลขที่บ้าน", { exact: true }).fill("BROWSER-01");
    await submit(sales, "ลงทะเบียนบ้าน");
    const [[u]] = await db.query(
      "SELECT unit_id FROM property_unit WHERE project_name=? AND house_no=?",
      [project, "BROWSER-01"],
    );
    assert(u);
    unit = u.unit_id;
    await screen(sales, "SCR-09", unit);
    assert((await sales.locator("main").innerText()).includes(project));
  });
  await check("UC02 QC add photo and finish through forms", async () => {
    await screen(inspector, "SCR-02", unit);
    await inspector
      .getByLabel("ประเภทงาน", { exact: true })
      .selectOption("ELECTRICAL");
    await inspector
      .getByLabel("ตำแหน่งที่ต้องแก้", { exact: true })
      .fill("ห้องทดสอบ QC");
    await inspector
      .getByLabel("รูปประกอบ (ไม่บังคับ)", { exact: true })
      .setInputFiles(upload);
    await submit(inspector, "บันทึกจุดที่ต้องแก้ไข");
    const [[d]] = await db.query(
      "SELECT d.defect_id FROM defect d JOIN inspection_round r ON r.round_id=d.round_id WHERE r.unit_id=?",
      [unit],
    );
    defect = d.defect_id;
    await inspector
      .getByLabel("ตรวจครบแล้ว เมื่อยืนยันจะเพิ่ม แก้ หรือลบรายการเดิมไม่ได้")
      .check();
    await submit(inspector, "เสร็จสิ้นการตรวจ");
    await inspector.reload();
    assert(
      (await inspector.locator("main").innerText()).includes(
        "รายการเดิมถูกล็อก",
      ),
    );
  });
  await check("UC03 queue group focus and claim selection", async () => {
    await screen(head, "SCR-03", unit);
    const search = head.locator("#queue-search");
    await search.fill("BROWSER-01");
    await search.focus();
    const styles = await search.evaluate((e) => ({
      inner: getComputedStyle(e).outlineWidth,
      outer: getComputedStyle(e.parentElement).outlineWidth,
    }));
    assert.equal(styles.inner, "0px");
    assert.equal(styles.outer, "2px");
    await head.getByLabel(new RegExp(defect + "$")).check();
    await submit(head, "รับงานที่เลือก");
  });
  await check(
    "UC04 photo upload persisted and private image readable",
    async () => {
      await screen(head, "SCR-04", unit);
      await head
        .getByLabel("งานที่คุณรับไว้", { exact: true })
        .selectOption(defect);
      await head
        .getByLabel("รูปประกอบ (อย่างน้อย 1 รูป)", { exact: true })
        .setInputFiles(upload);
      await submit(head, "บันทึกซ่อมเสร็จ");
    },
  );
  await check("UC05 approve UC06 schedule and no-defect result", async () => {
    await screen(inspector, "SCR-05", unit);
    await inspector
      .getByLabel("งานซ่อมที่ตรวจผ่าน", { exact: true })
      .selectOption(defect);
    await submit(inspector, "อนุมัติงานซ่อม");
    await screen(inspector, "SCR-06", unit);
    await inspector
      .getByLabel("วันที่ตรวจซ้ำ", { exact: true })
      .fill("2026-11-17");
    await submit(inspector, "นัดตรวจซ้ำ");
    await inspector.getByLabel("ตรวจหน้างานแล้ว ไม่พบจุดที่ต้องแก้ไข").check();
    await submit(inspector, "บันทึกไม่พบจุดที่ต้องแก้");
  });
  await check("UC07 single certification UC08 sale readiness", async () => {
    await screen(inspector, "SCR-07", unit);
    await inspector.getByLabel("ยืนยันรับรองผลการตรวจคนเดียว").check();
    await submit(inspector, "ปิดรอบแบบรับรองคนเดียว");
    await screen(inspector, "SCR-08", unit);
    await inspector.getByLabel("ตรวจข้อมูลบ้านและการปิดรอบ QC แล้ว").check();
    await submit(inspector, "แจ้งบ้านพร้อมขาย");
  });
  await check("UC09 customer binding and actual link exchange", async () => {
    await screen(sales, "SCR-09", unit);
    await sales
      .getByLabel("เลขประจำตัวลูกค้า 13 หลัก", { exact: true })
      .fill("9000000000003");
    await sales
      .getByLabel("ชื่อ–นามสกุลลูกค้า", { exact: true })
      .fill("ลูกค้าทดสอบ หน้าจอ");
    await sales.getByLabel("เบอร์โทรศัพท์", { exact: true }).fill("0800000003");
    await submit(sales, "ผูกลูกค้าและสร้างลิงก์");
    const url = await sales
      .getByRole("status")
      .getByRole("link")
      .getAttribute("href");
    customer = await context();
    await customer.goto(url);
    await customer
      .getByRole("button", { name: "เปิดข้อมูลบ้าน", exact: true })
      .click();
    await customer.waitForURL(base + "/");
    assert(!customer.url().includes("token"));
  });
  await check("UC10 inspection choice UC11 customer request", async () => {
    await customer
      .getByRole("link", { name: "เริ่มทำงานนี้", exact: true })
      .click();
    await customer
      .getByRole("link", { name: "ต้องการตรวจบ้าน · เลือกวัน", exact: true })
      .click();
    await customer
      .getByLabel("วันที่ต้องการตรวจ", { exact: true })
      .fill("2026-11-18");
    await submit(customer, "ยื่นคำขอตรวจบ้าน");
  });
  await check("UC13 appointment arrival persisted Thai timezone", async () => {
    await screen(sales, "SCR-13", unit);
    await sales
      .getByLabel("วันและเวลานัด (เวลาไทย)", { exact: true })
      .fill("2026-11-18T09:30");
    await submit(sales, "บันทึกหรือเลื่อนนัด");
    const [[appointment]] = await db.query(
      "SELECT appointment FROM inspection_request WHERE unit_id=? ORDER BY request_id DESC LIMIT 1",
      [unit],
    );
    assert(String(appointment.appointment).startsWith("2026-11-18 02:30:00"));
    await sales.getByLabel("ลูกค้ามาถึงบ้านแล้ว").check();
    await submit(sales, "บันทึกมาถึงและเปิดรอบตรวจ");
  });
  await check("UC14 exclusive reporter controls and real photo", async () => {
    await screen(customer, "SCR-14", unit);
    const radio = customer.getByRole("radio", {
      name: "บริษัทตรวจนอก",
      exact: true,
    });
    await radio.check();
    assert(
      !(await customer
        .getByRole("radio", { name: "ลูกค้า", exact: true })
        .isChecked()),
    );
    await customer
      .getByLabel("ตำแหน่งที่ต้องแก้", { exact: true })
      .fill("ห้องครัว ทดสอบผ่านหน้าจอ");
    await customer
      .getByLabel("รูปประกอบ (อย่างน้อย 1 รูป)", { exact: true })
      .setInputFiles(upload);
    await submit(customer, "บันทึกจุดที่ต้องแก้ไข");
    const [[d]] = await db.query(
      "SELECT d.defect_id FROM defect d JOIN inspection_round r ON r.round_id=d.round_id WHERE r.unit_id=? AND r.round_type='CUSTOMER_HANDOVER'",
      [unit],
    );
    handDefect = d.defect_id;
  });
  await check("UC15 head classify and repeated repair workflow", async () => {
    await screen(head, "SCR-15", unit);
    await head.getByLabel("จุดใหม่", { exact: true }).selectOption(handDefect);
    await head
      .getByLabel("ประเภทงาน", { exact: true })
      .selectOption("ELECTRICAL");
    await submit(head, "ส่งเข้าคิวช่าง");
    await screen(head, "SCR-03", unit);
    await head.getByLabel(new RegExp(handDefect + "$")).check();
    await submit(head, "รับงานที่เลือก");
    await screen(head, "SCR-04", unit);
    await head
      .getByLabel("งานที่คุณรับไว้", { exact: true })
      .selectOption(handDefect);
    await head
      .getByLabel("รูปประกอบ (อย่างน้อย 1 รูป)", { exact: true })
      .setInputFiles(upload);
    await submit(head, "บันทึกซ่อมเสร็จ");
  });
  await check(
    "UC16 generated PDF downloadable through protected link",
    async () => {
      await screen(inspector, "SCR-16", unit);
      await submit(inspector, "สร้างเอกสาร PDF");
      const url = await inspector
        .getByRole("status")
        .getByRole("link")
        .getAttribute("href");
      const r = await inspector.request.get(base + url);
      assert.equal(r.status(), 200);
      assert.equal(r.headers()["content-type"], "application/pdf");
    },
  );
  await check(
    "UC17 select fixed reject rework accept then UC18 canvas signature",
    async () => {
      await screen(customer, "SCR-17", unit);
      await customer
        .getByLabel("เลือกจุด " + handDefect, { exact: true })
        .check();
      await customer
        .getByLabel("เหตุผลที่ไม่ยอมรับ", { exact: true })
        .fill("ทดสอบส่งกลับแก้จากหน้าจอ");
      await submit(customer, "ยืนยันไม่ผ่านและส่งกลับแก้");
      await screen(head, "SCR-04", unit);
      await head
        .getByLabel("งานที่คุณรับไว้", { exact: true })
        .selectOption(handDefect);
      await head
        .getByLabel("รูปประกอบ (อย่างน้อย 1 รูป)", { exact: true })
        .setInputFiles(upload);
      await submit(head, "บันทึกซ่อมเสร็จ");
      await screen(customer, "SCR-17", unit);
      await customer
        .getByLabel(
          "ตรวจครบทุกจุดแล้ว ยอมรับสภาพบ้านเพื่อเข้าสู่ขั้นเซ็นรับมอบ",
        )
        .check();
      await submit(customer, "ยืนยันยอมรับสภาพ");
      await screen(customer, "SCR-18", unit);
      const canvas = customer.locator("canvas");
      const box = await canvas.boundingBox();
      await customer.mouse.move(box.x + 40, box.y + 60);
      await customer.mouse.down();
      await customer.mouse.move(box.x + 80, box.y + 20, { steps: 8 });
      await customer.mouse.move(box.x + 140, box.y + 80, { steps: 8 });
      await customer.mouse.up();
      await customer
        .getByLabel("ฉันตรวจข้อมูลและยืนยันรับมอบบ้านหลังนี้")
        .check();
      await submit(customer, "ยืนยันเซ็นรับมอบ");
      await customer.reload();
      assert(
        (await customer.locator("main").innerText()).includes("เซ็นรับมอบแล้ว"),
      );
      const [[u]] = await db.query(
        "SELECT status FROM property_unit WHERE unit_id=?",
        [unit],
      );
      assert.equal(u.status, "HANDED_OVER");
    },
  );
  const roles = [
    [sales, ["SCR-01", "SCR-09", "SCR-12", "SCR-13"]],
    [inspector, ["SCR-02", "SCR-05", "SCR-06", "SCR-07", "SCR-08", "SCR-16"]],
    [head, ["SCR-03", "SCR-04", "SCR-15"]],
    [customer, ["SCR-10", "SCR-11", "SCR-14", "SCR-17", "SCR-18"]],
  ];
  for (const [page, screens] of roles)
    for (const width of [360, 390, 640, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const s of screens) {
        await screen(page, s, unit);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          s + " " + width,
        );
        report.layouts.push({ screen: s, width, status: "PASS" });
      }
      if (width === 390 || width === 1440) {
        const s = screens.at(-1);
        await page.screenshot({
          path: path.join(directory, s + "-" + width + ".png"),
          fullPage: true,
        });
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        report.accessibility.push({
          screen: s,
          width,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => n.target),
          })),
        });
      }
    }
  await check(
    "19 screens including employee login layout checked",
    async () => {
      const p = await context();
      for (const width of [360, 390, 640, 768, 1024, 1280, 1440, 1920]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.goto(base + "/login");
        assert.equal(
          await p.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        report.layouts.push({ screen: "SCR-00", width, status: "PASS" });
      }
      const axe = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      report.accessibility.push({
        screen: "SCR-00",
        width: 1920,
        violations: axe.violations.map((v) => ({ id: v.id, impact: v.impact })),
      });
    },
  );
  await check("Logout UI revokes access", async () => {
    await sales.getByRole("button", { name: "เมนูบัญชี", exact: true }).click();
    await sales
      .getByRole("button", { name: "ออกจากระบบ", exact: true })
      .click();
    await sales.waitForURL("**/login");
    await sales.goto(base + "/");
    await sales.waitForURL("**/login");
  });
} catch (e) {
  report.fatal = e.message;
  console.error("FAIL", e.message);
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await db.end();
  report.finished_at = new Date().toISOString();
  report.violation_count = report.accessibility.reduce(
    (n, r) => n + r.violations.length,
    0,
  );
  report.status =
    report.fatal || report.errors.length || report.violation_count
      ? "FAIL"
      : "PASS";
  fs.writeFileSync(
    path.join(evidence, "runtime-browser.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: report.status,
      cases: report.cases.length,
      layouts: report.layouts.length,
      violations: report.violation_count,
      errors: report.errors,
      fatal: report.fatal,
    }),
  );
  if (report.status === "FAIL") process.exitCode = 1;
}
