// Phase 2A tests: each menu item opens its own landing page at /tasks/SCR-XX
// (docs/FINAL-VERIFICATION-REPORT.md, user decision Q10 = B). Eligible houses come
// from src/lib/journey.ts only; this file re-derives them with its own queries.
// Harness only. Synthetic test DB only; never prints credentials.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connect, local, evidence, testBase } from "./db-common.mjs";
import { screens, screenRoles } from "../src/lib/runtime-contracts.ts";
import os from "node:os";
import { pathToFileURL } from "node:url";

// journey.ts has an extensionless type-only import that plain Node cannot resolve.
// Load the real source with just that one type import removed.
const journeySource = fs.readFileSync(new URL("../src/lib/journey.ts", import.meta.url), "utf8");
const typeImport = 'import { type Workspace } from "./runtime-contracts";';
assert(journeySource.includes(typeImport), "journey.ts import line changed; update this loader");
const journeyFile = path.join(os.tmpdir(), "journey-under-test-" + process.pid + ".ts");
fs.writeFileSync(journeyFile, journeySource.replace(typeImport, ""));
const { journey, taskUrl } = await import(pathToFileURL(journeyFile).href);
fs.rmSync(journeyFile, { force: true });

const fixture = JSON.parse(fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"));
const base = fixture.base;
assert.equal(base, testBase);
const NAV = 'nav[aria-label="เมนูหลัก"]';
const EMPTY = "ตอนนี้ไม่มีบ้านที่ต้องทำขั้นตอนนี้";

// Screens that get a landing page. SCR-01 is a landing with one CTA (Decision 2).
// SCR-09 (Decision 1, option A): shows every house the screen and server accept for issuing a link
// (READY_TO_SELL, or a bound customer and not HANDED_OVER); journey.ts marks READY_TO_SELL and CONTRACTED as primary.
const HOUSE_LANDING = {
  SALES: ["SCR-09", "SCR-12", "SCR-13"],
  INSPECTOR: ["SCR-02", "SCR-05", "SCR-06", "SCR-07", "SCR-08", "SCR-16"],
};
const JOB_LANDING = {
  TECHNICIAN: { "SCR-03": "งานที่รับได้", "SCR-04": "งานที่รับไว้" },
  HEAD_TECHNICIAN: { "SCR-03": "งานที่รับได้", "SCR-04": "งานที่รับไว้", "SCR-15": "รอแยกประเภท" },
};
const REGISTER = { SALES: ["SCR-01"] };
const LINK_SCREEN = "SCR-09";
const REISSUE = "สร้างลิงก์ใหม่ให้ลูกค้าเดิม";
const ROLES = ["SALES", "INSPECTOR", "TECHNICIAN", "HEAD_TECHNICIAN"];

const db = await connect("sa_web_test_p1");
const employees = {};
for (const role of ROLES) {
  const [[row]] = await db.query("SELECT employee_id FROM employee WHERE role=? AND is_active=1 ORDER BY employee_id LIMIT 1", [role]);
  employees[role] = row?.employee_id;
}
const [allUnits] = await db.query("SELECT u.*, c.full_name customer_name FROM property_unit u LEFT JOIN customer c ON c.customer_id=u.customer_id WHERE u.archived_at IS NULL ORDER BY u.created_at DESC, u.unit_id DESC");
const [allRounds] = await db.query("SELECT * FROM inspection_round ORDER BY started_at DESC, round_id DESC");
const [allDefects] = await db.query("SELECT d.*, r.unit_id FROM defect d JOIN inspection_round r ON r.round_id=d.round_id ORDER BY d.created_at, d.defect_id");
const [allRequests] = await db.query("SELECT * FROM inspection_request ORDER BY created_at DESC");
await db.end();

// Expected rows for a house landing, derived from journey.ts and the test's own queries.
function expectedRows(role, screen) {
  const out = [];
  for (const unit of allUnits) {
    const rounds = allRounds.filter((r) => String(r.unit_id) === String(unit.unit_id));
    const roundIds = new Set(rounds.map((r) => String(r.round_id)));
    const w = {
      identity: { kind: "EMPLOYEE", role },
      units: [], unit, rounds,
      defects: allDefects.filter((d) => roundIds.has(String(d.round_id))),
      files: [], reports: [], queue: [], myJobs: [], newDefects: [], inspectors: [], projects: [],
      requests: allRequests.filter((r) => String(r.unit_id) === String(unit.unit_id)),
    };
    const task = journey(w).actions.find((a) => a.screen === screen);
    if (role === "SALES" && screen === LINK_SCREEN) {
      // Visibility is the screen rule; the primary flag is journey.ts.
      const visible = unit.status === "READY_TO_SELL" || (unit.customer_id && unit.status !== "HANDED_OVER");
      if (visible) out.push({ unit: String(unit.unit_id), house: String(unit.house_no), status: unit.status, href: `/app?screen=${screen}&unit=${encodeURIComponent(String(unit.unit_id))}`, primary: Boolean(task), title: task?.title });
      continue;
    }
    if (task) out.push({ unit: String(unit.unit_id), house: String(unit.house_no), status: unit.status, href: taskUrl(task, String(unit.unit_id)), primary: true, title: task.title });
  }
  return out;
}

const out = { started_at: new Date().toISOString(), base, scope: "Phase 2A landing pages /tasks/SCR-XX; synthetic test DB only", cases: [] };
const record = (id, name, status, detail = {}) => out.cases.push({ id, name, status, ...detail });
async function check(id, name, fn) {
  try { record(id, name, "PASS", (await fn()) ?? {}); }
  catch (e) { record(id, name, "FAIL", { message: String(e.message).slice(0, 700) }); }
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
async function login(role, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + "/login");
  await page.getByLabel("รหัสพนักงาน", { exact: true }).fill(employees[role]);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await page.waitForURL(/\/(home|app)(\?|$)/, { timeout: 30000 });
  return { context, page };
}
const sessions = {};
for (const role of ROLES) if (employees[role]) sessions[role] = await login(role);

async function landingState(page) {
  return page.evaluate((EMPTY_TEXT) => {
    const main = document.querySelector("main#main-content");
    const hrefs = [...main.querySelectorAll('a[href^="/app?screen="]')].map((a) => a.getAttribute("href"));
    return {
      h1: main.querySelector("h1")?.textContent.trim() ?? null,
      hrefs,
      empty: main.innerText.includes(EMPTY_TEXT),
      mutating: [...main.querySelectorAll("form")].filter((form) => form.method !== "get").length,
    };
  }, EMPTY);
}
// Client-side navigation: wait until the URL really changes before reading it.
async function clickAndWait(page, locator) {
  const before = page.url();
  await locator.click();
  await page.waitForFunction((b) => location.href !== b, before, { timeout: 20000 });
  await page.waitForLoadState("networkidle");
}
async function clickMenu(page, label) {
  await page.goto(base + "/home");
  await page.waitForLoadState("networkidle");
  await clickAndWait(page, page.locator(NAV + ":visible").first().getByRole("link", { name: label, exact: true }));
  return new URL(page.url());
}

// ---- T-LAND-01: menu click opens the landing page, not the action page --------
await check("T-LAND-01", "Menu opens /tasks/SCR-XX without mutation controls or a selected house", async () => {
  const seen = [];
  for (const [role, list] of Object.entries(HOUSE_LANDING)) {
    for (const screen of list) {
      const url = await clickMenu(sessions[role].page, screens[screen]);
      assert.equal(url.pathname, "/tasks/" + screen, `${role} ${screen}: landed on ${url.pathname}${url.search}`);
      assert.equal(url.searchParams.get("unit"), null, `${screen}: URL has a house`);
      const st = await landingState(sessions[role].page);
      assert.equal(st.h1, screens[screen], `${screen}: heading`);
      assert.equal(st.mutating, 0, `${screen}: landing has ${st.mutating} form/input controls`);
      seen.push(`${role}:${screen}`);
    }
  }
  return { checked: seen };
});

// ---- T-LAND-02/03: rows match journey.ts, and a row opens the action page ------
await check("T-LAND-02", "Landing rows equal the houses journey.ts offers for this screen (links carry unit, defect)", async () => {
  const detail = [];
  for (const [role, list] of Object.entries(HOUSE_LANDING)) {
    for (const screen of list) {
      await sessions[role].page.goto(base + "/tasks/" + screen);
      await sessions[role].page.waitForLoadState("networkidle");
      const st = await landingState(sessions[role].page);
      const want = expectedRows(role, screen).map((r) => r.href).sort();
      assert.deepEqual([...st.hrefs].sort(), want, `${role} ${screen}: rows differ`);
      assert.equal(st.empty, want.length === 0, `${role} ${screen}: empty-state mismatch`);
      detail.push({ role, screen, rows: want.length });
    }
  }
  return { checked: detail };
});

await check("T-LAND-03", "Hard status checks: SCR-12 lists exactly CONTRACTED houses, SCR-13 exactly WAITING_INSPECTION houses", async () => {
  const cases = [["SCR-12", "CONTRACTED"], ["SCR-13", "WAITING_INSPECTION"]];
  const detail = [];
  for (const [screen, status] of cases) {
    await sessions.SALES.page.goto(base + "/tasks/" + screen);
    await sessions.SALES.page.waitForLoadState("networkidle");
    const st = await landingState(sessions.SALES.page);
    const want = allUnits.filter((u) => u.status === status).map((u) => `/app?screen=${screen}&unit=${encodeURIComponent(String(u.unit_id))}`).sort();
    assert.deepEqual([...st.hrefs].sort(), want, `${screen}: not exactly the ${status} houses`);
    detail.push({ screen, status, rows: want.length });
  }
  // SCR-09: exactly the houses the screen rule shows; primary rows are exactly READY_TO_SELL and CONTRACTED
  await sessions.SALES.page.goto(base + "/tasks/SCR-09");
  await sessions.SALES.page.waitForLoadState("networkidle");
  const groups = await sessions.SALES.page.evaluate(() => Object.fromEntries(["primary", "secondary"].map((g) => [g, [...document.querySelectorAll(`main [data-group="${g}"] a[href^="/app?screen="]`)].map((a) => a.getAttribute("href"))])));
  const href9 = (u) => `/app?screen=SCR-09&unit=${encodeURIComponent(String(u.unit_id))}`;
  const shown = allUnits.filter((u) => u.status === "READY_TO_SELL" || (u.customer_id && u.status !== "HANDED_OVER"));
  const prim = shown.filter((u) => ["READY_TO_SELL", "CONTRACTED"].includes(u.status)).map(href9).sort();
  const sec = shown.filter((u) => !["READY_TO_SELL", "CONTRACTED"].includes(u.status)).map(href9).sort();
  assert.deepEqual([...groups.primary].sort(), prim, "SCR-09 primary rows");
  assert.deepEqual([...groups.secondary].sort(), sec, "SCR-09 secondary rows");
  detail.push({ screen: "SCR-09", primary: prim.length, secondary: sec.length });
  return { checked: detail };
});

await check("T-LAND-04", "Choosing a row opens the action page for that house only", async () => {
  const detail = [];
  for (const [role, list] of Object.entries(HOUSE_LANDING)) {
    for (const screen of list) {
      const rows = expectedRows(role, screen);
      if (!rows.length) continue;
      const p = sessions[role].page;
      await p.goto(base + "/tasks/" + screen);
      await p.waitForLoadState("networkidle");
      await clickAndWait(p, p.locator(`main a[href="${rows[0].href}"]`).first());
      const u = new URL(p.url());
      assert.equal(u.pathname, "/app", `${screen}: opened ${u.pathname}`);
      assert.equal(u.searchParams.get("screen"), screen);
      assert.equal(u.searchParams.get("unit"), rows[0].unit, `${screen}: wrong house`);
      detail.push({ role, screen });
    }
  }
  assert(detail.length > 0, "fixture has no landing rows to open");
  return { opened: detail };
});

await check("T-LAND-FILTER", "The task list keeps its search when returning from a house", async () => {
  const p = sessions.SALES.page;
  const row = expectedRows("SALES", "SCR-09")[0];
  assert(row, "fixture has no house for the link workflow");
  const query = encodeURIComponent(row.house);
  await p.goto(base + "/tasks/SCR-09?q=" + query);
  const target = p.locator(`main tbody a[href="${row.href}&q=${query}"]`);
  await clickAndWait(p, target);
  assert.equal(new URL(p.url()).searchParams.get("unit"), row.unit);
  await clickAndWait(p, p.getByRole("link", { name: "กลับไปรายการงาน" }));
  assert.equal(new URL(p.url()).searchParams.get("q"), row.house);
  assert.equal(await target.count(), 1);
  await p.goto(base + "/tasks/SCR-09?q=__no_match__");
  assert.equal(await p.locator("main tbody tr").count(), 0);
});

await check("T-LAND-05", "Empty landing states why and gives a way back (at least one empty screen in the fixture)", async () => {
  for (const [role, list] of Object.entries(HOUSE_LANDING)) {
    for (const screen of list) {
      if (expectedRows(role, screen).length) continue;
      const p = sessions[role].page;
      await p.goto(base + "/tasks/" + screen);
      await p.waitForLoadState("networkidle");
      const st = await landingState(p);
      assert(st.empty, `${screen}: no empty-state text`);
      assert.equal(await p.locator('main a[href="/home"]').count() > 0, true, `${screen}: no way back to งานของฉัน`);
      return { screen, role };
    }
  }
  return { skipped: "every landing screen has rows in this fixture" };
});

// ---- T-LAND-06: technician landing = HomeHub tabs (Q13) -------------------------
await check("T-LAND-06", "SCR-03/04/15 open the HomeHub job tabs with the matching tab selected", async () => {
  const detail = [];
  for (const [role, map] of Object.entries(JOB_LANDING)) {
    for (const [screen, tab] of Object.entries(map)) {
      const url = await clickMenu(sessions[role].page, screens[screen]);
      assert.equal(url.pathname, "/tasks/" + screen, `${role} ${screen}: landed on ${url.pathname}`);
      const pressed = await sessions[role].page.locator('main button[aria-pressed="true"]').allTextContents();
      assert.equal(pressed.length, 1, `${screen}: ${pressed.length} tabs pressed`);
      assert(pressed[0].startsWith(tab), `${screen}: tab "${pressed[0]}" selected, want "${tab}"`);
      detail.push({ role, screen, tab });
    }
  }
  return { checked: detail };
});

// ---- T-LAND-07: authorization and deep links ---------------------------------------
async function finalUrl(page, p) {
  await page.goto(base + p);
  await page.waitForLoadState("load");
  return new URL(page.url());
}
await check("T-LAND-07", "Deep links: no access without permission; INSPECTOR cannot open SCR-09", async () => {
  const detail = [];
  const denied = [
    ["SALES", "/tasks/SCR-02"], ["INSPECTOR", "/tasks/SCR-12"], ["TECHNICIAN", "/tasks/SCR-15"],
    ["SALES", "/tasks/FOO"], ["SALES", "/tasks/SCR-99"], ["INSPECTOR", "/tasks/SCR-09"],
  ];
  for (const [role, p] of denied) {
    const u = await finalUrl(sessions[role].page, p);
    assert.equal(u.pathname, "/home", `${role} ${p}: ended at ${u.pathname}${u.search}`);
    const st = await sessions[role].page.locator("main#main-content").innerText();
    assert(!st.includes(EMPTY), `${role} ${p}: showed landing content`);
    detail.push(`${role} ${p} -> /home`);
  }
  const own9 = await finalUrl(sessions.SALES.page, "/tasks/SCR-09");
  assert.equal(own9.pathname, "/tasks/SCR-09", "SALES must reach the SCR-09 landing");
  assert.equal(own9.searchParams.get("unit"), null, "SCR-09 landing: house chosen");
  // anonymous
  const r = await fetch(base + "/tasks/SCR-12", { redirect: "manual" });
  assert([302, 303, 307, 308].includes(r.status), "anonymous status " + r.status);
  assert((r.headers.get("location") || "").includes("/login"), "anonymous not sent to /login");
  // direct open in a fresh browser context after login (deep link)
  const fresh = await login("SALES");
  const u = await finalUrl(fresh.page, "/tasks/SCR-12");
  assert.equal(u.pathname, "/tasks/SCR-12", "direct open failed");
  await fresh.context.close();
  return { checked: detail.length + 4 };
});

await check("T-LAND-08", "Customer sees a landing for their own house before opening a task", async () => {
  let cookie = null;
  for (const link of fixture.links) {
    const r = await fetch(base + "/api/auth/access", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ token: link.token }) });
    if (r.status === 200) { cookie = (r.headers.get("set-cookie") || "").split(";")[0]; break; }
  }
  assert(cookie, "no usable customer link");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const [n, ...v] = cookie.split("=");
  await context.addCookies([{ name: n, value: v.join("="), url: base }]);
  const page = await context.newPage();
  const u = await finalUrl(page, "/tasks/SCR-12");
  assert.equal(u.pathname, "/home", "customer reached " + u.pathname);
  await page.goto(base + "/home");
  await page.waitForLoadState("networkidle");
  const hrefs = await page.locator(NAV + ":visible").first().locator("a").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  assert.deepEqual(hrefs.slice(1), screenRoles.CUSTOMER.map((screen) => "/tasks/" + screen));
  await page.goto(base + "/tasks/SCR-17");
  const actions = page.locator('main tbody a[href^="/app?screen=SCR-17&unit="]');
  assert.equal(await actions.count(), 1, "customer must see only their own house");
  await clickAndWait(page, actions.first());
  assert.equal(new URL(page.url()).searchParams.get("screen"), "SCR-17");
  assert.equal(await page.getByRole("heading", { name: "ภาพรวมการซ่อมรอบตรวจก่อนรับมอบ" }).count(), 1);
  await context.close();
  return { customer_links: hrefs.length - 1 };
});

await check("T-LAND-09", "Menu: every employee menu item with a landing (incl. SCR-01, SCR-09) goes to /tasks", async () => {
  const detail = [];
  for (const [role, s] of Object.entries(sessions)) {
    await s.page.goto(base + "/home");
    await s.page.waitForLoadState("networkidle");
    const links = await s.page.locator(NAV + ":visible").first().locator("a").evaluateAll((els) => els.map((e) => [e.textContent.trim(), e.getAttribute("href")]));
    for (const key of screenRoles[role]) {
      const href = links.find(([label]) => label === screens[key])[1];
      const landing = HOUSE_LANDING[role]?.includes(key) || REGISTER[role]?.includes(key) || key in (JOB_LANDING[role] || {});
      if (landing) assert.equal(href, "/tasks/" + key, `${role} ${key}: ${href}`);
      else assert(href.startsWith("/app?screen=" + key), `${role} ${key} (held): ${href}`);
      detail.push(`${role}:${key}:${landing ? "tasks" : "app"}`);
    }
  }
  assert(detail.some((d) => d === "SALES:SCR-09:tasks"), "SCR-09 menu link not checked");
  return { checked: detail.length };
});

// ---- Decisions 2 and 4: SCR-01 landing and legacy redirect ---------------------------
const SALES_SCREEN_HOUSE = ["SCR-09", "SCR-12", "SCR-13"];
async function apiCookie(role) {
  const r = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ employee_id: employees[role], password: fixture.password }) });
  assert.equal(r.status, 200, "login " + role);
  return (r.headers.get("set-cookie") || "").split(";")[0];
}
// Follow redirects by hand so loops and extra hops are visible.
async function chain(cookie, p) {
  const hops = [];
  let url = base + p;
  for (let i = 0; i < 8; i++) {
    const r = await fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      const next = new URL(r.headers.get("location"), url).toString();
      hops.push(new URL(next).pathname + new URL(next).search);
      url = next;
      continue;
    }
    return { hops, status: r.status, final: new URL(url).pathname + new URL(url).search };
  }
  return { hops, status: -1, final: "LOOP" };
}

await check("T-LAND-11", "SCR-01 shows the register and a separate CTA for the creation form", async () => {
  const p = sessions.SALES.page;
  const url = await clickMenu(p, screens["SCR-01"]);
  assert.equal(url.pathname, "/tasks/SCR-01", "menu landed on " + url.pathname);
  assert.equal(url.searchParams.get("unit"), null);
  const info = await p.evaluate(() => {
    const main = document.querySelector("main#main-content");
    const cta = [...main.querySelectorAll("a")].filter((a) => a.textContent.trim() === "ลงทะเบียนบ้านใหม่");
    return {
      h1: main.querySelector("h1")?.textContent.trim(),
      cta: cta.map((a) => a.getAttribute("href")),
      appLinks: [...main.querySelectorAll('a[href^="/app?screen="]')].length,
      houses: main.querySelectorAll("tbody tr").length,
      mutating: main.querySelectorAll('form, textarea, select, input, button[type="submit"]').length,
    };
  });
  assert.equal(info.h1, screens["SCR-01"]);
  assert.deepEqual(info.cta, ["/app?screen=SCR-01"], "primary CTA");
  assert.equal(info.appLinks, 1, "only the CTA may link into /app");
  assert.equal(info.houses, allUnits.length, "house register must be visible before creation");
  assert.equal(info.mutating, 0, "landing must not hold a form");
  await clickAndWait(p, p.getByRole("link", { name: "ลงทะเบียนบ้านใหม่", exact: true }));
  const u = new URL(p.url());
  assert.equal(u.pathname, "/app");
  assert.equal(u.searchParams.get("screen"), "SCR-01");
  assert.equal(u.searchParams.get("unit"), null, "CTA must not carry a house");
  assert(await p.getByRole("button", { name: "ลงทะเบียนบ้าน", exact: true }).count() > 0, "registration form not shown");
  // role guard
  for (const role of ["INSPECTOR", "TECHNICIAN", "HEAD_TECHNICIAN"]) {
    const c = await chain(await apiCookie(role), "/tasks/SCR-01");
    assert.equal(c.final, "/home", `${role} /tasks/SCR-01 ended at ${c.final}`);
  }
  const anon = await chain(null, "/tasks/SCR-01");
  assert.equal(anon.final, "/login", "anonymous");
  return { cta: "/app?screen=SCR-01" };
});

await check("T-LAND-12", "Legacy deep link /app?screen=X without unit goes to /tasks/X for landing screens, in at most one hop, no loop", async () => {
  const detail = [];
  const lists = { SALES: SALES_SCREEN_HOUSE, ...Object.fromEntries(Object.entries(HOUSE_LANDING).filter(([r]) => r !== "SALES")) };
  for (const [role, list] of [...Object.entries(lists), ["TECHNICIAN", Object.keys(JOB_LANDING.TECHNICIAN)], ["HEAD_TECHNICIAN", Object.keys(JOB_LANDING.HEAD_TECHNICIAN)]]) {
    const cookie = await apiCookie(role);
    for (const screen of list) {
      const c = await chain(cookie, "/app?screen=" + screen);
      assert.equal(c.final, "/tasks/" + screen, `${role} ${screen}: ended at ${c.final} via ${JSON.stringify(c.hops)}`);
      assert.equal(c.status, 200, `${role} ${screen}: status ${c.status}`);
      assert(c.hops.length <= 1, `${role} ${screen}: ${c.hops.length} hops`);
      detail.push(`${role}:${screen}`);
    }
  }
  // empty unit parameter counts as no unit
  const empty = await chain(await apiCookie("SALES"), "/app?screen=SCR-12&unit=");
  assert.equal(empty.final, "/tasks/SCR-12", "empty unit: " + empty.final);
  return { checked: detail.length };
});

await check("T-LAND-13", "Legacy redirect keeps the rules: unit, allowlist, defect, held screens, SCR-01, customer", async () => {
  const sales = await apiCookie("SALES");
  const insp = await apiCookie("INSPECTOR");
  const unit = allUnits.find((u) => u.status === "CONTRACTED");
  assert(unit, "fixture needs a CONTRACTED house");
  // with a unit the old rules apply: the action page opens, no redirect
  let c = await chain(sales, `/app?screen=SCR-12&unit=${encodeURIComponent(String(unit.unit_id))}`);
  assert.deepEqual(c.hops, [], "with unit: should not redirect");
  assert(c.final.startsWith("/app?screen=SCR-12&unit="), "with unit: " + c.final);
  // SCR-09 now has a landing: legacy link goes there, never with a house; with a defect it keeps the picker
  c = await chain(sales, "/app?screen=SCR-09");
  assert.equal(c.final, "/tasks/SCR-09", "SCR-09: " + c.final);
  c = await chain(sales, "/app?screen=SCR-09&defect=12");
  assert(c.final.startsWith("/home?next="), "SCR-09 with defect: " + c.final);
  assert(!c.final.includes("unit="), "SCR-09 gained a house");
  // SCR-01 stays the form (it is the CTA target): no redirect, no loop
  c = await chain(sales, "/app?screen=SCR-01");
  assert.deepEqual(c.hops, [], "SCR-01 must not redirect");
  assert.equal(c.status, 200);
  // a screen the role may not use must not become a landing for that screen
  c = await chain(insp, "/app?screen=SCR-12");
  assert(!c.final.startsWith("/tasks/SCR-12"), "unauthorized screen reached landing: " + c.final);
  assert(!c.final.includes("SCR-12&unit"), "unauthorized screen opened: " + c.final);
  c = await chain(sales, "/app?screen=SCR-02");
  assert(!c.final.startsWith("/tasks/SCR-02"), "unauthorized screen reached landing: " + c.final);
  // a defect in the link is not dropped: keep the Phase 1A picker with the target
  c = await chain(insp, "/app?screen=SCR-05&defect=12");
  assert(c.final.startsWith("/home?next="), "defect link: " + c.final);
  assert(decodeURIComponent(c.final).includes("defect=12"), "defect lost: " + c.final);
  // unknown screen: never a landing
  c = await chain(sales, "/app?screen=NOPE");
  assert(!c.final.startsWith("/tasks/NOPE"), "unknown: " + c.final);
  // customer flow unchanged
  let cookie = null;
  for (const link of fixture.links) {
    const r = await fetch(base + "/api/auth/access", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ token: link.token }) });
    if (r.status === 200) { cookie = (r.headers.get("set-cookie") || "").split(";")[0]; break; }
  }
  assert(cookie, "no customer link");
  c = await chain(cookie, "/app?screen=SCR-12");
  assert(c.final.startsWith("/app"), "customer left /app: " + c.final);
  assert.deepEqual(c.hops, [], "customer redirected");
  return { ok: true };
});

await check("T-LAND-14", "Back navigation: landing returns to the previous page and a legacy redirect does not trap Back", async () => {
  const p = sessions.SALES.page;
  await p.goto(base + "/home");
  await p.waitForLoadState("networkidle");
  await clickAndWait(p, p.locator(NAV + ":visible").first().getByRole("link", { name: screens["SCR-12"], exact: true }));
  assert.equal(new URL(p.url()).pathname, "/tasks/SCR-12");
  const rows = expectedRows("SALES", "SCR-12");
  assert(rows.length > 0, "fixture needs a SCR-12 row");
  await clickAndWait(p, p.locator(`main a[href="${rows[0].href}"]`).first());
  assert.equal(new URL(p.url()).pathname, "/app");
  await p.goBack();
  await p.waitForURL((u) => u.pathname === "/tasks/SCR-12", { timeout: 15000 });
  await p.goBack();
  await p.waitForURL((u) => u.pathname === "/home", { timeout: 15000 });
  // legacy URL: the redirect replaces the entry, so Back leaves it
  await p.goto(base + "/app?screen=SCR-12");
  await p.waitForURL((u) => u.pathname === "/tasks/SCR-12", { timeout: 15000 });
  await p.goBack();
  await p.waitForURL((u) => u.pathname === "/home", { timeout: 15000 });
  return { ok: true };
});

// ---- SCR-09: grouping, wording, nothing happens on its own -----------------------------
await check("T-LAND-15", "SCR-09: primary rows use journey.ts titles, the other statuses offer the existing re-issue wording, closed houses are absent", async () => {
  const p = sessions.SALES.page;
  await p.goto(base + "/tasks/SCR-09");
  await p.waitForLoadState("networkidle");
  const info = await p.evaluate(() => {
    const rows = (g) => [...document.querySelectorAll(`main [data-group="${g}"] tbody tr`)].map((row) => ({
      link: row.querySelector("a")?.textContent.replace(/\s+/g, " ").trim(),
      unit: new URL(row.querySelector("a").href).searchParams.get("unit"),
    }));
    return { primary: rows("primary"), secondary: rows("secondary") };
  });
  const expected = expectedRows("SALES", LINK_SCREEN);
  const exPrimary = expected.filter((r) => r.primary);
  const exSecondary = expected.filter((r) => !r.primary);
  assert.equal(info.primary.length, exPrimary.length, "primary count");
  assert.equal(info.secondary.length, exSecondary.length, "secondary count");
  for (const r of exPrimary) assert(info.primary.some((x) => x.link.startsWith(r.title)), "primary title missing: " + r.title);
  for (const x of info.secondary) {
    assert(x.link.startsWith(REISSUE), "secondary wording: " + x.link);
  }
  const hidden = allUnits.filter((u) => !(u.status === "READY_TO_SELL" || (u.customer_id && u.status !== "HANDED_OVER")));
  assert(hidden.length > 0, "fixture has no hidden house to check");
  for (const u of hidden) assert(![...info.primary, ...info.secondary].some((row) => row.unit === String(u.unit_id)), "closed or unbound house listed: " + u.house_no);
  return { primary: info.primary.length, secondary: info.secondary.length, hidden_checked: hidden.length };
});

async function linkCounts() {
  const c = await connect("sa_web_test_p1");
  try {
    const [[a]] = await c.query("SELECT COUNT(*) n FROM access_link");
    const [[b]] = await c.query("SELECT COUNT(*) n, SUM(customer_id IS NOT NULL) bound, GROUP_CONCAT(status ORDER BY unit_id) st FROM property_unit");
    return { links: Number(a.n), units: Number(b.n), bound: Number(b.bound), st: b.st };
  } finally { await c.end(); }
}
await check("T-LAND-16", "Nothing is created or bound by opening SCR-09 (menu, landing, legacy link, picker): no link, no customer, no house", async () => {
  const before = await linkCounts();
  const p = sessions.SALES.page;
  await clickMenu(p, screens[LINK_SCREEN]);
  assert.equal(new URL(p.url()).searchParams.get("unit"), null, "menu added a house");
  const cookie = await apiCookie("SALES");
  for (const path of ["/tasks/SCR-09", "/app?screen=SCR-09", "/app?screen=SCR-09&defect=12", "/home?next=" + encodeURIComponent("/app?screen=SCR-09")]) {
    const c = await chain(cookie, path);
    assert.equal(c.status, 200, path + " -> " + c.status);
    assert(!/[?&]unit=/.test(c.final), path + " gained a house: " + c.final);
  }
  const after = await linkCounts();
  assert.deepEqual(after, before, "database changed while only opening pages");
  return { access_links: after.links };
});

// ---- T-LAND-10: accessibility ----------------------------------------------------
await check("T-LAND-10", "axe: no violations on landing pages at 1280 and 390", async () => {
  const found = [];
  for (const [role, screen, width] of [["SALES", "SCR-01", 1280], ["SALES", "SCR-01", 390], ["SALES", "SCR-09", 1280], ["SALES", "SCR-09", 390], ["SALES", "SCR-12", 1280], ["SALES", "SCR-13", 390], ["INSPECTOR", "SCR-02", 1280], ["INSPECTOR", "SCR-16", 390]]) {
    const p = sessions[role].page;
    await p.setViewportSize({ width, height: 900 });
    await p.goto(base + "/tasks/" + screen);
    await p.waitForLoadState("networkidle");
    assert.equal(await p.locator("main#main-content h1").first().textContent(), screens[screen], `${role} ${screen}: landing page not shown`);
    const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    for (const v of r.violations) found.push({ role, screen, width, id: v.id, impact: v.impact });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${screen}@${width}: horizontal scroll`);
    await p.setViewportSize({ width: 1280, height: 900 });
  }
  assert.deepEqual(found, [], "axe: " + JSON.stringify(found));
  return { violations: 0 };
});

// ---- T-LAND-18: other roles and states never reach a landing -------------------------------
await check("T-LAND-18", "ADMIN goes to /admin and an employee who must change the password goes to /account (landing and legacy link)", async () => {
  // The session reads role and must_change_password from the database on every request,
  // so flipping them for a test session is enough. Always restored.
  const cookie = await apiCookie("HEAD_TECHNICIAN");
  const id = employees.HEAD_TECHNICIAN;
  const c = await connect("sa_web_test_p1");
  const paths = ["/tasks/SCR-03", "/tasks/SCR-12", "/app?screen=SCR-03"];
  const seen = [];
  try {
    const [[orig]] = await c.query("SELECT role, craft_category, must_change_password FROM employee WHERE employee_id=?", [id]);
    try {
      await c.query("UPDATE employee SET must_change_password=1 WHERE employee_id=?", [id]);
      for (const p of paths) {
        const r = await chain(cookie, p);
        assert(r.final.startsWith("/account"), `must-change ${p}: ended at ${r.final}`);
        seen.push("must-change " + p + " -> /account");
      }
    } finally {
      await c.query("UPDATE employee SET must_change_password=? WHERE employee_id=?", [orig.must_change_password, id]);
    }
    try {
      await c.query("UPDATE employee SET role='ADMIN', craft_category=NULL WHERE employee_id=?", [id]);
      for (const p of paths) {
        const r = await chain(cookie, p);
        assert(r.final.startsWith("/admin"), `ADMIN ${p}: ended at ${r.final}`);
        seen.push("admin " + p + " -> /admin");
      }
    } finally {
      await c.query("UPDATE employee SET role=?, craft_category=? WHERE employee_id=?", [orig.role, orig.craft_category, id]);
    }
    const [[back]] = await c.query("SELECT role, craft_category, must_change_password FROM employee WHERE employee_id=?", [id]);
    assert.equal(back.role, orig.role, "role not restored");
    assert.equal(back.craft_category, orig.craft_category, "craft not restored");
    assert.equal(back.must_change_password, orig.must_change_password, "flag not restored");
  } finally {
    await c.end();
  }
  return { checked: seen };
});

// ---- T-LAND-17 (mutates the test DB, so it runs last): landing visibility equals what the server accepts ----
await check("T-LAND-17", "SCR-09 parity with the server: every listed house accepts UC-09, every other house is refused", async () => {
  const cookie = await apiCookie("SALES");
  const post = async (data) => {
    const r = await fetch(base + "/api/actions/UC-09", { method: "POST", headers: { "content-type": "application/json", origin: base, cookie }, body: JSON.stringify(data) });
    return r.status;
  };
  const shown = new Set(expectedRows("SALES", LINK_SCREEN).map((r) => r.unit));
  const before = (await linkCounts()).links;
  let accepted = 0, refused = 0;
  const detail = [];
  for (const u of allUnits) {
    const id = String(u.unit_id);
    const data = u.status === "READY_TO_SELL"
      ? { unit_id: id, id_card_no: "9100000000001", full_name: "ลูกค้าทดสอบ ความเท่ากัน", phone_number: "0800000091" }
      : { unit_id: id };
    const status = await post(data);
    if (shown.has(id)) { assert.equal(status, 200, `listed house ${u.house_no} (${u.status}) refused by the server: ${status}`); accepted++; }
    else { assert.equal(status, 409, `unlisted house ${u.house_no} (${u.status}) not refused: ${status}`); refused++; }
    detail.push(`${u.status}:${status}`);
  }
  const after = (await linkCounts()).links;
  assert.equal(after - before, accepted, "links created must equal accepted calls");
  assert(accepted > 0 && refused > 0, "fixture must contain listed and unlisted houses");
  return { houses: allUnits.length, accepted, refused, statuses: detail };
});

for (const s of Object.values(sessions)) await s.context.close();
await browser.close();
const failed = out.cases.filter((c) => c.status === "FAIL").length;
out.status = failed === 0 ? "PASS" : "FAIL";
out.finished_at = new Date().toISOString();
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(path.join(evidence, process.env.TASK_LANDING_EVIDENCE || "task-landing.json"), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ status: out.status, cases: out.cases.map((c) => [c.id, c.status]) }));
process.exitCode = failed === 0 ? 0 : 1;
