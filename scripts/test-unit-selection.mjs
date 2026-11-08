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
  scope: "Phase 1A F12 + Q7 (deep link via /home?next) + Q8 (customer); synthetic test DB only",
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
  await page.waitForURL(/\/(home|app)(\?|$)/, { timeout: 30000 });
}

// True when a house is selected for the newest house: its name shows and the
// house picker is not on screen. The picker lists every house, so a name alone
// does not mean a house was selected.
async function showsNewestHouse() {
  const text = await page.locator("main#main-content").innerText();
  const picker = await page.getByRole("link", { name: "เปิดบ้าน", exact: true }).count();
  return text.includes("บ้านเลขที่ " + newest.house_no) && picker === 0;
}

function assertDeferredToHome(url, expectedNext = "/app?screen=SCR-09") {
  assert.equal(url.pathname, "/home", "must land on the house picker");
  assert.equal(url.searchParams.get("unit"), null, "URL must not gain a unit");
  assert.equal(url.searchParams.get("next"), expectedNext, "target screen must be kept");
}

await loginForm(sales.employee_id);

await check("T-01", "Deep link to a house screen without unit goes to the picker and keeps the target", async () => {
  // Changed with Decision 1 (SCR-09 landing): a bare /app?screen=SCR-09 now goes to /tasks/SCR-09
  // (covered by test-task-landing). A link that carries a defect keeps the picker, which this case needs.
  await page.goto(base + "/app?screen=SCR-09&defect=12");
  await page.waitForLoadState("load");
  const url = new URL(page.url());
  assertDeferredToHome(url, "/app?screen=SCR-09&defect=12");
  assert.equal(await showsNewestHouse(), false, "house " + newest.house_no + " was selected silently");
  return { final_path: url.pathname + url.search };
});

await check("T-02", "Sidebar link from /home (no house chosen) does not select a house", async () => {
  await page.goto(base + "/home");
  await page.waitForLoadState("load");
  // The sidebar is rendered twice on desktop (F1); the first match is enough here.
  await page
    .getByRole("link", { name: "ส่งลิงก์เข้าสู่ระบบให้ลูกค้า", exact: true })
    .first()
    .click();
  // client-side navigation: wait for the URL, not for a page load event.
  // Changed with Decision 1 (SCR-09 landing): the menu item opens /tasks/SCR-09, which lists
  // houses and chooses none. The invariant is the same: no house in the URL, none selected.
  await page.waitForURL(/\/tasks\/SCR-09/, { timeout: 30000 });
  const url = new URL(page.url());
  assert.equal(url.pathname, "/tasks/SCR-09");
  assert.equal(url.searchParams.get("unit"), null, "URL must not gain a unit");
  const heading = await page.locator("main#main-content h1").first().innerText();
  assert(!heading.includes("บ้านเลขที่"), "a house heading was shown: " + heading);
  return { final_path: url.pathname + url.search };
});

await check("T-04", "Refresh from a unit-less house-free screen does not introduce a house", async () => {
  // Precondition changed in Phase 1A: house-scoped screens now redirect (T-01),
  // so the unit-less workbench is only reachable on SCR-01 (house-free).
  await page.goto(base + "/app?screen=SCR-01");
  await page.waitForLoadState("load");
  const before = await showsNewestHouse();
  assert.equal(before, false, "house shown before any refresh");
  await page.getByRole("button", { name: "โหลดข้อมูลล่าสุด", exact: true }).click();
  await page.waitForLoadState("load");
  const after = await showsNewestHouse();
  assert.equal(after, false, "refresh introduced house " + newest.house_no);
  assert(!new URL(page.url()).searchParams.get("unit"), "URL gained a unit");
  return { before, after };
});

await check("T-05", "Choosing a house on the picker returns to the requested screen for that house (Q7)", async () => {
  await page.goto(base + "/home?next=" + encodeURIComponent("/app?screen=SCR-09"));
  await page.waitForLoadState("load");
  await page.locator('a[href^="/app?screen=SCR-09&unit="]').first().click();
  await page.waitForURL(/\/app\?.*unit=/, { timeout: 30000 });
  await page.waitForLoadState("load");
  const url = new URL(page.url());
  assert.equal(url.pathname, "/app");
  assert.equal(url.searchParams.get("screen"), "SCR-09");
  assert.equal(url.searchParams.get("unit"), String(newest.unit_id), "chosen house must be the one clicked");
  assert.equal(await showsNewestHouse(), true, "chosen house header not shown");
  return { final_path: url.pathname + url.search };
});

await check("T-08", "House-free screen SCR-01 opens without a house (no redirect)", async () => {
  await page.goto(base + "/app?screen=SCR-01");
  await page.waitForLoadState("load");
  const url = new URL(page.url());
  assert.equal(url.pathname, "/app");
  assert.equal(url.searchParams.get("screen"), "SCR-01");
  const text = await page.locator("main#main-content").innerText();
  assert(text.includes("ข้อมูลบ้านใหม่"), "registration form not shown");
  return { final_path: url.pathname + url.search };
});

await check("T-09", "Invalid next values are ignored; no external or unit-carrying target is used", async () => {
  const invalid = [
    "https://evil.example/app?screen=SCR-09",
    "//evil.example/app?screen=SCR-09",
    "/app/../admin?screen=SCR-09",
    "/app?screen=SCR-09&unit=" + encodeURIComponent(String(newest.unit_id)),
  ];
  const results = [];
  for (const value of invalid) {
    await page.goto(base + "/home?next=" + encodeURIComponent(value));
    await page.waitForLoadState("load");
    const banner = await page.getByText("เลือกบ้านก่อน แล้วจึงจะส่งลิงก์ได้", { exact: false }).count();
    const hrefs = await page.getByRole("link", { name: "เปิดบ้าน", exact: true }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
    assert.equal(banner, 0, "banner shown for invalid next: " + value);
    for (const h of hrefs) assert(h.startsWith("/home?unit="), "house link changed for invalid next: " + h);
    results.push(value);
  }
  return { rejected: results.length };
});

await check("T-10", "Valid next shows the picker banner and carries the target into house links", async () => {
  await page.goto(base + "/home?next=" + encodeURIComponent("/app?screen=SCR-09&defect=12"));
  await page.waitForLoadState("load");
  const banner = await page.getByText("เลือกบ้านก่อน แล้วจึงจะส่งลิงก์ได้", { exact: false }).count();
  assert(banner >= 1, "banner missing");
  const href = await page.getByRole("link", { name: "เปิดบ้าน", exact: true }).first().getAttribute("href");
  assert(href.startsWith("/app?screen=SCR-09&unit="), "house link does not keep the target: " + href);
  assert(href.endsWith("&defect=12"), "defect not kept: " + href);
  return { sample_link_shape: "/app?screen=…&unit=…&defect=…" };
});

await browser.close();

const failed = out.cases.filter((c) => c.status === "FAIL").length;
out.status = failed === 0 ? "PASS" : "FAIL";
out.finished_at = new Date().toISOString();
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(path.join(evidence, "unit-selection.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ status: out.status, cases: out.cases.map((c) => [c.id, c.status]) }));
process.exitCode = failed === 0 ? 0 : 1;
