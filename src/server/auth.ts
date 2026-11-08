import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { z } from "zod";
import { pool, one, rows, change, type Db } from "./db";
import { AppError, requireThat } from "./errors";
export type Role =
  "SALES" | "INSPECTOR" | "TECHNICIAN" | "HEAD_TECHNICIAN" | "ADMIN";
export type Identity =
  | {
      kind: "EMPLOYEE";
      employeeId: string;
      role: Role;
      craft: string | null;
      fullName: string;
      mustChangePassword: boolean;
      sessionId: string;
    }
  | {
      kind: "CUSTOMER";
      linkId: string;
      unitId: string;
      customerId: string;
      fullName: string;
      sessionId: string;
    };
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
const cookieName = "sa_session";
const dummy = bcrypt.hashSync(randomBytes(24).toString("hex"), 12);
const attempts = new Map<string, { count: number; until: number }>();
function rawCookie(header: string | null) {
  return header?.match(/(?:^|;\s*)sa_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
}
export function enforceOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const configured = new URL(process.env.APP_URL ?? "http://localhost:3000");
  const trusted = new Set([configured.origin]);
  if (["localhost", "127.0.0.1"].includes(configured.hostname)) {
    const alternate = new URL(configured);
    alternate.hostname =
      configured.hostname === "localhost" ? "127.0.0.1" : "localhost";
    trusted.add(alternate.origin);
  }
  requireThat(
    origin && trusted.has(origin),
    "คำขอนี้ไม่ได้มาจากเว็บไซต์ที่อนุญาต",
    403,
  );
}
export async function identityForToken(
  raw: string | undefined,
  db: Db = pool,
): Promise<Identity | null> {
  if (!raw || !/^[-_A-Za-z0-9]{43}$/.test(raw)) return null;
  const sessionId = digest(raw);
  const r = await one(
    db,
    `SELECT s.session_kind,s.employee_id,s.link_id,e.full_name employee_name,e.role,e.craft_category,e.must_change_password,l.unit_id,l.customer_id,c.full_name customer_name
    FROM app_session s LEFT JOIN employee e ON e.employee_id=s.employee_id LEFT JOIN access_link l ON l.link_id=s.link_id LEFT JOIN customer c ON c.customer_id=l.customer_id LEFT JOIN property_unit u ON u.unit_id=l.unit_id
    WHERE s.session_id=? AND s.revoked_at IS NULL AND s.expires_at>NOW(6) AND ((s.session_kind='EMPLOYEE' AND e.is_active=1) OR (s.session_kind='CUSTOMER' AND l.revoked_at IS NULL AND l.expires_at>NOW(6) AND u.customer_id=l.customer_id))`,
    [sessionId],
  );
  if (!r) return null;
  return r.session_kind === "EMPLOYEE"
    ? {
        kind: "EMPLOYEE",
        employeeId: String(r.employee_id),
        role: r.role as Role,
        craft: r.craft_category ? String(r.craft_category) : null,
        fullName: String(r.employee_name),
        mustChangePassword: Boolean(r.must_change_password),
        sessionId,
      }
    : {
        kind: "CUSTOMER",
        linkId: String(r.link_id),
        unitId: String(r.unit_id),
        customerId: String(r.customer_id),
        fullName: String(r.customer_name),
        sessionId,
      };
}
export async function currentIdentity(req?: Request) {
  const raw = req
    ? rawCookie(req.headers.get("cookie"))
    : (await cookies()).get(cookieName)?.value;
  return identityForToken(raw);
}
export async function needIdentity(req?: Request) {
  const id = await currentIdentity(req);
  if (!id)
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "กรุณาเข้าสู่ระบบหรือตรวจลิงก์ที่ได้รับ",
    );
  return id;
}
export function employee(id: Identity, allowed: Role[]) {
  requireThat(
    id.kind === "EMPLOYEE" && allowed.includes(id.role),
    "คุณไม่มีสิทธิ์ดำเนินการส่วนนี้",
    403,
  );
  return id as Extract<Identity, { kind: "EMPLOYEE" }>;
}
export function customer(id: Identity) {
  requireThat(id.kind === "CUSTOMER", "ส่วนนี้สำหรับลูกค้า/บริษัทตรวจนอก", 403);
  return id as Extract<Identity, { kind: "CUSTOMER" }>;
}
export function publicIdentity(id: Identity) {
  if (id.kind === "EMPLOYEE")
    return {
      kind: id.kind,
      employeeId: id.employeeId,
      role: id.role,
      craft: id.craft,
      fullName: id.fullName,
      mustChangePassword: id.mustChangePassword,
    };
  return { kind: id.kind, unitId: id.unitId, fullName: id.fullName };
}
function cookie(raw: string, secure: boolean, age = 8 * 3600) {
  return `${cookieName}=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? "; Secure" : ""}`;
}
async function issueSession(
  kind: "EMPLOYEE" | "CUSTOMER",
  employeeId: string | null,
  linkId: string | null,
  secure: boolean,
) {
  const raw = randomBytes(32).toString("base64url");
  await change(
    pool,
    `INSERT INTO app_session(session_id,session_kind,employee_id,link_id,expires_at) VALUES(?,?,?,?,${kind === "CUSTOMER" ? "LEAST(DATE_ADD(NOW(6),INTERVAL 8 HOUR),(SELECT expires_at FROM access_link WHERE link_id=?))" : "DATE_ADD(NOW(6),INTERVAL 8 HOUR)"})`,
    kind === "CUSTOMER"
      ? [digest(raw), kind, employeeId, linkId, linkId]
      : [digest(raw), kind, employeeId, linkId],
  );
  return {
    cookie: cookie(raw, secure),
    identity: publicIdentity((await identityForToken(raw))!),
  };
}
export async function renewedEmployeeSession(employeeId: string, req: Request) {
  return issueSession(
    "EMPLOYEE",
    employeeId,
    null,
    new URL(req.url).protocol === "https:",
  );
}
export async function login(data: unknown, req: Request) {
  const d = z
    .object({
      employee_id: z.string().trim().min(1).max(12),
      password: z.string().min(1).max(128),
    })
    .parse(data);
  const key = d.employee_id.toUpperCase();
  const state = attempts.get(key);
  if (state && state.until > Date.now() && state.count >= 5)
    throw new AppError(
      429,
      "RATE_LIMITED",
      "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอแล้วลองใหม่",
    );
  const r = await one(
    pool,
    "SELECT employee_id,password_hash FROM employee WHERE employee_id=? AND is_active=1",
    [key],
  );
  const ok = await bcrypt.compare(
    d.password,
    r ? String(r.password_hash) : dummy,
  );
  if (!r || !ok) {
    const old =
      state && state.until > Date.now()
        ? state
        : { count: 0, until: Date.now() + 15 * 60_000 };
    attempts.set(key, { ...old, count: old.count + 1 });
    if (attempts.size > 2000)
      for (const [k, v] of attempts)
        if (v.until < Date.now()) attempts.delete(k);
    throw new AppError(
      401,
      "INVALID_LOGIN",
      "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง",
    );
  }
  attempts.delete(key);
  const old = await currentIdentity(req);
  if (old)
    await change(
      pool,
      "UPDATE app_session SET revoked_at=NOW(6) WHERE session_id=? AND revoked_at IS NULL",
      [old.sessionId],
    );
  return issueSession(
    "EMPLOYEE",
    String(r.employee_id),
    null,
    new URL(req.url).protocol === "https:",
  );
}
export async function exchangeLink(data: unknown, req: Request) {
  const d = z.object({ token: z.string().min(32).max(128) }).parse(data);
  const r = await one(
    pool,
    "SELECT l.link_id FROM access_link l JOIN property_unit u ON u.unit_id=l.unit_id WHERE l.token=? AND l.revoked_at IS NULL AND l.expires_at>NOW(6) AND u.customer_id=l.customer_id",
    [digest(d.token)],
  );
  requireThat(r, "ลิงก์ไม่ถูกต้องหรือหมดอายุ กรุณาติดต่อฝ่ายขาย", 401);
  const old = await currentIdentity(req);
  if (old)
    await change(
      pool,
      "UPDATE app_session SET revoked_at=NOW(6) WHERE session_id=? AND revoked_at IS NULL",
      [old.sessionId],
    );
  return issueSession(
    "CUSTOMER",
    null,
    String(r.link_id),
    new URL(req.url).protocol === "https:",
  );
}
export async function logout(req: Request) {
  const id = await currentIdentity(req);
  if (id)
    await change(
      pool,
      "UPDATE app_session SET revoked_at=NOW(6) WHERE session_id=? AND revoked_at IS NULL",
      [id.sessionId],
    );
  return cookie("", new URL(req.url).protocol === "https:", 0);
}
export async function recheckIdentity(id: Identity, db: Db) {
  const r = await one(
    db,
    "SELECT session_id FROM app_session WHERE session_id=? AND revoked_at IS NULL AND expires_at>NOW(6) FOR UPDATE",
    [id.sessionId],
  );
  requireThat(r, "สิทธิ์เข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  if (id.kind === "EMPLOYEE") {
    const e = await one(
      db,
      "SELECT role,is_active,craft_category,must_change_password FROM employee WHERE employee_id=? FOR UPDATE",
      [id.employeeId],
    );
    requireThat(
      e &&
        e.is_active &&
        e.role === id.role &&
        e.craft_category === id.craft &&
        Boolean(e.must_change_password) === id.mustChangePassword,
      "สิทธิ์ผู้ใช้เปลี่ยนไป กรุณาเข้าสู่ระบบใหม่",
      401,
    );
  } else {
    const l = await one(
      db,
      "SELECT l.link_id FROM access_link l JOIN property_unit u ON u.unit_id=l.unit_id WHERE l.link_id=? AND l.revoked_at IS NULL AND l.expires_at>NOW(6) AND l.unit_id=? AND l.customer_id=? AND u.customer_id=l.customer_id FOR UPDATE",
      [id.linkId, id.unitId, id.customerId],
    );
    requireThat(l, "ลิงก์ไม่ถูกต้องหรือหมดอายุ", 401);
  }
}
export async function scopedUnit(
  id: Identity,
  unitId: string,
  db: Db = pool,
  lock = false,
) {
  if (id.kind === "CUSTOMER")
    requireThat(unitId === id.unitId, "ไม่พบข้อมูลบ้าน", 404);
  const r = await one(
    db,
    `SELECT * FROM property_unit WHERE unit_id=?${lock ? " FOR UPDATE" : ""}`,
    [unitId],
  );
  requireThat(r, "ไม่พบข้อมูลบ้าน", 404);
  if (lock)
    requireThat(
      !r.archived_at,
      "บ้านนี้เก็บเข้าคลังแล้ว เปิดข้อมูลจากทะเบียนก่อนทำงานต่อ",
    );
  return r;
}
export async function scopedDefect(
  id: Identity,
  defectId: string,
  db: Db = pool,
  lock = false,
) {
  const r = await one(
    db,
    `SELECT d.*,r.unit_id,r.round_type,r.status round_status,r.inspection_finished_at,r.inspector_id,u.archived_at FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id WHERE d.defect_id=?${lock ? " FOR UPDATE" : ""}`,
    [defectId],
  );
  requireThat(
    r && (id.kind !== "CUSTOMER" || r.unit_id === id.unitId),
    "ไม่พบข้อมูลจุดที่ต้องแก้ไข",
    404,
  );
  if (id.kind === "EMPLOYEE" && id.role === "TECHNICIAN")
    requireThat(
      r.category === id.craft &&
        (r.technician_id === null || r.technician_id === id.employeeId),
      "ไม่พบข้อมูลจุดที่ต้องแก้ไข",
      404,
    );
  if (lock) requireThat(!r.archived_at, "บ้านนี้เก็บเข้าคลังแล้ว");
  return r;
}
export function requireReady(id: Identity) {
  requireThat(
    id.kind !== "EMPLOYEE" || !id.mustChangePassword,
    "กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนเริ่มใช้งาน",
    409,
  );
}
export async function inspectors() {
  return rows(
    pool,
    "SELECT employee_id,full_name FROM employee WHERE role='INSPECTOR' AND is_active=1 ORDER BY full_name",
  );
}
