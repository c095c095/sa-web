import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { local, evidence, ownedNames } from "./db-common.mjs";
import { prepareManagement } from "./management-db.mjs";
if (!fs.existsSync(path.join(local, "db-owned.json")))
  throw new Error("Missing ownership record");
const dest = path.resolve(
  local,
  "backups",
  "before-management-" + new Date().toISOString().replace(/[:.]/g, "-"),
);
fs.mkdirSync(dest, { recursive: true });
const backup = spawnSync(
  "C:/xampp/mysql/bin/mysqldump.exe",
  [
    "--host=127.0.0.1",
    "--port=3306",
    "--user=root",
    "--single-transaction",
    "--databases",
    ...ownedNames,
    "--result-file=" + path.join(dest, "databases.sql"),
  ],
  {
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, MYSQL_PWD: process.env.SA_DB_ADMIN_PASSWORD || "" },
  },
);
if (backup.status !== 0)
  throw new Error("Backup failed; migration not started");
const storage = path.resolve(local, "storage");
if (fs.existsSync(storage))
  fs.cpSync(storage, path.join(dest, "storage"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
for (const name of ownedNames) await prepareManagement(name, { ddl: true });
fs.writeFileSync(
  path.join(evidence, "management-migration.json"),
  JSON.stringify(
    {
      applied_at: new Date().toISOString(),
      status: "PASS",
      databases: ownedNames,
      backup:
        "Private database and existing dev storage backup created before DDL",
      first_admin: "Not fabricated. Local owner completes one-time setup form.",
      added_tables: ["project", "app_control", "audit_event"],
      original_sources: "No original SA files edited",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Management extension migrated. Private setup guide created; no codes or passwords printed.",
);
