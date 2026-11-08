import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { chromium } from "@playwright/test";
import { envFile, root, state } from "./demo-profile.mjs";

if (!process.env.SA_DEMO_PROFILE)
  throw new Error(
    "Use a fresh named demo profile. This test changes demo records.",
  );

const { APP_URL: base } = parseEnv(readFileSync(envFile, "utf8"));
const browserPath = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ executablePath: browserPath });
const suffix = String(Date.now()).slice(-9);
const project = "ร่มไม้ทาวน์ บางเขน";
const before = path.join(root, "db/demo-media/restoration-before.webp");
const after = path.join(root, "db/demo-media/restoration-after.webp");
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(Date.now() + 86400000);
const covered = new Set();
const pageErrors = [];

async function page() {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.setDefaultTimeout(15000);
  p.on("pageerror", (error) => pageErrors.push(error.message));
  return p;
}
const button = (scope, name) =>
  scope.getByRole("button", { name, exact: true });
const link = (scope, name) => scope.getByRole("link", { name, exact: true });
const field = (scope, name) => scope.getByLabel(name, { exact: true });
const panel = (p, name) =>
  p.locator("section").filter({
    has: p.getByRole("heading", { name, exact: true }),
  });
async function open(p, route) {
  const result = await p.goto(base + route);
  assert.equal(result.status(), 200, route);
  await p.getByRole("heading", { level: 1 }).waitFor();
}

async function login(role) {
  const p = await page();
  await open(p, "/login");
  const group = p.getByRole("group", { name: /โหมดสาธิต/ });
  await button(group, role).click();
  await p.waitForURL(base + "/");
  return p;
}

async function customer(url) {
  assert.match(url, /\/access#token=/);
  const p = await page();
  await p.goto(url);
  await p.waitForURL(base + "/access");
  await button(p, "เปิดข้อมูลบ้าน").click();
  await p.waitForURL(base + "/");
  return p;
}

function seedLink(unit) {
  const links = readFileSync(path.join(state, "CUSTOMER-LINKS.md"), "utf8");
  const row = links
    .split("\n")
    .find((line) => line.startsWith("- " + unit + " "));
  assert.ok(row, "Missing link for " + unit);
  return row.split(" — ")[1].trim();
}

async function submit(p, uc, title, scope = p) {
  const review = button(scope, "ทบทวนก่อนส่ง");
  if (!(await button(scope, title).count()) && (await review.count()))
    await review.click();
  const action = button(scope, title);
  const invalid = await action.evaluate((element) =>
    [...element.form.elements]
      .filter((field) => field.validity && !field.validity.valid)
      .map((field) => field.name),
  );
  assert.deepEqual(invalid, [], uc + " has invalid form fields");
  const response = p.waitForResponse(
    (r) =>
      r.url() === base + "/api/actions/" + uc &&
      r.request().method() === "POST",
    { timeout: 15000 },
  );
  const refreshed = p.waitForResponse(
    (r) =>
      r.url().startsWith(base + "/api/workspace") &&
      r.request().method() === "GET",
    { timeout: 15000 },
  );
  const [result, latest] = await Promise.all([
    response,
    refreshed,
    action.click(),
  ]);
  const body = await result.json();
  assert.equal(result.status(), 200, uc + " " + JSON.stringify(body.error));
  if (uc === "UC-01") await p.waitForURL(base + "/houses/" + body.data.unit_id);
  else {
    await p
      .locator('[role="status"].alert-success')
      .filter({ hasText: body.data.message })
      .waitFor();
  }
  assert.equal(latest.status(), 200);
  covered.add(uc);
  return body.data;
}

async function bind(sales, unit, idPrefix) {
  await open(sales, "/customer-access/" + unit);
  await field(sales, "เลขประจำตัวลูกค้า 13 หลัก").fill(idPrefix + suffix);
  await field(sales, "ชื่อ–นามสกุลลูกค้า").fill("ลูกค้าตัวอย่าง วันสาธิต");
  await field(sales, "เบอร์โทรศัพท์").fill("0800000024");
  await submit(sales, "UC-09", "ผูกลูกค้าและสร้างลิงก์");
  return sales
    .locator('[role="status"].alert-success')
    .getByRole("link")
    .getAttribute("href");
}

async function claim(tech, unit, defect) {
  await open(tech, "/repairs/" + unit);
  await tech.getByLabel(new RegExp(defect + "$")).check();
  const title = (await button(tech, "รับงานนี้").count())
    ? "รับงานนี้"
    : "รับงานที่เลือก";
  await submit(tech, "UC-03", title);
}

async function repair(tech, unit, defect) {
  await open(tech, "/assigned-repairs/" + unit);
  await field(tech, "งานที่คุณรับไว้").selectOption(defect);
  await field(tech, "รูปประกอบ (อย่างน้อย 1 รูป)").setInputFiles(after);
  await submit(tech, "UC-04", "บันทึกซ่อมเสร็จ");
}

async function approve(inspector, unit, defect) {
  await open(inspector, "/repair-reviews/" + unit);
  await field(inspector, "งานซ่อมที่ตรวจผ่าน").selectOption(defect);
  await submit(inspector, "UC-05", "อนุมัติงานซ่อม");
}

async function scheduleRecheck(inspector, unit) {
  await open(inspector, "/qc-rechecks/" + unit);
  await field(inspector, "วันที่ตรวจซ้ำ").fill(date);
  await submit(inspector, "UC-06", "นัดตรวจซ้ำ");
  await field(inspector, "ตรวจหน้างานแล้ว ไม่พบจุดที่ต้องแก้ไข").check();
  await submit(inspector, "UC-06", "บันทึกไม่พบจุดที่ต้องแก้");
}

async function saleReady(inspector, unit) {
  await open(inspector, "/sales-readiness/" + unit);
  await field(inspector, "ตรวจข้อมูลบ้านและการปิดรอบ QC แล้ว").check();
  await submit(inspector, "UC-08", "แจ้งบ้านพร้อมขาย");
}

async function appointment(sales, unit) {
  await open(sales, "/inspection-appointments/" + unit);
  await field(sales, "วันและเวลานัด (เวลาไทย)").fill(date + "T09:30");
  await submit(
    sales,
    "UC-13",
    "บันทึกหรือเลื่อนนัด",
    panel(sales, "นัดและเปิดรอบตรวจ"),
  );
  await field(sales, "ลูกค้ามาถึงบ้านแล้ว").check();
  await submit(sales, "UC-13", "บันทึกมาถึงและเปิดรอบตรวจ");
}

async function accept(p, unit) {
  await open(p, "/repair-status/" + unit);
  await field(
    p,
    "ตรวจครบทุกจุดแล้ว ยอมรับสภาพบ้านเพื่อเข้าสู่ขั้นเซ็นรับมอบ",
  ).check();
  await submit(p, "UC-17", "ยืนยันยอมรับสภาพ");
}

async function sign(p, unit) {
  await open(p, "/handover-signatures/" + unit);
  const canvas = p.locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  assert.ok(box);
  await p.mouse.move(box.x + 20, box.y + 35);
  await p.mouse.down();
  await p.mouse.move(box.x + 70, box.y + 17, { steps: 7 });
  await p.mouse.move(box.x + 110, box.y + 42, { steps: 7 });
  await p.mouse.up();
  await field(p, "ฉันตรวจข้อมูลและยืนยันรับมอบบ้านหลังนี้").check();
  await submit(p, "UC-18", "ยืนยันเซ็นรับมอบ");
  await p.reload();
  await p.getByText("ส่งมอบแล้ว", { exact: true }).first().waitFor();
  await p.getByText(/เซ็นรับมอบแล้ว เมื่อ/).waitFor();
  const signature = p.getByRole("link", { name: /เปิดลายเซ็นรับมอบ/ });
  const result = await p.request.get(
    base + (await signature.getAttribute("href")),
  );
  assert.equal(result.status(), 200);
  assert.equal(result.headers()["content-type"], "image/webp");
}

try {
  const [sales, inspector, tech, head] = await Promise.all(
    ["ฝ่ายขาย", "ผู้ตรวจ", "ช่างซ่อม", "หัวหน้าช่าง"].map(login),
  );
  await open(sales, "/houses");
  await link(sales, "ลงทะเบียนบ้านใหม่").click();
  await sales.locator("form fieldset:not([disabled])").waitFor();
  await field(sales, "โครงการ").selectOption({ label: project });
  const house = "DEMO-" + suffix;
  await field(sales, "เลขที่บ้าน").fill(house);
  await field(sales, "แบบบ้าน (ไม่บังคับ)").fill("ทาวน์โฮม 2 ชั้น");
  const { unit_id: unit } = await submit(sales, "UC-01", "ลงทะเบียนบ้าน");

  await open(inspector, "/qc-inspections/" + unit);
  await field(inspector, "ประเภทงาน").selectOption("WALL");
  await field(inspector, "ตำแหน่งที่ต้องแก้").fill("ผิวไม้หน้าบ้านฝั่งประตู");
  await field(inspector, "รูปประกอบ (ไม่บังคับ)").setInputFiles(before);
  const { defect_id: qcDefect } = await submit(
    inspector,
    "UC-02",
    "บันทึกจุดที่ต้องแก้ไข",
  );
  await field(
    inspector,
    "ตรวจครบแล้ว เมื่อยืนยันจะเพิ่ม แก้ หรือลบรายการเดิมไม่ได้",
  ).check();
  await submit(inspector, "UC-02", "เสร็จสิ้นการตรวจ");
  await claim(tech, unit, qcDefect);
  await repair(tech, unit, qcDefect);
  await approve(inspector, unit, qcDefect);
  await scheduleRecheck(inspector, unit);
  await open(inspector, "/qc-closures/" + unit);
  await field(inspector, "ยืนยันรับรองผลการตรวจคนเดียว").check();
  await submit(inspector, "UC-07", "ปิดรอบแบบรับรองคนเดียว");
  await saleReady(inspector, unit);
  console.log("PASS main QC to sale", unit);

  const buyer = await customer(await bind(sales, unit, "9001"));
  await open(buyer, "/inspection-preferences/" + unit);
  await link(buyer, "ต้องการตรวจบ้าน · เลือกวัน").click();
  await field(buyer, "วันที่ต้องการตรวจ").fill(date);
  await submit(buyer, "UC-11", "ยื่นคำขอตรวจบ้าน");
  await appointment(sales, unit);
  await open(buyer, "/handover-defects/" + unit);
  await field(buyer, "ตำแหน่งที่ต้องแก้").fill("ผิวไม้หน้าบ้านฝั่งหน้าต่าง");
  await field(buyer, "รูปประกอบ (อย่างน้อย 1 รูป)").setInputFiles(before);
  const { defect_id: handDefect } = await submit(
    buyer,
    "UC-14",
    "บันทึกจุดที่ต้องแก้ไข",
    panel(buyer, "แจ้งจุดใหม่"),
  );
  await open(head, "/repair-triage/" + unit);
  await field(head, "จุดใหม่").selectOption(handDefect);
  await field(head, "ประเภทงาน").selectOption("WALL");
  await submit(head, "UC-15", "ส่งเข้าคิวช่าง");
  await claim(tech, unit, handDefect);
  await repair(tech, unit, handDefect);
  await open(inspector, "/repair-reports/" + unit);
  const reportTitle = "สรุปซ่อมก่อนรับมอบ " + house;
  await field(inspector, "ชื่อเอกสาร").fill(reportTitle);
  const pdf = await submit(inspector, "UC-16", "สร้างเอกสาร PDF");
  await open(buyer, "/repair-status/" + unit);
  await buyer.getByText(reportTitle, { exact: true }).waitFor();
  const pdfLink = buyer.locator('a[href="' + pdf.path + '"]').first();
  await pdfLink.waitFor();
  const pdfFile = await buyer.request.get(
    base + (await pdfLink.getAttribute("href")),
  );
  assert.equal(pdfFile.status(), 200);
  const pdfBytes = await pdfFile.body();
  assert.equal(pdfBytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(
    (pdfBytes.toString("latin1").match(/\/Subtype \/Image/g) ?? []).length >= 2,
  );
  await accept(buyer, unit);
  await sign(buyer, unit);
  console.log("PASS main registration to signed handover", unit);

  await open(sales, "/assisted-inspection-requests/H0004");
  await field(sales, "วันที่ต้องการตรวจ").fill(date);
  await submit(
    sales,
    "UC-12",
    "ยื่นคำขอตรวจบ้าน",
    panel(sales, "ยื่นคำขอแทนลูกค้า"),
  );
  await appointment(sales, "H0004");
  const assisted = await customer(seedLink("H0004"));
  await accept(assisted, "H0004");
  await sign(assisted, "H0004");
  console.log("PASS assisted request to handover H0004");

  const skip = await customer(await bind(sales, "H0003", "9002"));
  await open(skip, "/inspection-preferences/H0003");
  await field(
    skip,
    "ฉันไม่ต้องการตรวจก่อนรับมอบ และต้องการไปขั้นเซ็นรับมอบ",
  ).check();
  await submit(skip, "UC-10", "ยืนยันไม่ต้องการตรวจบ้าน");
  await sign(skip, "H0003");
  console.log("PASS skipped inspection to handover H0003");

  await open(inspector, "/qc-rechecks/H0002");
  await field(inspector, "ประเภทงาน").selectOption("WALL");
  await field(inspector, "ตำแหน่งที่พบจุดใหม่").fill("ผิวไม้หน้าเฉลียง");
  await field(inspector, "รูปประกอบ (ไม่บังคับ)").setInputFiles(before);
  const { defect_id: repeat } = await submit(
    inspector,
    "UC-06",
    "บันทึกจุดใหม่และเปิดรอบซ่อมต่อ",
  );
  await claim(tech, "H0002", repeat);
  await repair(tech, "H0002", repeat);
  await approve(inspector, "H0002", repeat);
  await scheduleRecheck(inspector, "H0002");
  await open(inspector, "/qc-closures/H0002");
  await field(inspector, "ผู้ตรวจร่วม").selectOption("EMP0003");
  await field(inspector, "ยืนยันผลตรวจร่วมก่อนปิดรอบ").check();
  await submit(inspector, "UC-07", "ปิดรอบด้วยผู้ตรวจร่วม");
  await saleReady(inspector, "H0002");
  console.log("PASS recheck discovery through sale readiness H0002");

  const reject = await customer(seedLink("H0011"));
  await open(reject, "/repair-status/H0011");
  await field(reject, "เลือกจุด DEF202600018").check();
  await field(reject, "เหตุผลที่ไม่ยอมรับ").fill("ขอเก็บผิวไม้หน้าบ้านเพิ่ม");
  await submit(reject, "UC-17", "ยืนยันไม่ผ่านและส่งกลับแก้");
  await repair(tech, "H0011", "DEF202600018");
  await accept(reject, "H0011");
  await sign(reject, "H0011");
  console.log("PASS rejected repair through signed handover H0011");

  assert.deepEqual(
    [...covered].sort(),
    Array.from(
      { length: 18 },
      (_, index) => "UC-" + String(index + 1).padStart(2, "0"),
    ),
  );
  assert.deepEqual(pageErrors, []);
  console.log(
    "PASS all 18 use cases through browser forms and zero page errors",
  );
} finally {
  await browser.close();
}
