import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { local, evidence, connect } from "./db-common.mjs";
const base = "http://127.0.0.1:3000",
  credentials = JSON.parse(
    fs.readFileSync(path.join(local, "demo-credentials.json"), "utf8"),
  );
const db = await connect("sa_web_dev_p1"),
  browser = await chromium.launch({ channel: "msedge", headless: true }),
  contexts = [];
const out = {
  started_at: new Date().toISOString(),
  scope:
    "Final production build, local development DB; login/read/logout only, no business mutations",
  cases: [],
  build_id: fs.readFileSync(".next/BUILD_ID", "utf8").trim(),
};
const tables = [
  "employee",
  "customer",
  "property_unit",
  "inspection_request",
  "inspection_round",
  "defect",
  "file",
  "repair_report",
  "access_link",
  "project",
  "audit_event",
  "app_control",
];
async function snapshot() {
  const r = {};
  for (const t of tables)
    r[t] = (await db.query("SELECT * FROM `" + t + "` ORDER BY 1"))[0];
  return JSON.stringify(r);
}
async function contrast(page, selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((e) => {
      const s = getComputedStyle(e),
        c = document.createElement("canvas").getContext("2d");
      function luminance(color) {
        c.clearRect(0, 0, 1, 1);
        c.fillStyle = color;
        c.fillRect(0, 0, 1, 1);
        const p = c.getImageData(0, 0, 1, 1).data;
        return [...p]
          .slice(0, 3)
          .map((x) => x / 255)
          .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
          .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
      }
      const a = luminance(s.color),
        b = luminance(s.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
}
const before = await snapshot();
try {
  for (const employeeId of ["EMP0001", "EMP0003", "EMP0005", "EMP0008"]) {
    const account = credentials.employees.find(
      (e) => e.employee_id === employeeId,
    );
    const c = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    contexts.push(c);
    const r = await c.request.post(base + "/api/auth/login", {
      headers: { Origin: base },
      data: { employee_id: employeeId, password: account.password },
    });
    assert.equal(r.status(), 200);
    const p = await c.newPage();
    await p.goto(base + "/app");
    await p.locator("main h1").waitFor();
    const ratio = await contrast(p, 'nav a[aria-current="page"]:visible');
    assert(ratio >= 4.5, "Selected menu contrast " + ratio);
    out.cases.push({
      name: account.role + " production login and selected-menu contrast",
      status: "PASS",
      contrast: Number(ratio.toFixed(2)),
    });
    if (employeeId === "EMP0008")
      await p.screenshot({
        path: path.join(
          evidence,
          "runtime-screenshots",
          "delivery-technician-1440.png",
        ),
        fullPage: true,
      });
    await c.request.post(base + "/api/auth/logout", {
      headers: { Origin: base },
    });
    assert.equal((await c.request.get(base + "/api/workspace")).status(), 401);
  }
  const links = JSON.parse(
    fs.readFileSync(path.join(local, "customer-demo-links.json"), "utf8"),
  ).links;
  const [valid] = await db.query(
    "SELECT l.link_id FROM access_link l JOIN property_unit u ON u.unit_id=l.unit_id WHERE l.expires_at>NOW() AND l.customer_id=u.customer_id ORDER BY l.link_id",
  );
  const raw = links.find((l) => valid.some((v) => v.link_id === l.link_id));
  assert(raw);
  const c = await browser.newContext({ viewport: { width: 390, height: 900 } });
  contexts.push(c);
  const p = await c.newPage();
  await p.goto(raw.url.replace("/access?token=", "/access#token="));
  await p.waitForURL("**/access");
  await p.getByRole("button", { name: "เปิดข้อมูลบ้าน", exact: true }).click();
  await p.waitForURL("**/app");
  await p.locator("main h1").waitFor();
  assert(!p.url().includes("token"));
  out.cases.push({
    name: "Existing local synthetic customer link and clean URL",
    status: "PASS",
  });
  await p.screenshot({
    path: path.join(
      evidence,
      "runtime-screenshots",
      "delivery-customer-390.png",
    ),
    fullPage: true,
  });
  const anon = await browser.newContext();
  contexts.push(anon);
  const login = await anon.newPage();
  await login.goto(base + "/login");
  const ratio = await contrast(login, ".btn-primary");
  assert(ratio >= 4.5);
  out.cases.push({
    name: "Primary button foreground contrast",
    status: "PASS",
    contrast: Number(ratio.toFixed(2)),
  });
  assert(
    (await snapshot()) === before,
    "Business rows changed during readonly smoke",
  );
  out.cases.push({
    name: "All core and management records unchanged by readonly smoke",
    status: "PASS",
  });
} catch (e) {
  out.fatal = e.message;
  console.error("FAIL", e.message);
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await db.end();
  out.finished_at = new Date().toISOString();
  out.status = out.fatal ? "FAIL" : "PASS";
  fs.writeFileSync(
    path.join(evidence, "runtime-delivery-smoke.json"),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      { status: out.status, cases: out.cases, fatal: out.fatal },
      null,
      2,
    ),
  );
  if (out.fatal) process.exitCode = 1;
}
