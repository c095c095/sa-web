import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { local, evidence } from "./db-common.mjs";
const f = JSON.parse(
  fs.readFileSync(path.join(local, "runtime-test.json"), "utf8"),
);
assert.equal(f.base, "http://127.0.0.1:3001");
const b = await chromium.launch({ channel: "msedge", headless: true });
const c = await b.newContext();
let result = {
  recorded_at: new Date().toISOString(),
  scope:
    "Stale/unknown selected job must not silently expose claim action for another job",
};
try {
  const auth = await c.request.post(f.base + "/api/auth/login", {
    headers: { Origin: f.base },
    data: { employee_id: "EMP0008", password: f.password },
  });
  assert.equal(auth.status(), 200);
  const p = await c.newPage();
  await p.goto(f.base + "/app?screen=SCR-03&unit=H0001&defect=ZZZZZZ");
  await p.locator("main h1").waitFor();
  result.claim_buttons = await p
    .getByRole("button", { name: /^รับงาน(นี้|ที่เลือก)$/ })
    .count();
  result.status = result.claim_buttons === 0 ? "PASS" : "FAIL";
} catch (e) {
  result.status = "FAIL";
  result.error = e.message;
} finally {
  await b.close();
  fs.writeFileSync(
    path.join(evidence, "management-stale-task.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
  if (result.status === "FAIL") process.exitCode = 1;
}
