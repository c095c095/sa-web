// Phase 1B/1C/1D tests: F1 (one menu, leftmost), F2 (same menu on every page,
// "งานของฉัน" first), F7 (mobile menu keyboard + ARIA). docs/FINAL-VERIFICATION-REPORT.md §3.
// Harness only; no app logic. Synthetic test DB only; never prints credentials.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connect, local, evidence, testBase } from "./db-common.mjs";
import { screens, screenRoles } from "../src/lib/runtime-contracts.ts";

const fixture = JSON.parse(
  fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
);
const base = fixture.base;
assert.equal(base, testBase);
const NAV = 'nav[aria-label="เมนูหลัก"]';
const MY_WORK = "ภาพรวม";
const ROLES = ["SALES", "INSPECTOR", "TECHNICIAN", "HEAD_TECHNICIAN"];

const db = await connect("sa_web_test_p1");
const employees = {};
for (const role of ROLES) {
  const [[row]] = await db.query(
    "SELECT employee_id FROM employee WHERE role=? AND is_active=1 ORDER BY employee_id LIMIT 1",
    [role],
  );
  employees[role] = row?.employee_id;
}
await db.end();

const out = {
  started_at: new Date().toISOString(),
  base,
  scope: "F1 single menu at the left edge, F2 same menu on every page, F7 mobile menu keyboard/ARIA; synthetic test DB only",
  cases: [],
};
function record(id, name, status, detail = {}) {
  out.cases.push({ id, name, status, ...detail });
}
async function check(id, name, fn) {
  try {
    record(id, name, "PASS", (await fn()) ?? {});
  } catch (e) {
    record(id, name, "FAIL", { message: String(e.message).slice(0, 600) });
  }
}

const browser = await chromium.launch({ channel: "msedge", headless: true });

async function employeePage(role, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(base + "/login");
  await page.getByLabel("รหัสพนักงาน", { exact: true }).fill(employees[role]);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await page.waitForURL(/\/(home|app)(\?|$)/, { timeout: 30000 });
  return { context, page };
}

async function firstUnit(page) {
  const r = await page.request.get(base + "/api/workspace");
  const units = (await r.json()).data.units || [];
  return units[0] ? String(units[0].unit_id) : null;
}

// All navs with their geometry. "visible" means on screen, not just rendered.
async function navState(page) {
  return page.evaluate((sel) => {
    const main = document.querySelector("main#main-content");
    const mainLeft = main ? main.getBoundingClientRect().left : null;
    const navs = [...document.querySelectorAll(sel)].map((n) => {
      const r = n.getBoundingClientRect();
      let el = n, hidden = false;
      while (el) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") hidden = true;
        el = el.parentElement;
      }
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        visible: !hidden && r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth,
        labels: [...n.querySelectorAll("a")].map((a) => a.textContent.trim()),
        current: [...n.querySelectorAll('a[aria-current="page"]')].map((a) => a.textContent.trim()),
        hrefs: [...n.querySelectorAll("a")].map((a) => a.getAttribute("href")),
      };
    });
    return { mainLeft: mainLeft === null ? null : Math.round(mainLeft), navs };
  }, NAV);
}

// ---- Prepare one session per role and the three pages to inspect -----------
const sessions = {};
for (const role of ROLES) {
  if (!employees[role]) continue;
  const { context, page } = await employeePage(role);
  const unit = await firstUnit(page);
  const first = screenRoles[role][0];
  sessions[role] = {
    context,
    page,
    unit,
    paths: {
      "/home": "/home",
      "/app": unit ? `/app?screen=${first}&unit=${encodeURIComponent(unit)}` : null,
      "/account": "/account",
    },
    appScreen: first,
  };
}

// ---- F1: exactly one visible menu, at the left edge ---------------------------
for (const width of [1024, 1280, 1440, 1920]) {
  await check(`T-LAY-01@${width}`, `One visible menu left of the content on every page at ${width}px`, async () => {
    const seen = [];
    for (const [role, s] of Object.entries(sessions)) {
      await s.page.setViewportSize({ width, height: 900 });
      for (const [name, p] of Object.entries(s.paths)) {
        if (!p) {
          seen.push({ role, page: name, skipped: "no visible house for this role" });
          continue;
        }
        await s.page.goto(base + p);
        await s.page.waitForLoadState("networkidle");
        const st = await navState(s.page);
        const vis = st.navs.filter((n) => n.visible);
        assert.equal(vis.length, 1, `${role} ${name}: ${vis.length} visible menus (want 1)`);
        assert(vis[0].right <= st.mainLeft, `${role} ${name}: menu is not left of the content`);
        seen.push({ role, page: name, left: vis[0].left, main_left: st.mainLeft });
      }
    }
    return { checked: seen };
  });
}

await check("T-LAY-02", "No dead 'ปิดเมนู' control is visible at desktop width", async () => {
  const s = sessions.SALES;
  await s.page.setViewportSize({ width: 1280, height: 900 });
  await s.page.goto(base + "/home");
  await s.page.waitForLoadState("networkidle");
  const visibleClose = await s.page.evaluate(() =>
    [...document.querySelectorAll('[aria-label="ปิดเมนู"]')].filter((e) => {
      const r = e.getBoundingClientRect();
      let el = e, hidden = false;
      while (el) {
        const st = getComputedStyle(el);
        if (st.display === "none" || st.visibility === "hidden") hidden = true;
        el = el.parentElement;
      }
      return !hidden && r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth;
    }).length,
  );
  assert.equal(visibleClose, 0, "visible close controls at 1280px: " + visibleClose);
  // visible text close button in the drawer header
  const xButtons = await s.page.locator(".drawer-side button:visible, .drawer-side label.btn:visible").count();
  assert.equal(xButtons, 0, "visible drawer close buttons at 1280px: " + xButtons);
  return { visible_close_controls: 0 };
});

await check("T-LAY-04", "Desktop menu panel starts at the top of the sidebar column (no gap pushed above it)", async () => {
  const s = sessions.SALES;
  await s.page.setViewportSize({ width: 1280, height: 900 });
  await s.page.goto(base + "/home");
  await s.page.waitForLoadState("networkidle");
  const g = await s.page.evaluate(() => {
    const side = document.querySelector(".drawer-side").getBoundingClientRect();
    const menu = document.querySelector(".sidebar-menu").getBoundingClientRect();
    return { side_top: Math.round(side.top), menu_top: Math.round(menu.top) };
  });
  assert.equal(g.menu_top, g.side_top, "menu panel is shifted by " + (g.menu_top - g.side_top) + "px");
  return g;
});

for (const width of [390, 768]) {
  await check(`T-LAY-03@${width}`, `Menu hidden until opened, then exactly one menu at ${width}px`, async () => {
    const s = sessions.SALES;
    await s.page.setViewportSize({ width, height: 900 });
    await s.page.goto(base + "/home");
    await s.page.waitForLoadState("networkidle");
    let st = await navState(s.page);
    assert.equal(st.navs.filter((n) => n.visible).length, 0, "menu visible before opening");
    await s.page.getByRole("button", { name: "เปิดเมนู" }).or(s.page.locator('label[aria-label="เปิดเมนู"]')).first().click();
    await s.page.waitForTimeout(400);
    st = await navState(s.page);
    assert.equal(st.navs.filter((n) => n.visible).length, 1, "want exactly one visible menu after opening");
    return { after_open_visible: 1 };
  });
}

// ---- F2: the same menu on every page, "งานของฉัน" first --------------------
async function menuLabelsOn(page, p) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + p);
  await page.waitForLoadState("networkidle");
  const st = await navState(page);
  const nav = st.navs.find((n) => n.visible) ?? st.navs[0];
  assert(nav, "no menu on " + p);
  return nav;
}

await check("T-NAV-01", "Same menu labels on /home, /app and /account for each employee role; first item is งานของฉัน", async () => {
  const detail = [];
  for (const [role, s] of Object.entries(sessions)) {
    const expected = [MY_WORK, ...screenRoles[role].map((k) => screens[k])];
    for (const [name, p] of Object.entries(s.paths)) {
      if (!p) {
        detail.push({ role, page: name, skipped: "no visible house for this role" });
        continue;
      }
      const nav = await menuLabelsOn(s.page, p);
      assert.deepEqual(nav.labels, expected, `${role} ${name}: menu differs`);
      detail.push({ role, page: name, items: nav.labels.length });
    }
  }
  return { checked: detail };
});

await check("T-NAV-02", "aria-current marks the current page; none on /account", async () => {
  const detail = [];
  for (const [role, s] of Object.entries(sessions)) {
    let nav = await menuLabelsOn(s.page, s.paths["/home"]);
    assert.deepEqual(nav.current, [MY_WORK], `${role} /home current`);
    if (s.paths["/app"]) {
      nav = await menuLabelsOn(s.page, s.paths["/app"]);
      assert.deepEqual(nav.current, [screens[s.appScreen]], `${role} /app current`);
    }
    nav = await menuLabelsOn(s.page, s.paths["/account"]);
    assert.deepEqual(nav.current, [], `${role} /account current`);
    detail.push(role);
  }
  return { roles: detail };
});

// Phase 2A: every SALES menu item has a landing page (SCR-01, SCR-09, SCR-12, SCR-13), points to /tasks/SCR-XX and carries no house.
const SALES_LANDING = ["SCR-01", "SCR-09", "SCR-12", "SCR-13"];
const keyOf = (label) => Object.keys(screens).find((k) => screens[k] === label);

await check("T-NAV-03", "งานของฉัน goes to /home; landing items go to /tasks without a house; others keep the open house", async () => {
  const s = sessions.SALES;
  assert(s.unit, "fixture needs a house for sales");
  const nav = await menuLabelsOn(s.page, s.paths["/app"]);
  assert.equal(nav.hrefs[nav.labels.indexOf(MY_WORK)], "/home", "งานของฉัน href");
  for (const [i, label] of nav.labels.entries()) {
    if (label === MY_WORK) continue;
    const key = keyOf(label);
    if (SALES_LANDING.includes(key)) assert.equal(nav.hrefs[i], "/tasks/" + key, label + ": " + nav.hrefs[i]);
    else assert(nav.hrefs[i].includes("unit=" + encodeURIComponent(s.unit)), label + " lost the house: " + nav.hrefs[i]);
  }
  return { items_checked: nav.labels.length - 1 };
});

await check("T-NAV-04", "Clicking a house-scoped menu item from /home never adds a house by itself (Phase 1A regression)", async () => {
  const s = sessions.SALES;
  await s.page.setViewportSize({ width: 1280, height: 900 });
  const detail = [];
  for (const key of screenRoles.SALES.filter((k) => k !== "SCR-01")) {
    await s.page.goto(base + "/home");
    await s.page.waitForLoadState("networkidle");
    const link = s.page.locator(NAV + ":visible").first().getByRole("link", { name: screens[key], exact: true });
    const before = s.page.url();
    await link.click();
    await s.page.waitForFunction((b) => location.href !== b, before, { timeout: 20000 });
    await s.page.waitForLoadState("networkidle");
    const u = new URL(s.page.url());
    assert.equal(u.searchParams.get("unit"), null, key + ": URL gained a house: " + u.search);
    if (SALES_LANDING.includes(key)) assert.equal(u.pathname, "/tasks/" + key, key + ": " + u.pathname);
    detail.push({ key, landed: u.pathname });
  }
  return { checked: detail };
});

// ---- Customer: menu consistency (Q12: behavior otherwise unchanged) ---------
await check("T-NAV-05", "Customer sees งานของฉัน first with the same items on /home and /app", async () => {
  let cookie = null;
  for (const link of fixture.links) {
    const r = await fetch(base + "/api/auth/access", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ token: link.token }),
    });
    if (r.status === 200) {
      cookie = (r.headers.get("set-cookie") || "").split(";")[0];
      break;
    }
  }
  assert(cookie, "no usable customer link in fixture");
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const [name, ...value] = cookie.split("=");
  await context.addCookies([{ name, value: value.join("="), url: base }]);
  const page = await context.newPage();
  const expected = [MY_WORK, ...screenRoles.CUSTOMER.map((k) => screens[k])];
  const detail = [];
  for (const p of ["/home", "/app"]) {
    const nav = await menuLabelsOn(page, p);
    assert.deepEqual(nav.labels, expected, `CUSTOMER ${p}: menu differs`);
    detail.push(p);
  }
  await context.close();
  return { pages: detail };
});

// ---- F7: mobile menu keyboard and ARIA ---------------------------------------
await check("T-KBD-02", "Hamburger is a button with aria-expanded and aria-controls that points to the menu", async () => {
  const s = sessions.SALES;
  await s.page.setViewportSize({ width: 390, height: 800 });
  await s.page.goto(base + "/home");
  await s.page.waitForLoadState("networkidle");
  const btn = s.page.locator('[aria-label="เปิดเมนู"]').first();
  const info = await btn.evaluate((e) => ({
    tag: e.tagName,
    expanded: e.getAttribute("aria-expanded"),
    controls: e.getAttribute("aria-controls"),
    controlsExists: e.getAttribute("aria-controls") ? !!document.getElementById(e.getAttribute("aria-controls")) : false,
  }));
  assert.equal(info.tag, "BUTTON", "hamburger must be a <button>, got " + info.tag);
  assert.equal(info.expanded, "false");
  assert(info.controls && info.controlsExists, "aria-controls must reference an existing element");
  return info;
});

await check("T-KBD-01", "Keyboard opens the menu with Enter, Escape closes it and focus returns to the button", async () => {
  const s = sessions.SALES;
  await s.page.setViewportSize({ width: 390, height: 800 });
  await s.page.goto(base + "/home");
  await s.page.waitForLoadState("networkidle");
  const btn = s.page.locator('[aria-label="เปิดเมนู"]').first();
  await btn.focus();
  await s.page.keyboard.press("Enter");
  await s.page.waitForTimeout(400);
  let st = await navState(s.page);
  assert.equal(st.navs.filter((n) => n.visible).length, 1, "menu did not open with Enter");
  assert.equal(await btn.getAttribute("aria-expanded"), "true", "aria-expanded after open");
  const inMenu = await s.page.evaluate((sel) => !!document.activeElement?.closest(sel), NAV);
  assert(inMenu, "focus did not move into the menu after opening");
  await s.page.keyboard.press("Escape");
  await s.page.waitForTimeout(400);
  st = await navState(s.page);
  assert.equal(st.navs.filter((n) => n.visible).length, 0, "menu did not close with Escape");
  assert.equal(await btn.getAttribute("aria-expanded"), "false", "aria-expanded after close");
  const focused = await s.page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  assert.equal(focused, "เปิดเมนู", "focus did not return to the menu button, got: " + focused);
  return { opened_with: "Enter", closed_with: "Escape", focus_returned: true };
});

await check("T-KBD-04", "Mouse: button opens the menu, the X button and the overlay each close it", async () => {
  const s = sessions.SALES;
  await s.page.setViewportSize({ width: 390, height: 800 });
  await s.page.goto(base + "/home");
  await s.page.waitForLoadState("networkidle");
  const open = () => s.page.locator('[aria-label="เปิดเมนู"]').first().click();
  const visibleNavs = async () => (await navState(s.page)).navs.filter((n) => n.visible).length;
  await open();
  await s.page.waitForTimeout(400);
  assert.equal(await visibleNavs(), 1, "click did not open the menu");
  await s.page.locator('.drawer-side button[aria-label="ปิดเมนู"]:not(.drawer-overlay)').click();
  await s.page.waitForTimeout(400);
  assert.equal(await visibleNavs(), 0, "X button did not close the menu");
  await open();
  await s.page.waitForTimeout(400);
  assert.equal(await visibleNavs(), 1, "second open failed");
  await s.page.mouse.click(370, 400); // outside the 288px panel
  await s.page.waitForTimeout(400);
  assert.equal(await visibleNavs(), 0, "overlay click did not close the menu");
  return { closed_by: ["X button", "overlay"] };
});

await check("T-KBD-03","axe: no violations on /home and /app, menu closed and open, mobile and desktop", async () => {
  const s = sessions.SALES;
  const found = [];
  const run = async (label) => {
    const r = await new AxeBuilder({ page: s.page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    for (const v of r.violations) found.push({ at: label, id: v.id, impact: v.impact, nodes: v.nodes.length });
  };
  for (const [width, p] of [[1280, s.paths["/home"]], [1280, s.paths["/app"]], [390, s.paths["/home"]]]) {
    await s.page.setViewportSize({ width, height: 900 });
    await s.page.goto(base + p);
    await s.page.waitForLoadState("networkidle");
    await run(`${width} ${p.split("?")[0]}`);
  }
  await s.page.setViewportSize({ width: 390, height: 900 });
  await s.page.goto(base + "/home");
  await s.page.waitForLoadState("networkidle");
  await s.page.locator('[aria-label="เปิดเมนู"]').first().click();
  await s.page.waitForTimeout(400);
  await run("390 /home menu open");
  assert.deepEqual(found, [], "axe violations: " + JSON.stringify(found));
  return { violations: 0 };
});

for (const s of Object.values(sessions)) await s.context.close();
await browser.close();

const failed = out.cases.filter((c) => c.status === "FAIL").length;
out.status = failed === 0 ? "PASS" : "FAIL";
out.finished_at = new Date().toISOString();
fs.mkdirSync(evidence, { recursive: true });
const file = process.env.MENU_NAV_EVIDENCE || "menu-nav.json";
fs.writeFileSync(path.join(evidence, file), JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ status: out.status, cases: out.cases.map((c) => [c.id, c.status]) }));
process.exitCode = failed === 0 ? 0 : 1;
