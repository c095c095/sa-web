import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
export const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const root = path.dirname(app);
export const ownedNames = ["sa_web_dev_p1", "sa_web_test_p1"];
export const local = path.join(app, ".local");
export const evidence = path.join(app, "evidence");
// Test-harness port. Default 3001 keeps the existing workflow; an isolated
// environment may set SA_TEST_PORT (e.g. 3002). Harness-only; no app logic.
export const testPort = (() => {
  const raw = process.env.SA_TEST_PORT || "3001";
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1024 || n > 65535)
    throw new Error("SA_TEST_PORT must be an integer between 1024 and 65535");
  return n;
})();
export const testBase = `http://127.0.0.1:${testPort}`;
fs.mkdirSync(evidence, { recursive: true });
if (fs.existsSync(path.join(app, ".env.local")))
  process.loadEnvFile(path.join(app, ".env.local"));
export async function connect(database, admin = false) {
  if (database && !ownedNames.includes(database))
    throw new Error("Database is outside the P1 allowlist");
  const c = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: admin ? "root" : process.env.DB_USER,
    password: admin
      ? process.env.SA_DB_ADMIN_PASSWORD || ""
      : process.env.DB_PASSWORD,
    database,
    namedPlaceholders: true,
    multipleStatements: false,
    decimalNumbers: true,
    dateStrings: true,
    timezone: "Z",
    charset: "utf8mb4",
  });
  await c.query("SET time_zone = '+00:00'");
  await c.query(
    "SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
  );
  return c;
}
export function statements(sql) {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
export async function runFile(c, name) {
  for (const sql of statements(
    fs.readFileSync(path.join(app, "db", name), "utf8"),
  ))
    await c.query(sql);
}
export async function resetOwnedTest(c) {
  const [[row]] = await c.query("SELECT DATABASE() AS db");
  if (
    row.db !== "sa_web_test_p1" ||
    !fs.existsSync(path.join(local, "db-owned.json"))
  )
    throw new Error("Only the owned P1 test fixture may be reset");
  const admin = await connect(row.db, true);
  try {
    await admin.query("SET FOREIGN_KEY_CHECKS=0");
    try {
      for (const t of [
        "app_session",
        "audit_event",
        "app_control",
        "project",
      ]) {
        const [[has]] = await admin.query(
          "SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
          [t],
        );
        if (has.n) await admin.query("TRUNCATE TABLE " + t);
      }
      for (const t of [
        "file",
        "access_link",
        "repair_report",
        "defect",
        "inspection_round",
        "inspection_request",
        "property_unit",
        "customer",
        "employee",
      ])
        await admin.query("TRUNCATE TABLE " + t);
    } finally {
      await admin.query("SET FOREIGN_KEY_CHECKS=1");
    }
    await runFile(admin, "seed-p1.sql");
  } finally {
    await admin.end();
  }
}
