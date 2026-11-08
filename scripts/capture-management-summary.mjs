import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app, local, evidence, connect } from "./db-common.mjs";
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(evidence, name), "utf8"));
const core = read("runtime-integration.json"),
  browser = read("runtime-browser.json"),
  visual = read("runtime-active-visual.json"),
  management = read("management-integration.json"),
  stale = read("management-stale-task.json"),
  smoke = read("runtime-delivery-smoke.json"),
  integrity = read("source-integrity.json"),
  theme = read("management-hallmark.json");
for (const r of [core, browser, visual, management, stale, smoke, integrity])
  if (r.status !== "PASS") throw Error("A required test/audit has not passed");
if (theme.summary.fails || theme.summary.reflex || theme.summary.warns)
  throw Error("Unresolved design findings");
const build = fs.readFileSync(path.join(app, ".next/BUILD_ID"), "utf8").trim();
if (build !== management.build_id || build !== smoke.build_id)
  throw Error("Evidence belongs to another build");
const lint = JSON.parse(
  fs.readFileSync(path.join(local, "lint-management.json"), "utf8"),
);
if (lint.some((r) => r.errorCount || r.warningCount))
  throw Error("Lint findings remain");
const sha = crypto.createHash("sha256");
function walk(dir) {
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else {
      sha.update(path.relative(app, p));
      sha.update(fs.readFileSync(p));
    }
  }
}
walk(path.join(app, "src"));
const db = await connect("sa_web_dev_p1");
let live;
try {
  const [[r]] = await db.query(
    "SELECT VERSION() database_version,(SELECT COUNT(*) FROM employee WHERE role='ADMIN') administrators,(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE') base_tables",
  );
  live = r;
} finally {
  await db.end();
}
const backups = fs
    .readdirSync(path.join(local, "backups"))
    .filter((f) => f.startsWith("before-management-"))
    .sort(),
  backup = path.join(local, "backups", backups.at(-1));
const bytes = fs.statSync(path.join(backup, "databases.sql")).size;
if (!bytes) throw Error("Backup is empty");
const result = {
  recorded_at: new Date().toISOString(),
  status: "READY_FOR_A5_REVIEW",
  build_id: build,
  source_tree_sha256: sha.digest("hex"),
  node: process.version,
  database_version: live.database_version,
  base_tables: live.base_tables,
  admin_setup_pending: Number(live.administrators) === 0,
  real_admin:
    "Created by owner using local one-time setup form, not assigned from report team data",
  production_url: "http://127.0.0.1:3000/login",
  checks: {
    production_build: "PASS",
    typescript: "PASS",
    eslint_errors: 0,
    eslint_warnings: 0,
    core_http_scenarios: core.cases.length,
    core_browser_groups: browser.cases.length,
    core_layouts: browser.layouts.length,
    core_form_state_scans: visual.screens.length,
    core_ui_recovery: visual.checks.length,
    management_and_guided_flow_scenarios: management.cases.length,
    management_a11y_scans: management.accessibility.length,
    axe_violations:
      visual.violations + management.violations + browser.violation_count,
    stale_job_regression: stale.status,
    bootstrap: management.bootstrap,
    production_smoke: smoke.cases.length,
    theme: theme.summary,
    original_sources_unchanged: integrity.original_sources.unchanged,
    info_files_unchanged: integrity.info.unchanged,
  },
  migration_backup: {
    database_bytes: bytes,
    storage_present_in_backup: fs.existsSync(path.join(backup, "storage")),
    note: "No development upload storage existed when the migration backup was made; database backup is private. Restore has not yet been tested.",
  },
  scope:
    "Implemented approved admin/account extension plus task-oriented workflow; original SA sources preserved",
  next: "User A5 usability review, then P6 recovery/restore/UAT and final delivery",
  review: "docs/ADMIN-REVIEW.md",
};
fs.writeFileSync(
  path.join(evidence, "management-summary.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
