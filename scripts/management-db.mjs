import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { local, connect, runFile, ownedNames } from "./db-common.mjs";
export async function prepareManagement(database, { ddl = false } = {}) {
  if (!ownedNames.includes(database)) throw new Error("Not an owned database");
  const c = await connect(database, true);
  try {
    const [names] = await c.query(
      "SELECT DISTINCT BINARY project_name name FROM property_unit",
    );
    const seen = new Set();
    for (const r of names) {
      const key = String(r.name)
        .normalize("NFC")
        .trim()
        .toLocaleLowerCase("en");
      if (seen.has(key))
        throw new Error(
          "Project names need human reconciliation before migration",
        );
      seen.add(key);
    }
    if (ddl) await runFile(c, "003-management.sql");
    await c.query(
      "INSERT INTO project(project_name) SELECT DISTINCT project_name FROM property_unit WHERE project_id IS NULL ON DUPLICATE KEY UPDATE project_name=VALUES(project_name)",
    );
    await c.query(
      "UPDATE property_unit u JOIN project p ON BINARY p.project_name=BINARY u.project_name SET u.project_id=p.project_id WHERE u.project_id IS NULL",
    );
    const [[missing]] = await c.query(
      "SELECT COUNT(*) n FROM property_unit WHERE project_id IS NULL",
    );
    if (missing.n) throw new Error("Project backfill incomplete");
    await c.query("INSERT IGNORE INTO app_control(control_id) VALUES(1)");
    const [[admins]] = await c.query(
      "SELECT COUNT(*) n FROM employee WHERE role='ADMIN'",
    );
    const privatePath = path.join(
      local,
      database === "sa_web_dev_p1"
        ? "admin-setup.json"
        : "admin-setup-test.json",
    );
    await c.beginTransaction();
    try {
      const [[control]] = await c.query(
        "SELECT * FROM app_control WHERE control_id=1 FOR UPDATE",
      );
      if (!admins.n) {
        let code;
        if (fs.existsSync(privatePath)) {
          const saved = JSON.parse(fs.readFileSync(privatePath, "utf8"));
          if (
            crypto.createHash("sha256").update(saved.code).digest("hex") ===
            control.setup_digest
          )
            code = saved.code;
        }
        if (!code) {
          code = crypto.randomBytes(32).toString("base64url");
          fs.mkdirSync(local, { recursive: true });
          fs.writeFileSync(
            privatePath,
            JSON.stringify({ database, code }, null, 2) + "\n",
          );
          await c.query(
            "UPDATE app_control SET setup_digest=? WHERE control_id=1",
            [crypto.createHash("sha256").update(code).digest("hex")],
          );
        }
        if (database === "sa_web_dev_p1")
          fs.writeFileSync(
            path.join(local, "ADMIN-SETUP.md"),
            "# ตั้งบัญชีแอดมินครั้งแรก\n\nไฟล์เฉพาะเครื่อง ไม่ส่งต่อรหัสนี้\n\n[เปิดแบบฟอร์มตั้งแอดมิน](http://127.0.0.1:3000/setup#code=" +
              code +
              ")\n\nกรอกชื่อที่แสดงและตั้งรหัสผ่านของคุณ บัญชีเข้าใช้คือ ADMIN ไม่ใช้ข้อมูลสมาชิกในรายงานมาสร้างบัญชีแทน\n",
          );
      }
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    }
  } finally {
    await c.end();
  }
}
