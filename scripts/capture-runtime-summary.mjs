import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { app, local, evidence, connect } from "./db-common.mjs";
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(evidence, name), "utf8"));
const http = read("runtime-integration.json"),
  browser = read("runtime-browser.json"),
  visual = read("runtime-active-visual.json"),
  smoke = read("runtime-delivery-smoke.json"),
  hallmark = read("runtime-hallmark.json"),
  integrity = read("source-integrity.json"),
  trace = read("runtime-traceability.json");
for (const report of [http, browser, visual, smoke, integrity, trace])
  if (report.status !== "PASS")
    throw new Error("A required runtime audit did not pass");
if (hallmark.summary.fails || hallmark.summary.reflex || hallmark.summary.warns)
  throw new Error("Unresolved design findings");
const lint = JSON.parse(
  fs.readFileSync(path.join(local, "lint-runtime.json"), "utf8"),
);
if (lint.some((f) => f.errorCount || f.warningCount))
  throw new Error("Lint did not pass");
const build = fs.readFileSync(path.join(app, ".next/BUILD_ID"), "utf8").trim();
if (smoke.build_id !== build)
  throw new Error("Final smoke is from a different build");
const hash = crypto.createHash("sha256");
function walk(dir) {
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else {
      hash.update(path.relative(app, p));
      hash.update(fs.readFileSync(p));
    }
  }
}
walk(path.join(app, "src"));
const db = await connect("sa_web_dev_p1");
let version;
try {
  [[version]] = await db.query("SELECT VERSION() database_version,@@port port");
} finally {
  await db.end();
}
const result = {
  recorded_at: new Date().toISOString(),
  status: "READY_FOR_G2",
  scope:
    "Integrated local behavior on synthetic data; user UAT, recovery/restore and G3 are pending",
  build_id: build,
  source_tree_sha256: hash.digest("hex"),
  node: process.version,
  ...version,
  checks: {
    production_build:
      "PASS (observed build command and matching final smoke artifact)",
    typescript: "PASS (production build)",
    eslint: { errors: 0, warnings: 0 },
    http_scenarios: http.cases.length,
    browser_groups: browser.cases.length,
    layout_checks: browser.layouts.length,
    additional_form_state_scans: visual.screens.length,
    ui_recovery_checks: visual.checks.length,
    axe_violations: visual.violations + browser.violation_count,
    final_smoke: smoke.cases.length,
    query_semantic_mapping: trace.original_queries,
    source_unchanged: integrity.original_sources.unchanged,
    info_unchanged: integrity.info.unchanged,
    hallmark: hallmark.summary,
  },
  post_suite_adjustments: [
    "Copy punctuation",
    "Explicit disabled cursor",
    "Selected-menu foreground color; final contrast checked in delivery smoke",
  ],
  next_gate: "User G2 behavior review before P6 / G3",
  review: "docs/G2-REVIEW.md",
};
fs.writeFileSync(
  path.join(evidence, "runtime-summary.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
