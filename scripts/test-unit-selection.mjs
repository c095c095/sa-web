import { housePath } from "../src/lib/routes.ts";
// Phase 1A regression tests for F12 (silent unit selection) and Q7/Q8.
// Scenario IDs follow docs/UX-PHASE-PLAN.md §3.4 and §12.
// Harness only; no app logic. Synthetic test DB only; never prints credentials.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { connect, local, evidence, testBase } from "./db-common.mjs";

const fixture = JSON.parse(
  fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
);
const base = fixture.base;
assert.equal(base, testBase);

const db = await connect("sa_web_test_p1");
const [[sales]] = await db.query(
  "SELECT employee_id FROM employee WHERE role='SALES' ORDER BY employee_id LIMIT 1",
);
const [[tech]] = await db.query(
  "SELECT employee_id FROM employee WHERE role='TECHNICIAN' ORDER BY employee_id LIMIT 1",
);
// Same ordering the server uses (workspace.ts). Used to name the newest house.
const [[newest]] = await db.query(
  "SELECT unit_id, house_no FROM property_unit WHERE archived_at IS NULL ORDER BY created_at DESC, unit_id DESC LIMIT 1",
);
const [[countUnits]] = await db.query(
  "SELECT COUNT(*) n FROM property_unit WHERE archived_at IS NULL",
);
await db.end();

const out = {
  started_at: new Date().toISOString(),
  base,
  scope: "House selection, direct routes and scope; synthetic test DB only",
  preconditions: { non_archived_units: Number(countUnits.n), newest_house: newest.house_no },
  cases: [],
};

function record(id, name, status, detail = {}) {
  out.cases.push({ id, name, status, ...detail });
}

async function apiLogin(employeeId) {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ employee_id: employeeId, password: fixture.password }),
  });
  assert.equal(r.status, 200, "login must succeed for the fixture account");
  return (r.headers.get("set-cookie") || "").split(";")[0];
}

async function check(id, name, fn) {
  try {
    const detail = await fn();
    record(id, name, "PASS", detail ?? {});
  } catch (e) {
    record(id, name, "FAIL", { message: String(e.message).slice(0, 400) });
  }
}

// ---- HTTP level ----------------------------------------------------------
const salesCookie = await apiLogin(sales.employee_id);
const techCookie = await apiLogin(tech.employee_id);

await check("T-03", "GET /api/workspace without unit returns unit null (employee)", async () => {
  const r = await fetch(base + "/api/workspace", { headers: { cookie: salesCookie } });
  assert.equal(r.status, 200);
  const body = (await r.json()).data;
  assert.equal(body.unit, null, "server must not silently pick a unit");
  return { returned_unit: body.unit ? body.unit.unit_id : null };
});

await check("T-06", "Unassigned technician cannot request another unit (regression)", async () => {
  const r0 = await fetch(base + "/api/workspace", { headers: { cookie: techCookie } });
  const visible = new Set(((await r0.json()).data.units || []).map((u) => String(u.unit_id)));
  const other = ((await (await fetch(base + "/api/workspace", { headers: { cookie: salesCookie } })).json()).data.units || [])
    .find((u) => !visible.has(String(u.unit_id)));
  if (!other) return { skipped: "technician can see every unit in fixture" };
  const r = await fetch(base + "/api/workspace?unit=" + encodeURIComponent(other.unit_id), {
    headers: { cookie: techCookie },
  });
  // Observed invariant: an existing but unassigned unit yields 200 with unit null
  // and no unit-scoped rows. Assert the invariant (no leak), not a status code.
  const body = (await r.json()).data;
  assert.equal(body.unit, null, "unassigned unit must not be returned");
  for (const key of ["rounds", "defects", "files", "requests", "reports"])
    assert.equal(body[key].length, 0, key + " leaked for an unassigned unit");
  return { http_status: r.status, unit: null };
});

await check("T-07", "Customer with one permitted house still lands on that house without a parameter (Q8)", async () => {
  const c = await connect("sa_web_test_p1");
  let picked = null;
  try {
    for (const link of fixture.links) {
      const [[row]] = await c.query("SELECT unit_id FROM access_link WHERE link_id=?", [link.link_id]);
      if (!row) continue;
      const r = await fetch(base + "/api/auth/access", {
        method: "POST",
        headers: { "content-type": "application/json", origin: base },
        body: JSON.stringify({ token: link.token }),
      });
      if (r.status !== 200) continue;
      const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
      const ws = (await (await fetch(base + "/api/workspace", { headers: { cookie } })).json()).data;
      picked = { expected: String(row.unit_id), got: ws.unit ? String(ws.unit.unit_id) : null };
      break;
    }
  } finally {
    await c.end();
  }
  assert(picked, "no usable customer link in fixture");
  assert.equal(picked.got, picked.expected, "customer must land on own house");
  return { customer_unit_matches_link: true };
});

// ---- Browser level -------------------------------------------------------
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

async function loginForm(employeeId) {
  await page.goto(base + "/login");
  await page.getByLabel("รหัสพนักงาน", { exact: true }).fill(employeeId);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await page.waitForURL(base + "/", { timeout: 30000 });
}

// True when a house is selected for the newest house: its name shows and the
// house picker is not on screen. The picker lists every house, so a name alone
// does not mean a house was selected.
async function showsNewestHouse() {
  const text = await page.locator("main#main-content").innerText();
  const picker = await page.getByRole("table", { name: "ทะเบียนบ้าน" }).count();
  return text.includes("บ้านเลขที่ " + newest.house_no) && picker === 0;
}

await loginForm(sales.employee_id);

await check("T-01", "The root and customer-access list do not silently select a house", async () => {
  for (const route of ["/", "/customer-access"]) {
    const response = await page.goto(base + route);
    assert.equal(response.status(), 200);
    assert.equal(await showsNewestHouse(), false);
    assert.equal(new URL(page.url()).pathname, route);
  }
});

await check("T-02", "The sidebar opens the customer-access list", async () => {
  await page.goto(base + "/");
  const menu = page.getByRole("navigation", { name: "เมนูหลัก" });
  await menu.locator('a[href="/customer-access"]').click();
  await page.waitForURL(base + "/customer-access");
  assert.equal(await page.locator('main form[method="post"]').count(), 0);
});

await check("T-04", "Choosing a house makes the URL and reloaded record agree", async () => {
  await page.goto(base + "/");
  const link = page.getByRole("table", { name: "ทะเบียนบ้าน" }).locator('a[href="' + housePath(String(newest.unit_id)) + '"]');
  await link.click();
  await page.waitForURL(base + housePath(String(newest.unit_id)));
  await page.reload();
  assert.equal(await showsNewestHouse(), true);
});

await check("T-08", "Register form opens without a house", async () => {
  await page.goto(base + "/houses/new");
  assert.equal(new URL(page.url()).pathname, "/houses/new");
  assert.equal(await page.locator("#unit-picker").count(), 0);
  assert.equal(await page.locator("input[name=house_no]").count(), 1);
});

await check("T-09", "Unknown and retired browser routes return 404", async () => {
  for (const path of ["/home", "/tasks/SCR-09", "/app?screen=SCR-09", "/houses/nonexistent-unit"]) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 404, path);
  }
});

await browser.close();

const failed = out.cases.filter((c) => c.status === "FAIL").length;
out.status = failed === 0 ? "PASS" : "FAIL";
out.finished_at = new Date().toISOString();
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(path.join(evidence, "unit-selection.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ status: out.status, cases: out.cases.map((c) => [c.id, c.status]) }));
process.exitCode = failed === 0 ? 0 : 1;
