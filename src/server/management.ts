import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  type Identity,
  employee,
  digest,
  recheckIdentity,
  requireReady,
} from "./auth";
import { pool, rows, one, change, transact, type Tx, type Row } from "./db";
import { requireThat, AppError } from "./errors";
import { mediaKey } from "./media";
const roles = z.enum([
  "ADMIN",
  "SALES",
  "INSPECTOR",
  "TECHNICIAN",
  "HEAD_TECHNICIAN",
]);
const crafts = z.enum([
  "CEILING",
  "ELECTRICAL",
  "PLUMBING",
  "WALL",
  "FLOOR",
  "DOOR_WINDOW",
]);
const nonempty = (max = 100) =>
  z
    .string()
    .trim()
    .min(1, "กรุณากรอกข้อมูลให้ครบ")
    .max(max, `กรอกได้ไม่เกิน ${max} ตัวอักษร`);
const code = z.string().regex(/^[A-Z0-9]{1,12}$/, "รหัสรายการไม่ถูกต้อง");
const phone = z
  .string()
  .regex(/^0\d{8,9}$/, "เบอร์โทรต้องเริ่มด้วย 0 และมี 9 หรือ 10 หลัก");
const mail = z
  .union([z.email().max(100), z.literal("")])
  .nullable()
  .optional();
const reason = (d: Record<string, unknown>) => nonempty(1000).parse(d.reason);
const strong = z
  .string()
  .min(12, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร")
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "รหัสผ่านยาวเกินขนาดที่รองรับ",
  );
const privateKeys = /password|token|digest|session_id|id_card_no|setup_code/i;
function safe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safe);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !privateKeys.test(k))
        .map(([k, v]) => [k, safe(v)]),
    );
  return value;
}
export async function audit(
  tx: Tx,
  id: Identity | { kind: "SYSTEM"; fullName: string; employeeId: string },
  action: string,
  type: string,
  key: string,
  before: unknown,
  after: unknown,
  why?: string,
) {
  await change(
    tx.db,
    "INSERT INTO audit_event(actor_id,actor_kind,actor_name,action_name,entity_type,entity_id,before_values,after_values,reason) VALUES(?,?,?,?,?,?,?,?,?)",
    [
      id.kind === "CUSTOMER" ? id.customerId : id.employeeId,
      id.kind,
      id.fullName,
      action,
      type,
      key,
      before ? JSON.stringify(safe(before)) : null,
      after ? JSON.stringify(safe(after)) : null,
      why ?? null,
    ],
  );
}
function admin(id: Identity) {
  requireReady(id);
  return employee(id, ["ADMIN"]);
}
async function control(tx: Tx) {
  await one(
    tx.db,
    "SELECT control_id FROM app_control WHERE control_id=1 FOR UPDATE",
  );
}
function fresh(r: Row, d: Record<string, unknown>) {
  requireThat(
    typeof d.updated_at === "string" && d.updated_at === r.updated_at,
    "ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดรายการล่าสุดก่อนบันทึก",
  );
}
async function record(
  tx: Tx,
  table: "employee" | "customer" | "project" | "property_unit",
  key: string,
) {
  const pk = {
    employee: "employee_id",
    customer: "customer_id",
    project: "project_id",
    property_unit: "unit_id",
  }[table];
  const r = await one(
    tx.db,
    `SELECT * FROM ${table} WHERE ${pk}=? FOR UPDATE`,
    [key],
  );
  requireThat(r, "ไม่พบรายการ", 404);
  return r;
}
export async function setupAvailable() {
  return (
    Number(
      (await one(pool, "SELECT COUNT(*) n FROM employee WHERE role='ADMIN'")).n,
    ) === 0
  );
}
const setupAttempts = { n: 0, until: 0 };
export async function setupAdmin(d: Record<string, unknown>) {
  const data = z
    .object({
      setup_code: z.string().min(32).max(128),
      full_name: nonempty(),
      phone_number: z.union([phone, z.literal("")]).optional(),
      email: mail,
      password: strong,
      confirm_password: z.string(),
    })
    .strict()
    .parse(d);
  requireThat(
    data.password === data.confirm_password,
    "รหัสผ่านสองช่องไม่ตรงกัน",
    422,
  );
  if (setupAttempts.until > Date.now() && setupAttempts.n >= 10)
    throw new AppError(429, "RATE_LIMITED", "กรุณารอแล้วลองตั้งค่าอีกครั้ง");
  const hash = await bcrypt.hash(data.password, 12);
  return transact(async (tx) => {
    await control(tx);
    requireThat(
      Number(
        (await one(tx.db, "SELECT COUNT(*) n FROM employee WHERE role='ADMIN'"))
          .n,
      ) === 0,
      "ระบบตั้งค่าบัญชีแอดมินไว้แล้ว",
      409,
    );
    const c = await one(
      tx.db,
      "SELECT setup_digest FROM app_control WHERE control_id=1",
    );
    const actual = digest(data.setup_code);
    const ok =
      typeof c.setup_digest === "string" &&
      c.setup_digest.length === 64 &&
      timingSafeEqual(Buffer.from(actual), Buffer.from(c.setup_digest));
    if (!ok) {
      setupAttempts.n =
        setupAttempts.until > Date.now() ? setupAttempts.n + 1 : 1;
      setupAttempts.until = Date.now() + 15 * 60_000;
      throw new AppError(
        403,
        "INVALID_SETUP",
        "รหัสตั้งค่าไม่ถูกต้อง กรุณาใช้รหัสในไฟล์เฉพาะเครื่อง",
      );
    }
    await change(
      tx.db,
      "INSERT INTO employee(employee_id,full_name,phone_number,email,role,password_hash) VALUES('ADMIN',?,?,?,'ADMIN',?)",
      [data.full_name, data.phone_number || null, data.email || null, hash],
    );
    await change(
      tx.db,
      "UPDATE app_control SET setup_digest=NULL,setup_finished_at=NOW(6) WHERE control_id=1",
    );
    await audit(
      tx,
      { kind: "SYSTEM", employeeId: "ADMIN", fullName: data.full_name },
      "ตั้งค่าแอดมินครั้งแรก",
      "employee",
      "ADMIN",
      null,
      { role: "ADMIN" },
    );
    return { message: "ตั้งค่าบัญชีแอดมินแล้ว", employee_id: "ADMIN" };
  });
}
export async function accountView(id: Identity) {
  const profile =
    id.kind === "EMPLOYEE"
      ? await one(
          pool,
          "SELECT employee_id,full_name,phone_number,email,role,craft_category,must_change_password,updated_at FROM employee WHERE employee_id=?",
          [id.employeeId],
        )
      : await one(
          pool,
          "SELECT customer_id,full_name,phone_number,email,CONCAT('*********',RIGHT(id_card_no,4)) id_card_mask,updated_at FROM customer WHERE customer_id=?",
          [id.customerId],
        );
  const sessions = await rows(
    pool,
    `SELECT session_id session_ref,created_at,expires_at,session_id=? current_session FROM app_session WHERE ${id.kind === "EMPLOYEE" ? "employee_id=?" : "link_id=?"} AND revoked_at IS NULL AND expires_at>NOW(6) ORDER BY created_at DESC`,
    [id.sessionId, id.kind === "EMPLOYEE" ? id.employeeId : id.linkId],
  );
  return { profile, sessions };
}
export async function accountAction(
  id: Identity,
  command: string,
  d: Record<string, unknown>,
) {
  return transact(async (tx) => {
    await control(tx);
    await recheckIdentity(id, tx.db);
    if (command === "profile") {
      requireReady(id);
      const base = {
        phone_number:
          id.kind === "EMPLOYEE" && id.role === "ADMIN"
            ? z.union([phone, z.literal("")])
            : phone,
        email: mail,
        updated_at: nonempty(40),
      };
      const data = (
        id.kind === "EMPLOYEE"
          ? z.object({ ...base, full_name: nonempty() })
          : z.object(base)
      )
        .strict()
        .parse(d);
      const table = id.kind === "EMPLOYEE" ? "employee" : "customer",
        key = id.kind === "EMPLOYEE" ? id.employeeId : id.customerId;
      const before = await record(tx, table, key);
      fresh(before, d);
      if (id.kind === "EMPLOYEE")
        await change(
          tx.db,
          "UPDATE employee SET full_name=?,phone_number=?,email=? WHERE employee_id=?",
          [
            nonempty().parse(d.full_name),
            data.phone_number || null,
            data.email || null,
            key,
          ],
        );
      else
        await change(
          tx.db,
          "UPDATE customer SET phone_number=?,email=? WHERE customer_id=?",
          [data.phone_number, data.email || null, key],
        );
      await audit(tx, id, "แก้ไขข้อมูลส่วนตัว", table, key, before, data);
      return { message: "บันทึกข้อมูลส่วนตัวแล้ว" };
    }
    if (command === "password") {
      const e = employee(id, [
        "ADMIN",
        "SALES",
        "INSPECTOR",
        "TECHNICIAN",
        "HEAD_TECHNICIAN",
      ]);
      const data = z
        .object({
          current_password: z.string().min(1),
          new_password: strong,
          confirm_password: z.string(),
        })
        .strict()
        .parse(d);
      requireThat(
        data.new_password === data.confirm_password,
        "รหัสผ่านสองช่องไม่ตรงกัน",
        422,
      );
      requireThat(
        data.current_password !== data.new_password,
        "กรุณาใช้รหัสผ่านใหม่ที่ต่างจากเดิม",
        422,
      );
      const before = await record(tx, "employee", e.employeeId);
      requireThat(
        await bcrypt.compare(
          data.current_password,
          String(before.password_hash),
        ),
        "รหัสผ่านปัจจุบันไม่ถูกต้อง",
        422,
      );
      const hash = await bcrypt.hash(data.new_password, 12);
      await change(
        tx.db,
        "UPDATE employee SET password_hash=?,must_change_password=0,password_changed_at=NOW(6) WHERE employee_id=?",
        [hash, e.employeeId],
      );
      await change(
        tx.db,
        "UPDATE app_session SET revoked_at=NOW(6) WHERE employee_id=? AND revoked_at IS NULL",
        [e.employeeId],
      );
      await audit(tx, id, "เปลี่ยนรหัสผ่าน", "employee", e.employeeId, null, {
        changed: true,
      });
      return {
        message: "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่",
        signedOut: true,
      };
    }
    if (command === "revoke-session") {
      const ref = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(d.session_ref);
      const s = await one(
        tx.db,
        `SELECT session_id FROM app_session WHERE session_id=? AND ${id.kind === "EMPLOYEE" ? "employee_id=?" : "link_id=?"} AND revoked_at IS NULL FOR UPDATE`,
        [ref, id.kind === "EMPLOYEE" ? id.employeeId : id.linkId],
      );
      requireThat(s, "ไม่พบการเข้าสู่ระบบนี้", 404);
      await change(
        tx.db,
        "UPDATE app_session SET revoked_at=NOW(6) WHERE session_id=? AND revoked_at IS NULL",
        [ref],
      );
      await audit(
        tx,
        id,
        "ออกจากระบบที่เลือก",
        "session",
        ref.slice(0, 12),
        null,
        { revoked: true },
      );
      return {
        message: "ออกจากระบบที่เลือกแล้ว",
        signedOut: ref === id.sessionId,
      };
    }
    throw new AppError(404, "NOT_FOUND", "ไม่พบรายการที่ต้องการทำ");
  });
}
export async function managementView(id: Identity, p: URLSearchParams) {
  admin(id);
  const section = p.get("section") ?? "overview",
    q = (p.get("q") ?? "").trim().slice(0, 100),
    page = Math.max(1, Math.min(100000, Number(p.get("page")) || 1)),
    limit = 12,
    filter = p.get("status") ?? "";
  const offset = (Math.floor(page) - 1) * limit,
    values: (string | number)[] = [];
  let sql = "",
    countSql = "",
    where = "",
    order = "";
  if (section === "overview") {
    const counts = await rows(
      pool,
      "SELECT status,COUNT(*) n FROM property_unit WHERE archived_at IS NULL GROUP BY status",
    );
    const tasks = await one(
      pool,
      `SELECT
        (SELECT COUNT(*) FROM defect WHERE status IN ('NEW','WAITING_ASSIGN','ASSIGNED','REWORK')) pending_defects,
        (SELECT COUNT(DISTINCT u.unit_id) FROM property_unit u JOIN inspection_round r ON r.unit_id=u.unit_id JOIN defect d ON d.round_id=r.round_id WHERE u.archived_at IS NULL AND d.status IN ('NEW','WAITING_ASSIGN','ASSIGNED','REWORK')) pending_units,
        (SELECT COUNT(*) FROM employee WHERE is_active=1) active_employees,
        (SELECT COUNT(*) FROM project WHERE is_active=1) active_projects,
        (SELECT COUNT(*) FROM access_link WHERE revoked_at IS NOT NULL OR expires_at<=NOW()) inactive_links,
        (SELECT COUNT(*) FROM app_session WHERE revoked_at IS NULL AND expires_at>NOW()) active_sessions`,
    );
    const upcoming = await rows(
      pool,
      "SELECT r.request_id,r.appointment,u.unit_id,u.house_no,u.project_name FROM inspection_request r JOIN property_unit u ON u.unit_id=r.unit_id WHERE u.archived_at IS NULL AND r.status='SUBMITTED' AND r.appointment>=NOW() ORDER BY r.appointment LIMIT 12",
    );
    const recentAudit = await rows(
      pool,
      "SELECT event_id,action_name,actor_name,created_at FROM audit_event ORDER BY event_id DESC LIMIT 5",
    );
    return { section, counts, tasks, upcoming, recentAudit };
  }
  switch (section) {
    case "employees":
      where =
        "WHERE (e.employee_id LIKE ? OR e.full_name LIKE ? OR e.phone_number LIKE ? OR e.email LIKE ?)";
      values.push("%" + q + "%", "%" + q + "%", "%" + q + "%", "%" + q + "%");
      if (filter === "active" || filter === "inactive") {
        where += " AND e.is_active=?";
        values.push(filter === "active" ? 1 : 0);
      }
      sql =
        "SELECT e.employee_id,e.full_name,e.phone_number,e.email,e.role,e.craft_category,e.is_active,e.must_change_password,e.updated_at,(SELECT COUNT(*) FROM defect d WHERE d.technician_id=e.employee_id AND d.status IN ('ASSIGNED','REWORK')) active_jobs FROM employee e ";
      countSql = "SELECT COUNT(*) n FROM employee e ";
      order = "e.full_name,e.employee_id";
      break;
    case "projects":
      where = "WHERE p.project_name LIKE ?";
      values.push("%" + q + "%");
      if (filter === "active" || filter === "inactive") {
        where += " AND p.is_active=?";
        values.push(filter === "active" ? 1 : 0);
      }
      sql =
        "SELECT p.*,(SELECT COUNT(*) FROM property_unit u WHERE u.project_id=p.project_id) unit_count FROM project p ";
      countSql = "SELECT COUNT(*) n FROM project p ";
      order = "p.project_name,p.project_id";
      break;
    case "units":
      where =
        "WHERE (u.house_no LIKE ? OR u.project_name LIKE ? OR c.full_name LIKE ? OR u.unit_id LIKE ?)";
      values.push("%" + q + "%", "%" + q + "%", "%" + q + "%", "%" + q + "%");
      if (filter === "archived") where += " AND u.archived_at IS NOT NULL";
      else {
        where += " AND u.archived_at IS NULL";
        if (filter === "pending-work")
          where +=
            " AND EXISTS(SELECT 1 FROM inspection_round r JOIN defect d ON d.round_id=r.round_id WHERE r.unit_id=u.unit_id AND d.status IN ('NEW','WAITING_ASSIGN','ASSIGNED','REWORK'))";
        else if (filter) {
          where += " AND u.status=?";
          values.push(filter);
        }
      }
      sql =
        "SELECT u.*,c.full_name customer_name FROM property_unit u LEFT JOIN customer c ON c.customer_id=u.customer_id ";
      countSql =
        "SELECT COUNT(*) n FROM property_unit u LEFT JOIN customer c ON c.customer_id=u.customer_id ";
      order =
        p.get("sort") === "oldest"
          ? "u.created_at,u.unit_id"
          : "u.created_at DESC,u.unit_id DESC";
      break;
    case "customers":
      where =
        "WHERE (c.full_name LIKE ? OR c.phone_number LIKE ? OR c.customer_id LIKE ?)";
      values.push("%" + q + "%", "%" + q + "%", "%" + q + "%");
      sql =
        "SELECT c.customer_id,c.full_name,c.phone_number,c.email,c.updated_at,CONCAT('*********',RIGHT(c.id_card_no,4)) id_card_mask,(SELECT GROUP_CONCAT(u.house_no ORDER BY u.house_no SEPARATOR ', ') FROM property_unit u WHERE u.customer_id=c.customer_id) houses FROM customer c ";
      countSql = "SELECT COUNT(*) n FROM customer c ";
      order = "c.full_name,c.customer_id";
      break;
    case "links":
      where =
        "WHERE (u.house_no LIKE ? OR c.full_name LIKE ? OR u.project_name LIKE ?)";
      values.push("%" + q + "%", "%" + q + "%", "%" + q + "%");
      if (filter === "active")
        where += " AND l.revoked_at IS NULL AND l.expires_at>NOW()";
      if (filter === "inactive")
        where += " AND (l.revoked_at IS NOT NULL OR l.expires_at<=NOW())";
      sql =
        "SELECT l.link_id,l.unit_id,l.created_at,l.expires_at,l.revoked_at,u.house_no,u.project_name,c.full_name customer_name FROM access_link l JOIN property_unit u ON u.unit_id=l.unit_id JOIN customer c ON c.customer_id=l.customer_id ";
      countSql =
        "SELECT COUNT(*) n FROM access_link l JOIN property_unit u ON u.unit_id=l.unit_id JOIN customer c ON c.customer_id=l.customer_id ";
      order = "l.created_at DESC,l.link_id DESC";
      break;
    case "sessions":
      where =
        "WHERE s.revoked_at IS NULL AND s.expires_at>NOW() AND (COALESCE(e.full_name,c.full_name,'') LIKE ?)";
      values.push("%" + q + "%");
      sql =
        "SELECT s.session_id session_ref,s.session_kind,s.created_at,s.expires_at,COALESCE(e.full_name,c.full_name) full_name FROM app_session s LEFT JOIN employee e ON e.employee_id=s.employee_id LEFT JOIN access_link l ON l.link_id=s.link_id LEFT JOIN customer c ON c.customer_id=l.customer_id ";
      countSql =
        "SELECT COUNT(*) n FROM app_session s LEFT JOIN employee e ON e.employee_id=s.employee_id LEFT JOIN access_link l ON l.link_id=s.link_id LEFT JOIN customer c ON c.customer_id=l.customer_id ";
      order = "s.created_at DESC,s.session_id";
      break;
    case "audit":
      where =
        "WHERE (a.actor_name LIKE ? OR a.entity_id LIKE ? OR a.action_name LIKE ?)";
      values.push("%" + q + "%", "%" + q + "%", "%" + q + "%");
      sql = "SELECT a.* FROM audit_event a ";
      countSql = "SELECT COUNT(*) n FROM audit_event a ";
      order = "a.event_id DESC";
      break;
    default:
      throw new AppError(404, "NOT_FOUND", "ไม่พบหมวดจัดการ");
  }
  const sorting = p.get("sort");
  if (sorting === "newest" || sorting === "oldest") {
    const columns: Record<string, [string, string]> = {
      employees: ["e.updated_at", "e.employee_id"],
      projects: ["p.updated_at", "p.project_id"],
      customers: ["c.updated_at", "c.customer_id"],
      units: ["u.created_at", "u.unit_id"],
      links: ["l.created_at", "l.link_id"],
      sessions: ["s.created_at", "s.session_id"],
      audit: ["a.event_id", "a.event_id"],
    };
    const [field, key] = columns[section],
      direction = sorting === "newest" ? "DESC" : "ASC";
    order = `${field} ${direction},${key} ${direction}`;
  }
  const total = Number((await one(pool, countSql + where, values)).n);
  const items = await rows(
    pool,
    sql + where + ` ORDER BY ${order} LIMIT ? OFFSET ?`,
    [...values, limit, offset],
  );
  const projects =
    section === "units"
      ? await rows(
          pool,
          "SELECT project_id,project_name,is_active FROM project ORDER BY project_name",
        )
      : [];
  const units =
    section === "links"
      ? await rows(
          pool,
          "SELECT unit_id,house_no,project_name,status FROM property_unit WHERE customer_id IS NOT NULL ORDER BY house_no",
        )
      : [];
  return {
    section,
    items,
    total,
    page: Math.floor(page),
    pages: Math.max(1, Math.ceil(total / limit)),
    projects,
    units,
  };
}
export async function managementDetail(
  id: Identity,
  kind: string,
  key: string,
) {
  admin(id);
  code.parse(key);
  if (kind === "employee") {
    const e = await one(
      pool,
      "SELECT employee_id,full_name,role,craft_category,is_active FROM employee WHERE employee_id=?",
      [key],
    );
    requireThat(e, "ไม่พบบัญชี", 404);
    return {
      employee: e,
      jobs: await rows(
        pool,
        "SELECT d.defect_id,d.category,d.location_pin,d.status,r.unit_id,u.house_no FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id WHERE d.technician_id=? AND d.status IN ('ASSIGNED','REWORK')",
        [key],
      ),
      technicians: await rows(
        pool,
        "SELECT employee_id,full_name,role,craft_category FROM employee WHERE is_active=1 AND role IN ('TECHNICIAN','HEAD_TECHNICIAN') ORDER BY full_name",
      ),
    };
  }
  if (kind === "unit") {
    const u = await one(
      pool,
      "SELECT u.*,c.full_name customer_name FROM property_unit u LEFT JOIN customer c ON c.customer_id=u.customer_id WHERE u.unit_id=?",
      [key],
    );
    requireThat(u, "ไม่พบบ้าน", 404);
    const files = await rows(
      pool,
      "SELECT f.* FROM file f LEFT JOIN defect d ON d.defect_id=f.defect_id LEFT JOIN inspection_round r ON r.round_id=d.round_id LEFT JOIN repair_report rp ON rp.report_id=f.report_id LEFT JOIN inspection_round pr ON pr.round_id=rp.round_id WHERE f.unit_id=? OR r.unit_id=? OR pr.unit_id=? ORDER BY f.uploaded_at",
      [key, key, key],
    );
    return {
      unit: u,
      files: files
        .filter((f) => mediaKey(String(f.file_url)))
        .map((f) => ({
          ...f,
          path: "/api/files/" + mediaKey(String(f.file_url)),
        })),
      rounds: await rows(
        pool,
        "SELECT * FROM inspection_round WHERE unit_id=? ORDER BY started_at DESC",
        [key],
      ),
      defects: await rows(
        pool,
        "SELECT d.defect_id,d.location_pin,d.category,d.status,d.technician_id FROM defect d JOIN inspection_round r ON r.round_id=d.round_id WHERE r.unit_id=? ORDER BY d.created_at",
        [key],
      ),
      requests: await rows(
        pool,
        "SELECT * FROM inspection_request WHERE unit_id=? ORDER BY created_at DESC",
        [key],
      ),
      customers: await rows(
        pool,
        "SELECT customer_id,full_name,phone_number FROM customer ORDER BY full_name",
      ),
    };
  }
  throw new AppError(404, "NOT_FOUND", "ไม่พบรายการ");
}
export async function managementAction(
  id: Identity,
  cmd: string,
  d: Record<string, unknown>,
) {
  const actor = admin(id);
  let temporary: string | undefined, hash: string | undefined;
  if (cmd === "employee.create" || cmd === "employee.reset") {
    temporary = randomBytes(15).toString("base64url");
    hash = await bcrypt.hash(temporary, 12);
  }
  return transact(async (tx) => {
    await control(tx);
    await recheckIdentity(id, tx.db);
    requireReady(id);
    switch (cmd) {
      case "employee.create":
      case "employee.update": {
        const data = z
          .object({
            full_name: nonempty(),
            phone_number: z.union([phone, z.literal("")]),
            email: mail,
            role: roles,
            craft_category: z
              .union([crafts, z.literal("")])
              .nullable()
              .optional(),
            is_active: z.boolean().optional(),
          })
          .parse(d);
        const craft =
          data.role === "TECHNICIAN" || data.role === "HEAD_TECHNICIAN"
            ? data.craft_category || null
            : null;
        requireThat(
          data.role !== "TECHNICIAN" || craft,
          "กรุณาเลือกประเภทงานช่าง",
          422,
        );
        requireThat(
          data.role === "ADMIN" || data.phone_number,
          "กรุณากรอกเบอร์โทรพนักงาน",
          422,
        );
        if (cmd === "employee.create") {
          const e = await one(
            tx.db,
            "INSERT INTO employee(full_name,phone_number,email,role,craft_category,password_hash,must_change_password) VALUES(?,?,?,?,?,?,1) RETURNING employee_id",
            [
              data.full_name,
              data.phone_number || null,
              data.email || null,
              data.role,
              craft,
              hash!,
            ],
          );
          await audit(
            tx,
            id,
            "สร้างบัญชีพนักงาน",
            "employee",
            String(e.employee_id),
            null,
            data,
          );
          return {
            message:
              "สร้างบัญชีแล้ว ส่งรหัสชั่วคราวให้เจ้าของบัญชีและให้เปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก",
            ...e,
            temporary_password: temporary,
          };
        }
        const key = code.parse(d.employee_id),
          old = await record(tx, "employee", key);
        fresh(old, d);
        const active = z.boolean().parse(d.is_active);
        const permissionChanged =
          old.role !== data.role ||
          old.craft_category !== craft ||
          Boolean(old.is_active) !== active;
        if (
          old.role === "ADMIN" &&
          old.is_active &&
          (!active || data.role !== "ADMIN")
        ) {
          const count = await one(
            tx.db,
            "SELECT COUNT(*) n FROM employee WHERE role='ADMIN' AND is_active=1",
          );
          requireThat(
            Number(count.n) > 1,
            "ต้องมีแอดมินที่เปิดใช้งานอย่างน้อยหนึ่งบัญชี",
          );
        }
        if (permissionChanged) {
          const jobs = await one(
            tx.db,
            "SELECT COUNT(*) n FROM defect WHERE technician_id=? AND status IN ('ASSIGNED','REWORK')",
            [key],
          );
          requireThat(
            !Number(jobs.n),
            "บัญชีนี้มีงานค้าง กรุณาโอนงานให้ช่างที่ตรงประเภทก่อนเปลี่ยนสิทธิ์หรือปิดบัญชี",
          );
        }
        await change(
          tx.db,
          "UPDATE employee SET full_name=?,phone_number=?,email=?,role=?,craft_category=?,is_active=? WHERE employee_id=?",
          [
            data.full_name,
            data.phone_number || null,
            data.email || null,
            data.role,
            craft,
            active ? 1 : 0,
            key,
          ],
        );
        if (permissionChanged)
          await change(
            tx.db,
            "UPDATE app_session SET revoked_at=NOW(6) WHERE employee_id=? AND revoked_at IS NULL",
            [key],
          );
        await audit(
          tx,
          id,
          "แก้บัญชีและสิทธิ์",
          "employee",
          key,
          old,
          { ...data, craft_category: craft },
          reason(d),
        );
        return {
          message: "บันทึกบัญชีแล้ว",
          signedOut: permissionChanged && key === actor.employeeId,
        };
      }
      case "employee.reset": {
        const key = code.parse(d.employee_id);
        requireThat(
          key !== actor.employeeId,
          "เปลี่ยนรหัสของคุณจากหน้าบัญชีของฉัน",
          422,
        );
        const old = await record(tx, "employee", key);
        requireThat(old.is_active, "เปิดบัญชีก่อนรีเซ็ตรหัสผ่าน");
        await change(
          tx.db,
          "UPDATE employee SET password_hash=?,must_change_password=1,password_changed_at=NOW(6) WHERE employee_id=?",
          [hash!, key],
        );
        await change(
          tx.db,
          "UPDATE app_session SET revoked_at=NOW(6) WHERE employee_id=? AND revoked_at IS NULL",
          [key],
        );
        await audit(
          tx,
          id,
          "รีเซ็ตรหัสผ่าน",
          "employee",
          key,
          null,
          { reset: true },
          reason(d),
        );
        return {
          message: "รีเซ็ตรหัสแล้ว รหัสชั่วคราวนี้แสดงเฉพาะครั้งนี้",
          employee_id: key,
          temporary_password: temporary,
          signedOut: key === actor.employeeId,
        };
      }
      case "employee.transfer": {
        const source = code.parse(d.employee_id),
          target = code.parse(d.technician_id);
        requireThat(source !== target, "เลือกช่างคนใหม่", 422);
        const e = await record(tx, "employee", target);
        requireThat(
          e.is_active &&
            ["TECHNICIAN", "HEAD_TECHNICIAN"].includes(String(e.role)),
          "ผู้รับงานต้องเป็นช่างหรือหัวหน้าช่างที่เปิดใช้งาน",
        );
        const selected = z.array(code).min(1).max(100).parse(d.defect_ids);
        requireThat(
          new Set(selected).size === selected.length,
          "มีรายการซ้ำ",
          422,
        );
        const why = reason(d);
        for (const key of selected.sort()) {
          const def = await one(
            tx.db,
            "SELECT d.*,r.status round_status FROM defect d JOIN inspection_round r ON r.round_id=d.round_id WHERE d.defect_id=? FOR UPDATE",
            [key],
          );
          requireThat(
            def &&
              def.technician_id === source &&
              ["ASSIGNED", "REWORK"].includes(String(def.status)) &&
              def.round_status !== "CLOSED",
            "รายการงานเปลี่ยนไปแล้ว กรุณาโหลดใหม่",
          );
          requireThat(
            !e.craft_category || e.craft_category === def.category,
            "ประเภทงานไม่ตรงกับช่างผู้รับ",
          );
          await change(
            tx.db,
            "UPDATE defect SET technician_id=? WHERE defect_id=? AND technician_id=? AND status IN ('ASSIGNED','REWORK')",
            [target, key, source],
          );
          await audit(
            tx,
            id,
            "โอนงานค้าง",
            "defect",
            key,
            { technician_id: source },
            { technician_id: target },
            why,
          );
        }
        return { message: "โอนงานที่เลือกแล้ว สถานะและรูปเดิมยังอยู่" };
      }
      case "project.create":
      case "project.update": {
        const name = nonempty().parse(d.project_name);
        if (cmd === "project.create") {
          const p = await one(
            tx.db,
            "INSERT INTO project(project_name) VALUES(?) RETURNING project_id",
            [name],
          );
          await audit(
            tx,
            id,
            "เพิ่มโครงการ",
            "project",
            String(p.project_id),
            null,
            { project_name: name },
          );
          return { message: "เพิ่มโครงการแล้ว", ...p };
        }
        const key = code.parse(d.project_id),
          old = await record(tx, "project", key);
        fresh(old, d);
        const active = z.boolean().parse(d.is_active);
        await change(
          tx.db,
          "UPDATE project SET project_name=?,is_active=? WHERE project_id=?",
          [name, active ? 1 : 0, key],
        );
        await change(
          tx.db,
          "UPDATE property_unit SET project_name=? WHERE project_id=?",
          [name, key],
        );
        await audit(
          tx,
          id,
          "แก้โครงการ",
          "project",
          key,
          old,
          { project_name: name, is_active: active },
          reason(d),
        );
        return {
          message:
            "บันทึกโครงการแล้ว เอกสาร PDF ที่ออกไว้ก่อนหน้ายังคงเนื้อหาเดิม",
        };
      }
      case "unit.create":
      case "unit.update": {
        const projectId = code.parse(d.project_id),
          house = nonempty(20).parse(d.house_no),
          type = d.unit_type ? nonempty(50).parse(d.unit_type) : null;
        const p = await record(tx, "project", projectId);
        if (cmd === "unit.create") {
          requireThat(p.is_active, "โครงการนี้ปิดรับบ้านใหม่แล้ว");
          const u = await one(
            tx.db,
            "INSERT INTO property_unit(project_id,project_name,house_no,unit_type,registered_by) VALUES(?,?,?,?,?) RETURNING unit_id",
            [projectId, p.project_name, house, type, actor.employeeId],
          );
          await audit(tx, id, "เพิ่มบ้าน", "unit", String(u.unit_id), null, {
            project_id: projectId,
            house_no: house,
            unit_type: type,
          });
          return {
            message: "เพิ่มบ้านแล้ว พร้อมให้ฝ่ายตรวจบ้านเริ่ม QC",
            ...u,
          };
        }
        const key = code.parse(d.unit_id),
          old = await record(tx, "property_unit", key);
        fresh(old, d);
        requireThat(!old.archived_at, "นำบ้านออกจากคลังก่อนแก้ไข");
        if (old.project_id !== projectId || old.house_no !== house) {
          const history = await one(
            tx.db,
            "SELECT (SELECT COUNT(*) FROM inspection_round WHERE unit_id=?)+(SELECT COUNT(*) FROM inspection_request WHERE unit_id=?) n",
            [key, key],
          );
          requireThat(
            !Number(history.n) && !old.customer_id,
            "บ้านมีประวัติตรวจหรือผูกลูกค้าแล้ว แก้โครงการ/เลขบ้านไม่ได้",
          );
          requireThat(p.is_active, "โครงการนี้ปิดรับบ้านใหม่แล้ว");
        }
        await change(
          tx.db,
          "UPDATE property_unit SET project_id=?,project_name=?,house_no=?,unit_type=? WHERE unit_id=?",
          [projectId, p.project_name, house, type, key],
        );
        await audit(
          tx,
          id,
          "แก้ข้อมูลบ้าน",
          "unit",
          key,
          old,
          { project_id: projectId, house_no: house, unit_type: type },
          reason(d),
        );
        return { message: "บันทึกข้อมูลบ้านแล้ว" };
      }
      case "unit.archive": {
        const key = code.parse(d.unit_id),
          old = await record(tx, "property_unit", key);
        fresh(old, d);
        const archived = z.boolean().parse(d.archived);
        if (archived) {
          const open = await one(
            tx.db,
            "SELECT (SELECT COUNT(*) FROM inspection_round WHERE unit_id=? AND status<>'CLOSED')+(SELECT COUNT(*) FROM inspection_request WHERE unit_id=? AND status<>'COMPLETED') n",
            [key, key],
          );
          requireThat(
            !Number(open.n) &&
              (!old.customer_id || old.status === "HANDED_OVER"),
            "บ้านยังมีงานเปิดอยู่หรืออยู่ระหว่างทำสัญญา/ส่งมอบ จึงยังเก็บเข้าคลังไม่ได้",
          );
        }
        const why = reason(d);
        await change(
          tx.db,
          "UPDATE property_unit SET archived_at=?,archive_reason=? WHERE unit_id=?",
          [archived ? new Date() : null, archived ? why : null, key],
        );
        await audit(
          tx,
          id,
          archived ? "เก็บบ้านเข้าคลัง" : "นำบ้านกลับจากคลัง",
          "unit",
          key,
          old,
          { archived },
          why,
        );
        return {
          message: archived
            ? "เก็บเข้าคลังแล้ว ยังดูประวัติเดิมได้"
            : "นำบ้านกลับมาแล้ว",
        };
      }
      case "customer.create":
      case "customer.update": {
        const data = z
          .object({ full_name: nonempty(), phone_number: phone, email: mail })
          .parse(d);
        if (cmd === "customer.create") {
          const card = z
            .string()
            .regex(/^\d{13}$/, "เลขประจำตัวต้องมี 13 หลัก")
            .parse(d.id_card_no);
          const c = await one(
            tx.db,
            "INSERT INTO customer(id_card_no,full_name,phone_number,email) VALUES(?,?,?,?) RETURNING customer_id",
            [card, data.full_name, data.phone_number, data.email || null],
          );
          await audit(
            tx,
            id,
            "เพิ่มลูกค้า",
            "customer",
            String(c.customer_id),
            null,
            data,
          );
          return { message: "เพิ่มลูกค้าแล้ว", ...c };
        }
        const key = code.parse(d.customer_id),
          old = await record(tx, "customer", key);
        fresh(old, d);
        if (old.full_name !== data.full_name) {
          const later = await one(
            tx.db,
            "SELECT COUNT(*) n FROM property_unit WHERE customer_id=? AND status IN ('IN_INSPECTION','READY_HANDOVER','HANDED_OVER')",
            [key],
          );
          requireThat(
            !Number(later.n),
            "ลูกค้าเริ่มตรวจหรือรับมอบแล้ว แก้ชื่อทางสัญญาจากหน้านี้ไม่ได้ แก้ข้อมูลติดต่อได้",
          );
        }
        await change(
          tx.db,
          "UPDATE customer SET full_name=?,phone_number=?,email=? WHERE customer_id=?",
          [data.full_name, data.phone_number, data.email || null, key],
        );
        await audit(
          tx,
          id,
          "แก้ข้อมูลลูกค้า",
          "customer",
          key,
          old,
          data,
          reason(d),
        );
        return { message: "บันทึกข้อมูลลูกค้าแล้ว" };
      }
      case "unit.customer":
      case "link.create": {
        const key = code.parse(d.unit_id),
          u = await record(tx, "property_unit", key);
        let customerId = u.customer_id;
        const why = reason(d);
        if (cmd === "unit.customer") {
          requireThat(
            ["READY_TO_SELL", "CONTRACTED", "WAITING_INSPECTION"].includes(
              String(u.status),
            ) && !u.archived_at,
            "เปลี่ยนลูกค้าได้ก่อนเริ่มตรวจรับเท่านั้น",
          );
          const started = await one(
            tx.db,
            "SELECT COUNT(*) n FROM inspection_request WHERE unit_id=? AND status<>'SUBMITTED'",
            [key],
          );
          requireThat(
            !Number(started.n),
            "บ้านเริ่มตรวจแล้ว จึงเปลี่ยนลูกค้าจากหน้านี้ไม่ได้",
          );
          const c = await record(tx, "customer", code.parse(d.customer_id));
          customerId = c.customer_id;
          await change(
            tx.db,
            "UPDATE property_unit SET customer_id=?,status=CASE WHEN status='READY_TO_SELL' THEN 'CONTRACTED' ELSE status END WHERE unit_id=?",
            [customerId, key],
          );
          await change(
            tx.db,
            "UPDATE inspection_request SET customer_id=? WHERE unit_id=? AND status='SUBMITTED'",
            [customerId, key],
          );
          await change(
            tx.db,
            "UPDATE app_session s JOIN access_link l ON l.link_id=s.link_id SET s.revoked_at=NOW(6) WHERE l.unit_id=? AND s.revoked_at IS NULL",
            [key],
          );
          await change(
            tx.db,
            "UPDATE access_link SET revoked_at=NOW(6) WHERE unit_id=? AND revoked_at IS NULL",
            [key],
          );
        }
        requireThat(customerId, "บ้านนี้ยังไม่ผูกลูกค้า");
        const token = randomBytes(32).toString("base64url");
        const l = await one(
          tx.db,
          "INSERT INTO access_link(unit_id,customer_id,token,expires_at,created_by,created_at) VALUES(?,?,?,DATE_ADD(NOW(6),INTERVAL 30 DAY),?,NOW(6)) RETURNING link_id",
          [key, customerId, digest(token), actor.employeeId],
        );
        await audit(
          tx,
          id,
          cmd === "unit.customer" ? "ผูกลูกค้าและออกลิงก์" : "ออกลิงก์ลูกค้า",
          "unit",
          key,
          { customer_id: u.customer_id },
          { customer_id: customerId, link_id: l.link_id },
          why,
        );
        return {
          message: "ออกลิงก์แล้ว คัดลอกให้ลูกค้าได้ ลิงก์มีอายุ 30 วัน",
          url:
            (process.env.APP_URL ?? "http://localhost:3000") +
            "/access#token=" +
            token,
        };
      }
      case "link.revoke": {
        const key = code.parse(d.link_id);
        const l = await one(
          tx.db,
          "SELECT link_id,unit_id,revoked_at FROM access_link WHERE link_id=? FOR UPDATE",
          [key],
        );
        requireThat(l, "ไม่พบลิงก์", 404);
        await change(
          tx.db,
          "UPDATE access_link SET revoked_at=NOW(6) WHERE link_id=? AND revoked_at IS NULL",
          [key],
        );
        await change(
          tx.db,
          "UPDATE app_session SET revoked_at=NOW(6) WHERE link_id=? AND revoked_at IS NULL",
          [key],
        );
        await audit(
          tx,
          id,
          "เพิกถอนลิงก์",
          "access_link",
          key,
          l,
          { revoked: true },
          reason(d),
        );
        return { message: "เพิกถอนลิงก์และการเข้าสู่ระบบที่ใช้ลิงก์นี้แล้ว" };
      }
      case "session.revoke": {
        const key = z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .parse(d.session_ref);
        const s = await one(
          tx.db,
          "SELECT session_id,revoked_at FROM app_session WHERE session_id=? FOR UPDATE",
          [key],
        );
        requireThat(s, "ไม่พบการเข้าสู่ระบบ", 404);
        await change(
          tx.db,
          "UPDATE app_session SET revoked_at=NOW(6) WHERE session_id=? AND revoked_at IS NULL",
          [key],
        );
        await audit(
          tx,
          id,
          "เพิกถอนการเข้าสู่ระบบ",
          "session",
          key.slice(0, 12),
          null,
          { revoked: true },
          reason(d),
        );
        return {
          message: "เพิกถอนการเข้าสู่ระบบแล้ว",
          signedOut: key === id.sessionId,
        };
      }
      default:
        throw new AppError(404, "NOT_FOUND", "ไม่พบการจัดการที่ต้องการ");
    }
  });
}
