import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { envFile, profileDir, root, state } from "./demo-profile.mjs";

const database = "sa_web_demo";
const user = "sa_web_demo";
const host = "127.0.0.1";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

function port(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1024 || value > 65535)
    throw new Error(name + " must be a port between 1024 and 65535");
  return value;
}

async function readConfig() {
  try {
    return parseEnv(await readFile(envFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function applySql(connection, filename) {
  const sql = await readFile(path.join(root, "db", filename), "utf8");
  for (const statement of sql.replace(/--[^\n]*/g, "").split(";")) {
    if (statement.trim()) await connection.query(statement.trim());
  }
}

async function shiftDates(connection) {
  const [[{ days }]] = await connection.query(
    "SELECT DATEDIFF(DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR), '2026-11-09') days",
  );
  const tables = {
    property_unit: ["created_at", "handed_over_at"],
    inspection_request: [
      "preferred_date",
      "appointment",
      "arrival",
      "accepted_at",
      "created_at",
    ],
    inspection_round: ["recheck_date", "started_at", "closed_at"],
    defect: [
      "assigned_date",
      "target_date",
      "completed_date",
      "verified_at",
      "created_at",
    ],
    repair_report: ["created_at"],
  };
  for (const [table, columns] of Object.entries(tables)) {
    const assignments = columns.map(
      (column) => column + "=DATE_ADD(" + column + ", INTERVAL ? DAY)",
    );
    await connection.query(
      "UPDATE " + table + " SET " + assignments.join(","),
      columns.map(() => days),
    );
  }
  await connection.query(
    "UPDATE inspection_round SET inspection_finished_at=started_at+INTERVAL 1 DAY WHERE round_id='RND0002'",
  );
  await connection.query(
    "UPDATE defect SET target_date=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR)+INTERVAL 2 DAY WHERE defect_id IN ('DEF202600001','DEF202600002','DEF202600004')",
  );
  await connection.query(
    "UPDATE access_link SET created_at=CASE WHEN link_id='LNK000002' THEN NOW(6)-INTERVAL 35 DAY WHEN revoked_at IS NOT NULL THEN NOW(6)-INTERVAL 4 DAY ELSE NOW(6)-INTERVAL 1 DAY END",
  );
  await connection.query(
    "UPDATE access_link SET expires_at=NOW(6)+INTERVAL 30 DAY WHERE expires_at>NOW(6) AND revoked_at IS NULL",
  );
}

async function seedMedia(connection, baseUrl, createdFiles) {
  const storage = path.join(state, "storage", "files");
  await mkdir(storage, { recursive: true });
  const fixtures = [
    ["defect_id", "DEF202600001", "BEFORE_FIX", "restoration-before.webp"],
    ["defect_id", "DEF202600002", "BEFORE_FIX", "pipe.webp"],
    ["defect_id", "DEF202600003", "BEFORE_FIX", "restoration-before.webp"],
    ["defect_id", "DEF202600003", "AFTER_FIX", "restoration-after.webp"],
    ["defect_id", "DEF202600004", "BEFORE_FIX", "ceiling.webp"],
    ["defect_id", "DEF202600005", "BEFORE_FIX", "restoration-before.webp"],
    ["defect_id", "DEF202600005", "AFTER_FIX", "restoration-after.webp"],
    ["defect_id", "DEF202600008", "BEFORE_FIX", "paint.webp"],
    ["defect_id", "DEF202600010", "BEFORE_FIX", "ceiling.webp"],
    ["defect_id", "DEF202600014", "BEFORE_FIX", "pipe.webp"],
    ["defect_id", "DEF202600015", "BEFORE_FIX", "restoration-before.webp"],
    ["defect_id", "DEF202600015", "AFTER_FIX", "restoration-after.webp"],
    ["defect_id", "DEF202600017", "BEFORE_FIX", "ceiling.webp"],
    ["defect_id", "DEF202600018", "BEFORE_FIX", "restoration-before.webp"],
    ["defect_id", "DEF202600018", "AFTER_FIX", "restoration-after.webp"],
    ["report_id", "RPT00003", "SUMMARY_PDF", "report-19-8.pdf"],
    ["report_id", "RPT00005", "SUMMARY_PDF", "report-19-9.pdf"],
    ["unit_id", "H0008", "SIGNATURE", "demo-signature.webp"],
  ];
  for (const [ownerColumn, id, usage, source] of fixtures) {
    const key = randomUUID() + path.extname(source);
    const destination = path.join(storage, key);
    createdFiles.push(destination);
    await copyFile(path.join(root, "db", "demo-media", source), destination);
    await connection.query(
      "INSERT INTO file(" + ownerColumn + ",file_url,file_usage) VALUES(?,?,?)",
      [id, baseUrl + "/api/files/" + key, usage],
    );
  }
}

async function setup() {
  const saved = await readConfig();
  const dbPort = port("SA_DEMO_DB_PORT", saved?.DB_PORT ?? 3306);
  const appPort = port(
    "SA_DEMO_PORT",
    saved ? new URL(saved.APP_URL).port : 3010,
  );
  const baseUrl = "http://" + host + ":" + appPort;
  if (saved && (dbPort !== Number(saved.DB_PORT) || baseUrl !== saved.APP_URL))
    throw new Error(
      "This checkout already has a demo profile on different ports. Use its original ports or a separate checkout.",
    );

  const connection = await mysql.createConnection({
    host,
    port: dbPort,
    user: process.env.SA_DEMO_DB_ADMIN_USER ?? "root",
    password:
      process.env.SA_DEMO_DB_ADMIN_PASSWORD ??
      process.env.SA_DB_ADMIN_PASSWORD ??
      "",
    charset: "utf8mb4",
  });
  let createdDatabase = false;
  let createdUser = false;
  const createdFiles = [];
  try {
    const [[lock]] = await connection.query(
      "SELECT GET_LOCK('sa_web_demo_setup', 10) acquired",
    );
    if (lock.acquired !== 1)
      throw new Error("Another demo setup is in progress.");
    const [schemas] = await connection.query(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?",
      [database],
    );
    if (schemas.length) {
      if (!saved)
        throw new Error(
          "A demo database already exists without this checkout's profile.",
        );
      const [markers] = await connection.query(
        "SELECT digest FROM sa_web_demo.demo_install WHERE id=1",
      );
      if (markers[0]?.digest !== digest(saved.SA_DEMO_SECRET))
        throw new Error("The demo database belongs to another profile.");
      console.log(
        "Demo is ready. Rehearsal data kept. Run npm run demo:start.",
      );
      return;
    }
    if (saved)
      throw new Error(
        "The saved demo profile's database is missing. Check the MariaDB port or use a new checkout.",
      );
    const [users] = await connection.query(
      "SELECT User FROM mysql.user WHERE User=? AND Host=?",
      [user, host],
    );
    if (users.length) throw new Error("The demo database user already exists.");
    const dbPassword = secret();
    const demoSecret = secret();

    await connection.query(
      "CREATE DATABASE sa_web_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    createdDatabase = true;
    await connection.query("USE sa_web_demo");
    for (const filename of [
      "001-p1-candidate.sql",
      "seed-p1.sql",
      "002-runtime.sql",
      "003-management.sql",
      "seed-demo.sql",
    ])
      await applySql(connection, filename);
    await shiftDates(connection);
    await seedMedia(connection, baseUrl, createdFiles);
    const accounts = ["EMP0001", "EMP0003", "EMP0007", "EMP0008", "ADMIN"];
    for (const id of accounts)
      await connection.query(
        "UPDATE employee SET password_hash=? WHERE employee_id=?",
        [await bcrypt.hash(demoSecret, 12), id],
      );

    const [links] = await connection.query(
      "SELECT link_id,unit_id FROM access_link ORDER BY link_id",
    );
    let customerToken = "";
    const shareLinks = [];
    for (const link of links) {
      const token = secret();
      if (link.unit_id === "H0006") customerToken = token;
      await connection.query("UPDATE access_link SET token=? WHERE link_id=?", [
        digest(token),
        link.link_id,
      ]);
      shareLinks.push(
        "- " +
          link.unit_id +
          " / " +
          link.link_id +
          " — " +
          baseUrl +
          "/access#token=" +
          token,
      );
    }
    await connection.query(
      "CREATE TABLE demo_install (id TINYINT PRIMARY KEY, digest CHAR(64) NOT NULL)",
    );
    await connection.query("INSERT INTO demo_install VALUES(1,?)", [
      digest(demoSecret),
    ]);
    await connection.query(
      "CREATE USER 'sa_web_demo'@'127.0.0.1' IDENTIFIED BY ?",
      [dbPassword],
    );
    createdUser = true;
    await connection.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON sa_web_demo.* TO 'sa_web_demo'@'127.0.0.1'",
    );

    const config = {
      DB_HOST: host,
      DB_PORT: dbPort,
      DB_NAME: database,
      DB_USER: user,
      DB_PASSWORD: dbPassword,
      APP_URL: baseUrl,
      APP_STORAGE_DIR: profileDir + "/storage",
      SESSION_SECRET: secret(),
      SA_DEMO_SECRET: demoSecret,
      SA_DEMO_CUSTOMER_TOKEN: customerToken,
      NEXT_TELEMETRY_DISABLED: "1",
    };
    const linksFile = path.join(state, "CUSTOMER-LINKS.md");
    createdFiles.push(linksFile);
    await writeFile(
      linksFile,
      "# Local synthetic customer links\n\n" + shareLinks.join("\n") + "\n",
      { mode: 0o600 },
    );
    const temp = envFile + "." + randomUUID();
    createdFiles.push(temp);
    await writeFile(
      temp,
      Object.entries(config)
        .map(([key, value]) => key + "=" + value)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
    await rename(temp, envFile);
    console.log(
      "Demo database and local files are ready. Run npm run demo:start and open " +
        baseUrl +
        "/login",
    );
  } catch (error) {
    await Promise.allSettled([
      ...createdFiles.map((file) => unlink(file)),
      ...(createdUser
        ? [connection.query("DROP USER 'sa_web_demo'@'127.0.0.1'")]
        : []),
      ...(createdDatabase
        ? [connection.query("DROP DATABASE sa_web_demo")]
        : []),
    ]);
    throw error;
  } finally {
    await connection.end();
  }
}

try {
  await mkdir(state, { recursive: true });
  const lockPath = path.join(state, "setup.lock");
  const lock = await open(lockPath, "wx");
  try {
    await setup();
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
} catch (error) {
  console.error(
    "Demo setup failed:",
    error.code === "EEXIST"
      ? "A local setup is already running."
      : (error.code ?? error.message),
  );
  if (
    ["ECONNREFUSED", "ETIMEDOUT", "EACCES", "ER_ACCESS_DENIED_ERROR"].includes(
      error.code,
    )
  )
    console.error(
      "Check that MariaDB is running and set SA_DEMO_DB_PORT / SA_DEMO_DB_ADMIN_PASSWORD as needed.",
    );
  process.exitCode = 1;
}
