import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { chromium } from "@playwright/test";
import mysql from "mysql2/promise";
import { envFile } from "./demo-profile.mjs";

const config = parseEnv(readFileSync(envFile, "utf8"));
const base = config.APP_URL;
const chrome = [
  process.env.CHROME_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => candidate && existsSync(candidate));
const roles = {
  SALES: "ฝ่ายขาย",
  INSPECTOR: "ผู้ตรวจ",
  TECHNICIAN: "ช่างซ่อม",
  HEAD_TECHNICIAN: "หัวหน้าช่าง",
  ADMIN: "ผู้ดูแลระบบ",
  CUSTOMER: "ลูกค้า / บริษัทตรวจนอก",
};
const browser = await chromium.launch({ executablePath: chrome });
try {
  if (process.argv.includes("--disabled")) {
    const page = await browser.newPage();
    await page.goto(base + "/login");
    assert.equal(
      await page.getByRole("group", { name: /โหมดสาธิต/ }).count(),
      0,
    );
    const denied = await page.request.post(base + "/api/auth/demo", {
      data: { role: "ADMIN" },
      headers: { origin: base },
    });
    assert.equal(denied.status(), 404);
    await page.getByLabel("รหัสพนักงาน").fill("EMP0001");
    await page
      .getByLabel("รหัสผ่าน", { exact: true })
      .fill(config.SA_DEMO_SECRET);
    await page
      .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
      .click();
    await page.waitForURL(base + "/");
    console.log("PASS demo mode disabled and standard login works");
  } else {
    const connection = await mysql.createConnection({
      host: config.DB_HOST,
      port: Number(config.DB_PORT),
      database: config.DB_NAME,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
    });
    let media;
    try {
      const [coverage] = await connection.query(`
        SELECT (SELECT COUNT(DISTINCT status) FROM property_unit) houses,
          (SELECT COUNT(DISTINCT status) FROM inspection_request) requests,
          (SELECT COUNT(DISTINCT accept_result) FROM inspection_request) decisions,
          (SELECT COUNT(DISTINCT status) FROM inspection_round) rounds,
          (SELECT COUNT(DISTINCT d.status) FROM defect d JOIN file f ON f.defect_id=d.defect_id AND f.file_usage='BEFORE_FIX') photographed,
          (SELECT COUNT(DISTINCT CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN expires_at<=NOW() THEN 'expired' ELSE 'active' END) FROM access_link) link_states,
          (SELECT COUNT(*) FROM property_unit WHERE archived_at IS NOT NULL) archived,
          (SELECT COUNT(*) FROM project WHERE is_active=0) inactive_projects
      `);
      assert.deepEqual(coverage[0], {
        houses: 7,
        requests: 3,
        decisions: 2,
        rounds: 3,
        photographed: 6,
        link_states: 3,
        archived: 1,
        inactive_projects: 1,
      });
      [media] = await connection.query(`
        SELECT file_url, defect_id, report_id FROM file
        WHERE defect_id IN ('DEF202600003','DEF202600010') OR report_id='RPT00003'
      `);
    } finally {
      await connection.end();
    }

    for (const [role, label] of Object.entries(roles)) {
      const page = await browser.newPage();
      try {
        await page.goto(base + "/login");
        const quick = page.getByRole("group", { name: /โหมดสาธิต/ });
        const signedIn = page.waitForResponse(
          (response) => response.url() === base + "/api/auth/demo",
        );
        await quick.getByRole("button", { name: label, exact: true }).click();
        assert.equal((await signedIn).status(), 200);
        await page.waitForURL(base + "/");
        const session = await page.request.get(base + "/api/auth/session");
        const {
          data: { identity },
        } = await session.json();
        assert.equal(identity.role ?? identity.kind, role);
        if (role === "CUSTOMER") {
          assert.equal(identity.unitId, "H0006");
          await page.goto(base + "/repair-status/H0006");
          const url = media.find(
            (row) => row.defect_id === "DEF202600010",
          ).file_url;
          const photo = await page.request.get(url);
          assert.equal(photo.headers()["content-type"], "image/webp");
          const foreign = await page.request.get(
            media.find((row) => row.defect_id === "DEF202600003").file_url,
          );
          assert.equal(foreign.status(), 404);
          const evidence = page.locator(
            'img[src="' + new URL(url).pathname + '"]',
          );
          await evidence
            .first()
            .locator("xpath=ancestor::details[1]")
            .locator("summary")
            .click();
          await evidence.first().waitFor();
          assert.ok(
            await evidence
              .first()
              .evaluate((img) => img.decode().then(() => img.naturalWidth > 0)),
          );
        }
        if (role === "INSPECTOR") {
          const history = media.find((row) => row.report_id === "RPT00003");
          const response = await page.request.get(history.file_url);
          assert.equal(response.headers()["content-type"], "application/pdf");
          assert.equal(
            (await response.body()).subarray(0, 5).toString(),
            "%PDF-",
          );
        }
        console.log("PASS", role);
      } finally {
        await page.close();
      }
    }
    console.log("PASS state coverage, customer photo scope and existing PDF");
  }
} finally {
  await browser.close();
}
