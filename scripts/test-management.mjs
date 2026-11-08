import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connect, local, evidence, testBase } from "./db-common.mjs";
const fixture = JSON.parse(
    fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
  ),
  base = fixture.base;
assert.equal(base, testBase);
const db = await connect("sa_web_test_p1"),
  browser = await chromium.launch({ channel: "msedge", headless: true }),
  contexts = [],
  secrets = [fixture.password];
const out = {
  started_at: new Date().toISOString(),
  build_id: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
  scope:
    "Real management HTTP/DB/browser and workflow tests; isolated synthetic fixture only",
  cases: [],
  accessibility: [],
  page_errors: [],
};
const screenshots = path.join(evidence, "management-screenshots");
fs.mkdirSync(screenshots, { recursive: true });
const png = await sharp({
  create: { width: 180, height: 100, channels: 3, background: "#fafafa" },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="180" height="100"><path d="M10 80 L50 20 L90 70 L160 30" fill="none" stroke="#222" stroke-width="3"/></svg>',
      ),
    },
  ])
  .png()
  .toBuffer();
const picture = () =>
  new File([png], "synthetic-management-test.png", { type: "image/png" });
const clean = (s) =>
  secrets.reduce(
    (text, secret) => (secret ? text.split(secret).join("<redacted>") : text),
    String(s),
  );
async function req(url, { cookie = "", data, files, origin = base } = {}) {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  let body;
  if (data) {
    headers.Origin = origin;
    if (files) {
      body = new FormData();
      body.set("data", JSON.stringify(data));
      for (const f of files) body.append("photos", f);
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }
  const r = await fetch(base + url, {
    method: data ? "POST" : "GET",
    headers,
    body,
  });
  const json = await r.json();
  const token = r.headers.get("set-cookie")?.split(";")[0];
  if (token) secrets.push(token);
  if (json.data?.temporary_password) secrets.push(json.data.temporary_password);
  return {
    status: r.status,
    data: json.data,
    error: json.error,
    cookie: token,
  };
}
async function post(cookie, cmd, data, expected = 200) {
  const r = await req("/api/manage/" + cmd, { cookie, data });
  assert.equal(r.status, expected, cmd + " " + (r.error?.message ?? ""));
  return r.data;
}
async function uc(cookie, n, data, files, expected = 200) {
  const r = await req("/api/actions/UC-" + String(n).padStart(2, "0"), {
    cookie,
    data,
    files,
  });
  assert.equal(r.status, expected, "UC " + n + " " + (r.error?.message ?? ""));
  return r.data;
}
async function login(id, password = fixture.password) {
  const r = await req("/api/auth/login", {
    data: { employee_id: id, password },
  });
  assert.equal(r.status, 200, r.error?.message);
  return r.cookie;
}
async function newContext() {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Asia/Bangkok",
  });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", (e) => out.page_errors.push(clean(e.message)));
  return p;
}
async function cookieOf(p) {
  const c = (await p.context().cookies()).find((c) => c.name === "sa_session");
  assert(c);
  const s = c.name + "=" + c.value;
  secrets.push(s, c.value);
  return s;
}
async function row(table, key) {
  const pk = {
    employee: "employee_id",
    property_unit: "unit_id",
    project: "project_id",
    customer: "customer_id",
    defect: "defect_id",
  }[table];
  return (
    await db.query("SELECT * FROM " + table + " WHERE " + pk + "=?", [key])
  )[0][0];
}
async function employeeUpdate(actor, key, change = {}, expected = 200) {
  const e = await row("employee", key);
  return post(
    actor,
    "employee.update",
    {
      employee_id: key,
      full_name: e.full_name,
      phone_number: e.phone_number ?? "",
      email: e.email ?? "",
      role: e.role,
      craft_category: e.craft_category ?? "",
      is_active: Boolean(e.is_active),
      updated_at: e.updated_at,
      reason: "ทดสอบการจัดการ (ข้อมูลสมมติ)",
      ...change,
    },
    expected,
  );
}
async function submit(p, label, endpoint) {
  const response = p.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() === "POST",
  );
  await p.getByRole("button", { name: label, exact: true }).click();
  const r = await response,
    json = await r.json();
  assert.equal(r.status(), 200, json.error?.message);
  if (json.data?.temporary_password) secrets.push(json.data.temporary_password);
  return json.data;
}
async function check(id, fn) {
  await fn();
  out.cases.push({ id, status: "PASS" });
  console.log("PASS", id);
}
const adminFile = path.join(local, "management-test-admin.json");
let saved = fs.existsSync(adminFile)
  ? JSON.parse(fs.readFileSync(adminFile, "utf8"))
  : { password: "Admin-test-" + crypto.randomBytes(14).toString("base64url") };
secrets.push(saved.password);
fs.writeFileSync(adminFile, JSON.stringify(saved));
let adminPage,
  adminCookie,
  staff,
  inspector,
  project,
  unit,
  tech1,
  tech2,
  tech1cookie,
  tech2cookie,
  tech1page,
  defect,
  customerId,
  customer2,
  link,
  customerCookie,
  requestId,
  admin2,
  admin2cookie;
const suffix = crypto.randomBytes(4).toString("hex"),
  projectName = "ส่วนจัดการ ทดสอบสมมติ " + suffix;
async function readyAccount(created) {
  const temporary = created.temporary_password,
    password = "New-test-" + crypto.randomBytes(14).toString("base64url");
  secrets.push(temporary, password);
  const old = await login(created.employee_id, temporary);
  assert.equal((await req("/api/workspace", { cookie: old })).status, 409);
  const r = await req("/api/account/password", {
    cookie: old,
    data: {
      current_password: temporary,
      new_password: password,
      confirm_password: password,
    },
  });
  assert.equal(r.status, 200, r.error?.message);
  assert(r.cookie);
  assert.equal((await req("/api/account", { cookie: old })).status, 401);
  return { ...created, password, cookie: r.cookie };
}
try {
  await check(
    "ADM-01 first admin setup or previously established owner login",
    async () => {
      adminPage = await newContext();
      const available = (await req("/api/setup/status")).data.available;
      if (available) {
        const code = JSON.parse(
          fs.readFileSync(path.join(local, "admin-setup-test.json"), "utf8"),
        ).code;
        secrets.push(code);
        await adminPage.goto(base + "/setup#code=" + code);
        await adminPage.waitForURL(base + "/setup");
        await adminPage
          .getByLabel("ชื่อที่แสดง", { exact: true })
          .fill("แอดมินทดสอบ (ข้อมูลสมมติ)");
        await adminPage
          .getByLabel("รหัสผ่าน (อย่างน้อย 12 ตัวอักษร)", { exact: true })
          .fill(saved.password);
        await adminPage
          .getByLabel("ยืนยันรหัสผ่าน", { exact: true })
          .fill(saved.password);
        await submit(adminPage, "สร้างบัญชีแอดมิน", "/api/setup");
        await adminPage.waitForURL("**/admin");
        out.bootstrap = "Created through browser form in this fixture";
      } else {
        await adminPage.goto(base + "/login");
        await adminPage
          .getByLabel("รหัสพนักงาน", { exact: true })
          .fill("ADMIN");
        await adminPage
          .getByLabel("รหัสผ่าน", { exact: true })
          .fill(saved.password);
        await adminPage
          .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
          .click();
        await adminPage.waitForURL("**/admin");
        out.bootstrap =
          "Existing fixture owner login; bootstrap already exercised in earlier run";
      }
      adminCookie = await cookieOf(adminPage);
      assert.equal((await req("/api/setup/status")).data.available, false);
      const r = await req("/api/setup", {
        data: {
          setup_code: "x".repeat(43),
          full_name: "x",
          password: saved.password,
          confirm_password: saved.password,
        },
      });
      assert.equal(r.status, 409);
    },
  );
  await check(
    "ADM-02 direct endpoint permissions and role spoof denied",
    async () => {
      staff = await login("EMP0001");
      inspector = await login("EMP0003");
      assert.equal((await req("/api/manage?section=units")).status, 401);
      assert.equal(
        (await req("/api/manage?section=units", { cookie: staff })).status,
        403,
      );
      await post(
        staff,
        "project.create",
        { project_name: "forbidden", role: "ADMIN" },
        403,
      );
      await uc(
        adminCookie,
        1,
        { project_name: "forbidden", house_no: "x" },
        undefined,
        403,
      );
      assert.equal(
        (
          await req("/api/manage/project.create", {
            cookie: adminCookie,
            data: { project_name: "x" },
            origin: "https://invalid.example",
          })
        ).status,
        403,
      );
    },
  );
  await check("ADM-03 create project through UI", async () => {
    await adminPage.goto(base + "/admin?section=projects");
    await adminPage
      .getByRole("button", { name: "เพิ่มโครงการ", exact: true })
      .click();
    await adminPage
      .getByRole("dialog")
      .getByLabel("ชื่อโครงการ", { exact: true })
      .fill(projectName);
    const r = await submit(
      adminPage,
      "เพิ่มรายการ",
      "/api/manage/project.create",
    );
    project = r.project_id;
    assert((await row("project", project)).is_active);
    await adminPage.getByRole("dialog").waitFor({ state: "hidden" });
  });
  await check(
    "ADM-04 create and edit house through UI with stale-write guard",
    async () => {
      await adminPage.goto(base + "/admin?section=units");
      await adminPage
        .getByRole("button", { name: "เพิ่มบ้าน", exact: true })
        .click();
      const dialog = adminPage.getByRole("dialog");
      await dialog.getByLabel("โครงการ", { exact: true }).selectOption(project);
      await dialog
        .getByLabel("เลขที่บ้าน", { exact: true })
        .fill("MG-" + suffix);
      const r = await submit(
        adminPage,
        "เพิ่มรายการ",
        "/api/manage/unit.create",
      );
      unit = r.unit_id;
      const original = await row("property_unit", unit);
      await adminPage.getByRole("dialog").waitFor({ state: "hidden" });
      const target = adminPage
        .locator("table tbody tr")
        .filter({ hasText: "MG-" + suffix });
      await target.getByRole("button", { name: "แก้ไข", exact: true }).click();
      await adminPage
        .getByRole("dialog")
        .getByLabel("แบบบ้าน (ไม่บังคับ)", { exact: true })
        .fill("ทดสอบแก้แบบบ้าน");
      await adminPage
        .getByRole("dialog")
        .getByLabel("เหตุผลการเปลี่ยนแปลง", { exact: true })
        .fill("ทดสอบแก้ไขสมมติ");
      await submit(adminPage, "บันทึกการแก้ไข", "/api/manage/unit.update");
      await post(
        adminCookie,
        "unit.update",
        {
          unit_id: unit,
          project_id: project,
          house_no: original.house_no,
          unit_type: "stale",
          updated_at: original.updated_at,
          reason: "stale test",
        },
        409,
      );
      assert.equal(
        (await row("property_unit", unit)).unit_type,
        "ทดสอบแก้แบบบ้าน",
      );
    },
  );
  await check(
    "ADM-05 create technician through UI and mandatory password change",
    async () => {
      await adminPage.goto(base + "/admin?section=employees");
      await adminPage
        .getByRole("button", { name: "เพิ่มพนักงาน", exact: true })
        .click();
      const d = adminPage.getByRole("dialog");
      await d
        .getByLabel("ชื่อที่แสดง", { exact: true })
        .fill("ช่างสมมติ คนหนึ่ง " + suffix);
      await d
        .getByLabel("สิทธิ์การใช้งาน", { exact: true })
        .selectOption("TECHNICIAN");
      await d
        .getByLabel("ประเภทงานช่าง", { exact: true })
        .selectOption("ELECTRICAL");
      await d.getByLabel("เบอร์โทรศัพท์", { exact: true }).fill("0800090011");
      tech1 = await submit(
        adminPage,
        "เพิ่มรายการ",
        "/api/manage/employee.create",
      );
      tech1.password =
        "Tech-test-" + crypto.randomBytes(14).toString("base64url");
      secrets.push(tech1.password, tech1.temporary_password);
      tech1page = await newContext();
      await tech1page.goto(base + "/login");
      await tech1page
        .getByLabel("รหัสพนักงาน", { exact: true })
        .fill(tech1.employee_id);
      await tech1page
        .getByLabel("รหัสผ่าน", { exact: true })
        .fill(tech1.temporary_password);
      await tech1page
        .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
        .click();
      await tech1page.waitForURL("**/account");
      const old = await cookieOf(tech1page);
      assert.equal((await req("/api/workspace", { cookie: old })).status, 409);
      await tech1page
        .getByLabel("รหัสผ่านชั่วคราว", { exact: true })
        .fill(tech1.temporary_password);
      await tech1page
        .getByLabel("รหัสผ่านใหม่", { exact: true })
        .fill(tech1.password);
      await tech1page
        .getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true })
        .fill(tech1.password);
      await submit(tech1page, "บันทึกรหัสผ่านใหม่", "/api/account/password");
      await tech1page.waitForURL("**/home");
      tech1cookie = await cookieOf(tech1page);
      assert.equal((await req("/api/account", { cookie: old })).status, 401);
    },
  );
  await check(
    "ACC-01 profile save persists, self role injection denied",
    async () => {
      await tech1page.goto(base + "/account");
      await tech1page
        .getByLabel("ชื่อที่แสดง", { exact: true })
        .fill("ช่างสมมติ แก้โปรไฟล์ " + suffix);
      await submit(tech1page, "บันทึกข้อมูลส่วนตัว", "/api/account/profile");
      assert.equal(
        (await row("employee", tech1.employee_id)).full_name,
        "ช่างสมมติ แก้โปรไฟล์ " + suffix,
      );
      const p = (await req("/api/account", { cookie: tech1cookie })).data
        .profile;
      const spoof = await req("/api/account/profile", {
        cookie: tech1cookie,
        data: {
          full_name: p.full_name,
          phone_number: p.phone_number,
          email: "",
          updated_at: p.updated_at,
          role: "ADMIN",
        },
      });
      assert.equal(spoof.status, 422);
    },
  );
  await check(
    "ACC-02 revoke another login and wrong current password denied",
    async () => {
      const other = await login(tech1.employee_id, tech1.password);
      const sessions = (await req("/api/account", { cookie: tech1cookie })).data
        .sessions;
      const target = sessions.find((s) => !s.current_session);
      assert(target);
      const r = await req("/api/account/revoke-session", {
        cookie: tech1cookie,
        data: { session_ref: target.session_ref },
      });
      assert.equal(r.status, 200);
      assert.equal((await req("/api/account", { cookie: other })).status, 401);
      const bad = await req("/api/account/password", {
        cookie: tech1cookie,
        data: {
          current_password: "incorrect",
          new_password: "A-long-new-password",
          confirm_password: "A-long-new-password",
        },
      });
      assert.equal(bad.status, 422);
    },
  );
  await check(
    "UX-01 choose home and follow QC task, no repeated house selection",
    async () => {
      const p = await newContext();
      await p.context().request.post(base + "/api/auth/login", {
        headers: { Origin: base },
        data: { employee_id: "EMP0003", password: fixture.password },
      });
      await p.goto(base + "/home");
      await p.getByLabel("ค้นหาบ้าน", { exact: true }).fill("MG-" + suffix);
      await p
        .locator("li")
        .filter({
          has: p.getByRole("heading", {
            name: "บ้านเลขที่ MG-" + suffix,
            exact: true,
          }),
        })
        .getByRole("link", { name: "เปิดบ้าน", exact: true })
        .click();
      await p.waitForURL(new RegExp("/home\\?unit=" + unit + "$"));
      assert(p.url().includes("unit=" + unit));
      await p.getByRole("link", { name: "เริ่มทำงานนี้", exact: true }).click();
      await p
        .getByLabel("ประเภทงาน", { exact: true })
        .selectOption("ELECTRICAL");
      await p
        .getByLabel("ตำแหน่งที่ต้องแก้", { exact: true })
        .fill("จุดทดสอบนำทาง " + suffix);
      let response = p.waitForResponse(
        (r) => r.url().endsWith("/UC-02") && r.request().method() === "POST",
      );
      await p
        .getByRole("button", { name: "บันทึกจุดที่ต้องแก้ไข", exact: true })
        .click();
      let r = await response,
        j = await r.json();
      assert.equal(r.status(), 200, j.error?.message);
      defect = j.data.defect_id;
      await p
        .getByLabel("ตรวจครบแล้ว เมื่อยืนยันจะเพิ่ม แก้ หรือลบรายการเดิมไม่ได้")
        .check();
      await submit(p, "เสร็จสิ้นการตรวจ", "/api/actions/UC-02");
      assert((await p.locator("main").innerText()).includes("รอช่าง"));
      assert.equal(await p.locator("#unit-picker").count(), 0);
      await p.screenshot({
        path: path.join(screenshots, "guided-qc-waiting-1440.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "UX-02 open one job, accept and continue directly to repair",
    async () => {
      await tech1page.goto(base + "/home");
      await tech1page.getByRole("button", { name: /งานที่รับได้/ }).click();
      await tech1page.getByLabel("ค้นหางาน", { exact: true }).fill(suffix);
      await tech1page
        .locator("li")
        .filter({ hasText: "จุดทดสอบนำทาง " + suffix })
        .getByRole("link", { name: "ดูงานและรับงาน", exact: true })
        .click();
      await tech1page.waitForURL(
        new RegExp(
          "/app\\?screen=SCR-03&unit=" + unit + "&defect=" + defect + "$",
        ),
      );
      assert(tech1page.url().includes("unit=" + unit));
      const pick = tech1page.locator('input[name="defect_ids"]');
      if (await pick.count()) assert(await pick.isChecked());
      await tech1page
        .getByRole("button", { name: "รับงานนี้", exact: true })
        .waitFor();
      await tech1page.setViewportSize({ width: 390, height: 950 });
      assert.equal(
        await tech1page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await tech1page.screenshot({
        path: path.join(screenshots, "guided-job-open-390.png"),
        fullPage: true,
      });
      await submit(tech1page, "รับงานนี้", "/api/actions/UC-03");
      await tech1page.getByRole("link", { name: /ซ่อมงานที่รับไว้/ }).click();
      assert.equal(
        await tech1page
          .getByLabel("งานที่คุณรับไว้", { exact: true })
          .inputValue(),
        defect,
      );
      assert.equal(await tech1page.locator("#unit-picker").count(), 0);
    },
  );
  await check(
    "UX-03 stale job link does not substitute a different job",
    async () => {
      const p = await newContext();
      await p
        .context()
        .request.post(base + "/api/auth/login", {
          headers: { Origin: base },
          data: { employee_id: "EMP0008", password: fixture.password },
        });
      await p.goto(base + "/app?screen=SCR-03&unit=H0001&defect=ZZZZZZ");
      await p.locator("main h1").waitFor();
      assert.equal(
        await p.getByRole("button", { name: /^รับงาน(นี้|ที่เลือก)$/ }).count(),
        0,
      );
      assert(
        (await p.locator("main").innerText()).includes("ไม่พบงานนี้ในคิว"),
      );
    },
  );
  await check(
    "ADM-06 block active-job account changes and wrong-craft transfer rollback",
    async () => {
      await employeeUpdate(
        adminCookie,
        tech1.employee_id,
        { is_active: false },
        409,
      );
      tech2 = await readyAccount(
        await post(adminCookie, "employee.create", {
          full_name: "ช่างสมมติ คนสอง " + suffix,
          phone_number: "0800090012",
          email: "",
          role: "TECHNICIAN",
          craft_category: "WALL",
        }),
      );
      tech2cookie = tech2.cookie;
      await post(
        adminCookie,
        "employee.transfer",
        {
          employee_id: tech1.employee_id,
          technician_id: tech2.employee_id,
          defect_ids: [defect],
          reason: "wrong craft",
        },
        409,
      );
      assert.equal(
        (await row("defect", defect)).technician_id,
        tech1.employee_id,
      );
      await employeeUpdate(adminCookie, tech2.employee_id, {
        craft_category: "ELECTRICAL",
      });
      tech2cookie = await login(tech2.employee_id, tech2.password);
      await post(adminCookie, "employee.transfer", {
        employee_id: tech1.employee_id,
        technician_id: tech2.employee_id,
        defect_ids: [defect],
        reason: "ทดสอบโอนงานก่อนปิดบัญชี",
      });
      const d = await row("defect", defect);
      assert.equal(d.technician_id, tech2.employee_id);
      assert.equal(d.status, "ASSIGNED");
      await employeeUpdate(adminCookie, tech1.employee_id, {
        is_active: false,
      });
      assert.equal(
        (await req("/api/account", { cookie: tech1cookie })).status,
        401,
      );
    },
  );
  await check(
    "ADM-07 archive guard, finish QC, archive and restore preserve history",
    async () => {
      let u = await row("property_unit", unit);
      await post(
        adminCookie,
        "unit.archive",
        {
          unit_id: unit,
          updated_at: u.updated_at,
          archived: true,
          reason: "active work",
        },
        409,
      );
      await uc(tech2cookie, 4, { defect_id: defect }, [picture()]);
      await uc(inspector, 5, { defect_id: defect, approve: true });
      const round = (await row("defect", defect)).round_id;
      await uc(inspector, 6, {
        round_id: round,
        mode: "schedule",
        recheck_date: "2026-11-20",
      });
      await uc(inspector, 6, {
        round_id: round,
        mode: "result",
        recheck_result: "NO_DEFECT",
      });
      await uc(inspector, 7, { round_id: round, is_single_certify: true });
      await uc(inspector, 8, { unit_id: unit });
      u = await row("property_unit", unit);
      await post(adminCookie, "unit.archive", {
        unit_id: unit,
        updated_at: u.updated_at,
        archived: true,
        reason: "ทดสอบเก็บเข้าคลัง",
      });
      assert(
        !(await req("/api/workspace", { cookie: staff })).data.units.some(
          (r) => r.unit_id === unit,
        ),
      );
      await uc(
        inspector,
        2,
        {
          unit_id: unit,
          mode: "add",
          category: "WALL",
          location_pin: "blocked",
        },
        undefined,
        409,
      );
      u = await row("property_unit", unit);
      await post(adminCookie, "unit.archive", {
        unit_id: unit,
        updated_at: u.updated_at,
        archived: false,
        reason: "ทดสอบนำกลับ",
      });
      assert.equal((await row("defect", defect)).status, "VERIFIED");
      await post(
        adminCookie,
        "unit.update",
        {
          unit_id: unit,
          project_id: project,
          house_no: "CHANGED",
          unit_type: "",
          updated_at: (await row("property_unit", unit)).updated_at,
          reason: "not allowed",
        },
        409,
      );
    },
  );
  await check(
    "ADM-08 project rename mirrors houses and closed project prevents new house",
    async () => {
      let p = await row("project", project);
      await post(adminCookie, "project.update", {
        project_id: project,
        project_name: projectName + " แก้ชื่อ",
        is_active: false,
        updated_at: p.updated_at,
        reason: "ทดสอบชื่อและสถานะ",
      });
      assert.equal(
        (await row("property_unit", unit)).project_name,
        projectName + " แก้ชื่อ",
      );
      await post(
        adminCookie,
        "unit.create",
        { project_id: project, house_no: "CLOSED" },
        409,
      );
      await uc(
        staff,
        1,
        { project_id: project, house_no: "CLOSED" },
        undefined,
        422,
      );
      p = await row("project", project);
      await post(adminCookie, "project.update", {
        project_id: project,
        project_name: p.project_name,
        is_active: true,
        updated_at: p.updated_at,
        reason: "เปิดใช้ต่อเพื่อทดสอบ",
      });
    },
  );
  await check(
    "ADM-09 create customer, bind house and issue scoped link",
    async () => {
      customerId = (
        await post(adminCookie, "customer.create", {
          full_name: "ลูกค้าสมมติ ส่วนจัดการ " + suffix,
          phone_number: "0800090021",
          email: "",
          id_card_no: "900" + String(parseInt(suffix, 16)).padStart(10, "0"),
        })
      ).customer_id;
      link = await post(adminCookie, "unit.customer", {
        unit_id: unit,
        customer_id: customerId,
        reason: "ทดสอบผูกลูกค้า",
      });
      let token = new URLSearchParams(new URL(link.url).hash.slice(1)).get(
        "token",
      );
      secrets.push(token);
      let r = await req("/api/auth/access", { data: { token } });
      assert.equal(r.status, 200);
      customerCookie = r.cookie;
      const p = (await req("/api/account", { cookie: customerCookie })).data
        .profile;
      r = await req("/api/account/profile", {
        cookie: customerCookie,
        data: {
          phone_number: "0800090022",
          email: "customer-test@example.com",
          updated_at: p.updated_at,
        },
      });
      assert.equal(r.status, 200);
      assert.equal(
        (await row("customer", customerId)).phone_number,
        "0800090022",
      );
      await post(
        customerCookie,
        "project.create",
        { project_name: "blocked" },
        403,
      );
      assert.equal(
        (await req("/api/workspace?unit=H0001", { cookie: customerCookie }))
          .status,
        404,
      );
    },
  );
  await check(
    "ADM-10 revoke link invalidates both existing session and token",
    async () => {
      const token = new URLSearchParams(new URL(link.url).hash.slice(1)).get(
        "token",
      );
      const [[l]] = await db.query(
        "SELECT link_id FROM access_link WHERE unit_id=? ORDER BY created_at DESC LIMIT 1",
        [unit],
      );
      await post(adminCookie, "link.revoke", {
        link_id: l.link_id,
        reason: "ทดสอบเพิกถอน",
      });
      assert.equal(
        (await req("/api/account", { cookie: customerCookie })).status,
        401,
      );
      assert.equal(
        (await req("/api/auth/access", { data: { token } })).status,
        401,
      );
      link = await post(adminCookie, "link.create", {
        unit_id: unit,
        reason: "ออกใหม่เพื่อทดสอบ",
      });
      const nextToken = new URLSearchParams(
        new URL(link.url).hash.slice(1),
      ).get("token");
      secrets.push(nextToken);
      customerCookie = (
        await req("/api/auth/access", { data: { token: nextToken } })
      ).cookie;
    },
  );
  await check(
    "ADM-11 customer rebind updates pending request and revokes former access",
    async () => {
      requestId = (
        await uc(customerCookie, 11, { preferred_date: "2026-11-22" })
      ).request_id;
      customer2 = (
        await post(adminCookie, "customer.create", {
          full_name: "ลูกค้าสมมติ ผู้ใหม่ " + suffix,
          phone_number: "0800090023",
          email: "",
          id_card_no:
            "900" + String(parseInt(suffix, 16) + 1).padStart(10, "0"),
        })
      ).customer_id;
      link = await post(adminCookie, "unit.customer", {
        unit_id: unit,
        customer_id: customer2,
        reason: "ทดสอบเปลี่ยนก่อนเริ่มตรวจ",
      });
      assert.equal(
        (await req("/api/account", { cookie: customerCookie })).status,
        401,
      );
      const [[request]] = await db.query(
        "SELECT customer_id FROM inspection_request WHERE request_id=?",
        [requestId],
      );
      assert.equal(request.customer_id, customer2);
      await uc(staff, 13, {
        request_id: requestId,
        mode: "appointment",
        appointment: "2026-11-22T02:00:00Z",
      });
      await uc(staff, 13, { request_id: requestId, mode: "arrival" });
      await post(
        adminCookie,
        "unit.customer",
        {
          unit_id: unit,
          customer_id: customerId,
          reason: "must reject after arrival",
        },
        409,
      );
    },
  );
  await check(
    "ADM-12 password reset invalidates sessions and requires a fresh password",
    async () => {
      const reset = await post(adminCookie, "employee.reset", {
        employee_id: tech2.employee_id,
        reason: "ทดสอบรีเซ็ต",
      });
      assert.equal(
        (await req("/api/workspace", { cookie: tech2cookie })).status,
        401,
      );
      tech2 = await readyAccount({ ...tech2, ...reset });
      tech2cookie = tech2.cookie;
      await post(
        adminCookie,
        "employee.reset",
        { employee_id: "ADMIN", reason: "self reset" },
        422,
      );
    },
  );
  await check(
    "ADM-13 concurrent last-admin protection and recovery through remaining admin",
    async () => {
      admin2 = await readyAccount(
        await post(adminCookie, "employee.create", {
          full_name: "แอดมินสมมติ อีกคน " + suffix,
          phone_number: "",
          email: "",
          role: "ADMIN",
        }),
      );
      admin2cookie = admin2.cookie;
      const a = await row("employee", "ADMIN"),
        b = await row("employee", admin2.employee_id);
      const body = (e) => ({
        employee_id: e.employee_id,
        full_name: e.full_name,
        phone_number: e.phone_number ?? "",
        email: e.email ?? "",
        role: "ADMIN",
        craft_category: "",
        is_active: false,
        updated_at: e.updated_at,
        reason: "ทดสอบปิดพร้อมกัน",
      });
      const rs = await Promise.all([
        req("/api/manage/employee.update", {
          cookie: adminCookie,
          data: body(a),
        }),
        req("/api/manage/employee.update", {
          cookie: admin2cookie,
          data: body(b),
        }),
      ]);
      assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
      const [[count]] = await db.query(
        "SELECT COUNT(*) n FROM employee WHERE role='ADMIN' AND is_active=1",
      );
      assert.equal(count.n, 1);
      if ((await row("employee", "ADMIN")).is_active) {
        await employeeUpdate(adminCookie, admin2.employee_id, {
          is_active: true,
        });
      } else {
        await employeeUpdate(admin2cookie, "ADMIN", { is_active: true });
        adminCookie = await login("ADMIN", saved.password);
      }
    },
  );
  await check(
    "ADM-14 overview counts match source and audit omits credentials",
    async () => {
      const overview = (
        await req("/api/manage?section=overview", { cookie: adminCookie })
      ).data;
      const [[count]] = await db.query(
        "SELECT COUNT(*) n FROM property_unit WHERE archived_at IS NULL",
      );
      assert.equal(
        overview.counts.reduce((n, r) => n + Number(r.n), 0),
        count.n,
      );
      const [events] = await db.query(
        "SELECT before_values,after_values FROM audit_event",
      );
      const text = JSON.stringify(events);
      assert(!/password_hash|setup_digest|"token"|"id_card_no"/.test(text));
      for (const secret of secrets.filter((s) => s && s.length > 12))
        assert(!text.includes(secret));
    },
  );
  await check(
    "ADM-15 pagination filter and direct session revocation",
    async () => {
      const r = await req("/api/manage?section=audit&page=2", {
        cookie: adminCookie,
      });
      assert.equal(r.status, 200);
      assert(r.data.total > 12);
      assert.equal(r.data.page, 2);
      const filtered = (
        await req(
          "/api/manage?section=employees&q=" + encodeURIComponent(suffix),
          { cookie: adminCookie },
        )
      ).data;
      assert(filtered.items.every((r) => String(r.full_name).includes(suffix)));
      const other = await login(tech2.employee_id, tech2.password);
      const [[s]] = await db.query(
        "SELECT session_id FROM app_session WHERE session_id=?",
        [crypto.createHash("sha256").update(other.split("=")[1]).digest("hex")],
      );
      await post(adminCookie, "session.revoke", {
        session_ref: s.session_id,
        reason: "ทดสอบ session กลาง",
      });
      assert.equal((await req("/api/account", { cookie: other })).status, 401);
    },
  );
  await check(
    "ADM-16 protected house files and sorting are usable",
    async () => {
      const detail = (
        await req("/api/manage/unit/" + unit, { cookie: adminCookie })
      ).data;
      assert(detail.files.length);
      const r = await fetch(base + detail.files[0].path, {
        headers: { Cookie: adminCookie },
      });
      assert.equal(r.status, 200);
      assert(r.headers.get("content-type").startsWith("image/"));
      const list = (
        await req("/api/manage?section=employees&sort=newest", {
          cookie: adminCookie,
        })
      ).data;
      const [[latest]] = await db.query(
        "SELECT employee_id FROM employee ORDER BY updated_at DESC,employee_id DESC LIMIT 1",
      );
      assert.equal(list.items[0].employee_id, latest.employee_id);
    },
  );
  const p = await newContext();
  await p.context().request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: { employee_id: "ADMIN", password: saved.password },
  });
  for (const width of [390, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    for (const section of [
      "overview",
      "projects",
      "units",
      "customers",
      "employees",
      "links",
      "sessions",
      "audit",
    ]) {
      await p.goto(base + "/admin?section=" + section);
      await p.locator("main h1").waitFor();
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        section + " " + width,
      );
      const axe = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      out.accessibility.push({
        section,
        width,
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
      if (["overview", "employees"].includes(section))
        await p.screenshot({
          path: path.join(screenshots, section + "-" + width + ".png"),
          fullPage: true,
        });
    }
    await p.goto(base + "/account");
    const axe = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    out.accessibility.push({
      section: "account",
      width,
      violations: axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    });
  }
} catch (e) {
  out.fatal = clean(e.message);
  console.error("FAIL", clean(e.message));
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await db.end();
  out.finished_at = new Date().toISOString();
  out.violations = out.accessibility.reduce(
    (n, s) => n + s.violations.length,
    0,
  );
  out.status =
    out.fatal || out.violations || out.page_errors.length ? "FAIL" : "PASS";
  fs.writeFileSync(
    path.join(evidence, "management-integration.json"),
    clean(JSON.stringify(out, null, 2)) + "\n",
  );
  console.log(
    JSON.stringify({
      status: out.status,
      cases: out.cases.length,
      scans: out.accessibility.length,
      violations: out.violations,
      fatal: out.fatal,
      page_errors: out.page_errors,
    }),
  );
  if (out.status === "FAIL") process.exitCode = 1;
}
