import { workflowPath } from "../src/lib/routes.ts";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { connect, local, evidence, testBase } from "./db-common.mjs";
const fixture = JSON.parse(
    fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
  ),
  base = fixture.base;
assert.equal(base, testBase);
async function houseId(page) {
  const body = (await (await page.request.get(base + "/api/workspace")).json()).data;
  const u = (body.units || [])[0];
  assert(u, "technician has no visible house in fixture");
  return u.unit_id;
}
const db = await connect("sa_web_test_p1"),
  browser = await chromium.launch({ channel: "msedge", headless: true });
const out = {
    started_at: new Date().toISOString(),
    scope:
      "Active/eligible fixture forms: UI accessibility, field colors, layout and UI error recovery. No real customer data.",
    screens: [],
    checks: [],
  },
  contexts = [];
async function employee(id) {
  const c = await browser.newContext({ timezoneId: "Asia/Bangkok" });
  contexts.push(c);
  const r = await c.request.post(base + "/api/auth/login", {
    headers: { Origin: base },
    data: { employee_id: id, password: fixture.password },
  });
  assert.equal(r.status(), 200);
  return c;
}
async function customer(sales, unit, legacy = false) {
  const r = await sales.request.post(base + "/api/actions/UC-09", {
    headers: { Origin: base },
    data: {
      unit_id: unit,
      id_card_no: "9000000000004",
      full_name: "ลูกค้าทดสอบ หน้าจอเข้าถึง",
      phone_number: "0800000004",
    },
  });
  assert.equal(r.status(), 200);
  const url = (await r.json()).data.url;
  const c = await browser.newContext({ timezoneId: "Asia/Bangkok" });
  contexts.push(c);
  const p = await c.newPage();
  await p.goto(legacy ? url.replace("#token=", "?token=") : url);
  await p.waitForURL(base + "/access");
  await p.getByRole("button", { name: "เปิดข้อมูลบ้าน", exact: true }).click();
  await p.waitForURL(base + "/");
  assert(!p.url().includes("token"));
  await p.close();
  return c;
}
async function check(name, fn) {
  await fn();
  out.checks.push({ name, status: "PASS" });
}
try {
  const sales = await employee("EMP0001"),
    inspector = await employee("EMP0003"),
    head = await employee("EMP0008");
  const [[ready]] = await db.query(
    "SELECT unit_id FROM property_unit WHERE status='READY_TO_SELL' ORDER BY unit_id DESC LIMIT 1",
  );
  assert(ready);
  const readyId = ready.unit_id;
  // Scan sales binding form before binding the synthetic customer.
  const targets = [
    [sales, "SCR-01", "H0001"],
    [sales, "SCR-09", readyId],
    [sales, "SCR-12", readyId],
    [sales, "SCR-13", "H0010"],
    ...["SCR-02", "SCR-05", "SCR-06", "SCR-07", "SCR-08", "SCR-16"].map((s) => [
      inspector,
      s,
      s === "SCR-07" ? "H0002" : s === "SCR-16" ? "H0006" : "H0001",
    ]),
    [head, "SCR-03", "H0001"],
    [head, "SCR-04", "H0001"],
    [head, "SCR-15", "H0006"],
  ];
  const r = await inspector.request.post(base + "/api/actions/UC-06", {
    headers: { Origin: base },
    data: { round_id: "RND0002", mode: "result", recheck_result: "NO_DEFECT" },
  });
  assert.equal(r.status(), 200);
  async function scan(c, s, u) {
    const p = await c.newPage();
    for (const width of [390, 1440]) {
      await p.setViewportSize({ width, height: 1000 });
      await p.goto(base + workflowPath(s, u));
      await p.locator("h1").waitFor();
      await p.evaluate(() => document.fonts.ready);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        s + " overflow",
      );
      const axe = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      out.screens.push({
        screen: s,
        unit: u,
        width,
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target),
        })),
      });
      for (const e of await p
        .locator("input.input,select.select,textarea.textarea,input.file-input")
        .all())
        assert.equal(
          await e.evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgb(255, 255, 255)",
        );
      if (["SCR-02", "SCR-03", "SCR-14", "SCR-17", "SCR-18"].includes(s))
        await p.screenshot({
          path: path.join(
            evidence,
            "runtime-screenshots",
            `active-${s}-${width}.png`,
          ),
          fullPage: true,
        });
    }
    await p.close();
  }
  for (const target of targets) {
    await scan(...target);
    console.log("SCANNED", target[1]);
  }
  const client = await customer(sales, readyId, true),
    active = await customer(sales, "H0006"),
    sign = await customer(sales, "H0009");
  for (const target of [
    [client, "SCR-10", readyId],
    [client, "SCR-11", readyId],
    [active, "SCR-14", "H0006"],
    [active, "SCR-17", "H0006"],
    [sign, "SCR-18", "H0009"],
  ]) {
    await scan(...target);
    console.log("SCANNED", target[1]);
  }
  const anonymous = await browser.newContext();
  contexts.push(anonymous);
  const p = await anonymous.newPage();
  for (const width of [390, 1440]) {
    await p.setViewportSize({ width, height: 1000 });
    await p.goto(base + "/login");
    const axe = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    out.screens.push({
      screen: "SCR-00",
      width,
      violations: axe.violations.map((v) => ({ id: v.id })),
    });
  }
  await check("Keyboard skip link focus", async () => {
    const p = await head.newPage();
    await p.goto(base + workflowPath("SCR-03", await houseId(p)));
    await p.keyboard.press("Tab");
    assert.equal(
      await p.locator(":focus").getAttribute("href"),
      "#main-content",
    );
    await p.close();
  });
  await check(
    "Network refresh error is visible without clearing saved data",
    async () => {
      const p = await head.newPage();
      await p.goto(base + workflowPath("SCR-03", await houseId(p)));
      await p.route("**/api/workspace**", (route) => route.abort());
      await p.getByRole("button", { name: "โหลดข้อมูลล่าสุด" }).click();
      await p.locator("main").getByRole("alert").waitFor();
      assert(
        (await p.locator("main").getByRole("alert").innerText()).length > 0,
      );
      await p.unroute("**/api/workspace**");
      await p.getByRole("button", { name: "โหลดข้อมูลล่าสุด" }).click();
      await p.locator("main").getByRole("alert").waitFor({ state: "hidden" });
      await p.close();
    },
  );
  await check("Validation error retains form input", async () => {
    const p = await sales.newPage();
    await p.goto(base + workflowPath("SCR-01"));
    await p.getByLabel("โครงการ", { exact: true }).selectOption({ index: 1 });
    await p.getByLabel("เลขที่บ้าน", { exact: true }).fill("TEST-ERROR");
    await p.route("**/api/actions/UC-01", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "ทดสอบข้อความผิดพลาด" } }),
      }),
    );
    await p.getByRole("button", { name: "ลงทะเบียนบ้าน", exact: true }).click();
    await p.locator("main").getByRole("alert").waitFor();
    assert.equal(
      await p.getByLabel("เลขที่บ้าน", { exact: true }).inputValue(),
      "TEST-ERROR",
    );
    await p.close();
  });
} catch (e) {
  out.fatal = e.message;
  console.error("FAIL", e.message);
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await db.end();
  out.finished_at = new Date().toISOString();
  out.violations = out.screens.reduce((n, s) => n + s.violations.length, 0);
  out.status = out.fatal || out.violations ? "FAIL" : "PASS";
  fs.writeFileSync(
    path.join(evidence, "runtime-active-visual.json"),
    JSON.stringify(out, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      status: out.status,
      screens: out.screens.length,
      checks: out.checks.length,
      violations: out.violations,
      fatal: out.fatal,
    }),
  );
  if (out.status === "FAIL") process.exitCode = 1;
}
