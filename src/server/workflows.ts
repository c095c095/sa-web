import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import sharp from "sharp";
import {
  type Identity,
  employee,
  customer,
  scopedUnit,
  scopedDefect,
  recheckIdentity,
  digest,
} from "./auth";
import { transact, one, rows, change, type Tx } from "./db";
import { requireThat, AppError } from "./errors";
import {
  type Media,
  imageUploads,
  attach,
  cleanup,
  repairPdf,
  fileRows,
  mediaKey,
  mediaPath,
} from "./media";
const text = (d: Record<string, unknown>, key: string, max = 100) =>
  z
    .object({
      [key]: z
        .string()
        .trim()
        .min(1, "กรุณากรอกข้อมูล")
        .max(max, `ต้องไม่เกิน ${max} ตัวอักษร`),
    })
    .parse(d)[key];
const optional = (d: Record<string, unknown>, key: string, max = 100) =>
  d[key] === undefined || d[key] === null || d[key] === ""
    ? null
    : text(d, key, max);
const code = (d: Record<string, unknown>, key: string) =>
  z
    .string()
    .regex(/^[A-Z0-9]{1,12}$/, `รหัส ${key} ไม่ถูกต้อง`)
    .parse(d[key]);
const category = (d: Record<string, unknown>) =>
  z
    .enum(["CEILING", "ELECTRICAL", "PLUMBING", "WALL", "FLOOR", "DOOR_WINDOW"])
    .parse(d.category);
const ids = (d: Record<string, unknown>) => {
  const list = z
    .array(z.string().regex(/^[A-Z0-9]{1,12}$/))
    .min(1)
    .max(100)
    .parse(d.defect_ids);
  requireThat(new Set(list).size === list.length, "รายการซ้ำกัน", 422);
  return list.sort();
};
function date(d: Record<string, unknown>, key: string) {
  const v = z
    .string()
    .regex(/^\d{4}-\d\d-\d\d$/, "กรุณาระบุวันที่")
    .parse(d[key]);
  requireThat(
    !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
      new Date(v + "T00:00:00Z").toISOString().startsWith(v),
    "วันที่ไม่ถูกต้อง",
    422,
  );
  return v;
}
function utc(d: Record<string, unknown>, key: string) {
  return new Date(z.string().datetime({ offset: true }).parse(d[key]))
    .toISOString()
    .slice(0, 23)
    .replace("T", " ");
}
async function round(tx: Tx, id: Identity, roundId: string) {
  const r = await one(
    tx.db,
    "SELECT * FROM inspection_round WHERE round_id=? FOR UPDATE",
    [roundId],
  );
  requireThat(r, "ไม่พบรอบตรวจ", 404);
  await scopedUnit(id, String(r.unit_id), tx.db, true);
  return r;
}
async function qc(tx: Tx, id: Identity, unitId: string) {
  const e = employee(id, ["INSPECTOR"]);
  const u = await scopedUnit(id, unitId, tx.db, true);
  requireThat(u.status === "IN_QC", "บ้านไม่ได้อยู่ระหว่างตรวจ QC");
  let r = await one(
    tx.db,
    "SELECT * FROM inspection_round WHERE unit_id=? AND round_type='QC_INTERNAL' AND status<>'CLOSED' FOR UPDATE",
    [unitId],
  );
  if (!r)
    r = await one(
      tx.db,
      "INSERT INTO inspection_round(unit_id,round_type,inspector_id) VALUES(?,'QC_INTERNAL',?) RETURNING *",
      [unitId, e.employeeId],
    );
  requireThat(r?.status === "OPEN", "รอบนี้ไม่ได้เปิดให้บันทึกการตรวจ");
  return r;
}
async function handoverRound(tx: Tx, id: Identity) {
  const c = customer(id);
  await scopedUnit(id, c.unitId, tx.db, true);
  const r = await one(
    tx.db,
    "SELECT * FROM inspection_round WHERE unit_id=? AND round_type='CUSTOMER_HANDOVER' AND status='OPEN' FOR UPDATE",
    [c.unitId],
  );
  requireThat(r, "ไม่มีรอบตรวจก่อนรับมอบที่เปิดอยู่");
  return r;
}
async function attachAll(
  tx: Tx,
  media: Media[],
  owner: { defect_id?: string; unit_id?: string; report_id?: string },
  usage: "BEFORE_FIX" | "AFTER_FIX" | "SIGNATURE" | "SUMMARY_PDF",
) {
  for (const m of media) await attach(tx, m, owner, usage);
}
async function ready(tx: Tx, roundId: string, states: string[]) {
  const defs = await rows(
    tx.db,
    "SELECT * FROM defect WHERE round_id=? FOR UPDATE",
    [roundId],
  );
  requireThat(
    defs.every((d) => states.includes(String(d.status))),
    "ยังมีจุดที่ไม่ผ่านเงื่อนไข กรุณาโหลดรายการใหม่",
  );
  return defs;
}
const roles: Record<
  string,
  ("SALES" | "INSPECTOR" | "TECHNICIAN" | "HEAD_TECHNICIAN" | "CUSTOMER")[]
> = {
  "UC-01": ["SALES"],
  "UC-02": ["INSPECTOR"],
  "UC-03": ["TECHNICIAN", "HEAD_TECHNICIAN"],
  "UC-04": ["TECHNICIAN", "HEAD_TECHNICIAN"],
  "UC-05": ["INSPECTOR"],
  "UC-06": ["INSPECTOR"],
  "UC-07": ["INSPECTOR"],
  "UC-08": ["INSPECTOR"],
  "UC-09": ["SALES"],
  "UC-10": ["CUSTOMER"],
  "UC-11": ["CUSTOMER"],
  "UC-12": ["SALES"],
  "UC-13": ["SALES"],
  "UC-14": ["CUSTOMER"],
  "UC-15": ["HEAD_TECHNICIAN"],
  "UC-16": ["INSPECTOR"],
  "UC-17": ["CUSTOMER"],
  "UC-18": ["CUSTOMER"],
};
export async function executeUc(
  uc: string,
  d: Record<string, unknown>,
  files: File[],
  id: Identity,
) {
  const allowed = roles[uc];
  requireThat(allowed, "ไม่พบการทำงาน", 404);
  requireThat(
    allowed.includes(id.kind === "CUSTOMER" ? "CUSTOMER" : id.role),
    "คุณไม่มีสิทธิ์ทำงานนี้",
    403,
  );
  if (
    uc === "UC-18" &&
    files.length === 1 &&
    files[0].size <= 5 * 1024 * 1024
  ) {
    try {
      const stats = await sharp(Buffer.from(await files[0].arrayBuffer()), {
        limitInputPixels: 25_000_000,
      }).stats();
      requireThat(
        stats.channels.some((c) => c.stdev > 1),
        "กรุณาแนบลายเซ็นที่มีรอยเขียน",
        422,
      );
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(422, "INVALID_SIGNATURE", "อ่านรูปลายเซ็นไม่ได้");
    }
  }
  const needsPhotos = ["UC-04", "UC-14", "UC-18"].includes(uc);
  const uploads = await imageUploads(files, needsPhotos);
  const staged = [...uploads];
  try {
    return await transact(async (tx) => {
      await recheckIdentity(id, tx.db);
      switch (uc) {
        case "UC-01": {
          const e = employee(id, ["SALES"]);
          const u = await one(
            tx.db,
            "INSERT INTO property_unit(project_name,house_no,unit_type,registered_by) VALUES(?,?,?,?) RETURNING unit_id,status",
            [
              text(d, "project_name"),
              text(d, "house_no", 20),
              optional(d, "unit_type", 50),
              e.employeeId,
            ],
          );
          return { message: "ลงทะเบียนบ้านแล้ว", ...u };
        }
        case "UC-02": {
          const e = employee(id, ["INSPECTOR"]);
          const mode = z
            .enum(["add", "edit", "delete", "remove-photo", "finish"])
            .parse(d.mode);
          if (mode === "add" || mode === "finish") {
            const r = await qc(tx, id, code(d, "unit_id"));
            requireThat(
              !r.inspection_finished_at,
              "รอบนี้กดเสร็จสิ้นการตรวจแล้ว แก้ไขรายการเดิมไม่ได้",
            );
            if (mode === "finish") {
              await change(
                tx.db,
                "UPDATE inspection_round SET inspection_finished_at=NOW(6) WHERE round_id=? AND inspection_finished_at IS NULL AND status='OPEN'",
                [r.round_id],
              );
              const [{ n }] = await rows(
                tx.db,
                "SELECT COUNT(*) n FROM defect WHERE round_id=?",
                [r.round_id],
              );
              return {
                message: "บันทึกเสร็จสิ้นการตรวจแล้ว",
                round_id: r.round_id,
                defect_count: n,
              };
            }
            const item = await one(
              tx.db,
              "INSERT INTO defect(round_id,category,location_pin,description,status,reported_by_type,reported_by_employee) VALUES(?,?,?,?,'WAITING_ASSIGN','INSPECTOR',?) RETURNING defect_id",
              [
                r.round_id,
                category(d),
                text(d, "location_pin"),
                optional(d, "description", 10000),
                e.employeeId,
              ],
            );
            await attachAll(
              tx,
              uploads,
              { defect_id: String(item.defect_id) },
              "BEFORE_FIX",
            );
            return { message: "บันทึกจุดที่ต้องแก้ไขแล้ว", ...item };
          }
          const def = await scopedDefect(id, code(d, "defect_id"), tx.db, true);
          requireThat(
            def.round_type === "QC_INTERNAL" &&
              def.round_status === "OPEN" &&
              !def.inspection_finished_at &&
              def.status === "WAITING_ASSIGN",
            "แก้ไขได้เฉพาะจุดรอช่างรับ ก่อนเสร็จสิ้นการตรวจ",
          );
          if (mode === "edit") {
            await change(
              tx.db,
              "UPDATE defect SET category=?,location_pin=?,description=? WHERE defect_id=? AND status='WAITING_ASSIGN'",
              [
                category(d),
                text(d, "location_pin"),
                optional(d, "description", 10000),
                def.defect_id,
              ],
            );
            await attachAll(
              tx,
              uploads,
              { defect_id: String(def.defect_id) },
              "BEFORE_FIX",
            );
          } else if (mode === "remove-photo") {
            const f = await one(
              tx.db,
              "SELECT * FROM file WHERE file_id=? AND defect_id=? AND file_usage='BEFORE_FIX' FOR UPDATE",
              [code(d, "file_id"), def.defect_id],
            );
            requireThat(f, "ไม่พบรูป", 404);
            await change(tx.db, "DELETE FROM file WHERE file_id=?", [
              f.file_id,
            ]);
            const key = mediaKey(String(f.file_url));
            if (key) tx.removedFiles.push(mediaPath(key));
          } else {
            const pictures = await rows(
              tx.db,
              "SELECT file_url FROM file WHERE defect_id=?",
              [def.defect_id],
            );
            await change(
              tx.db,
              "DELETE FROM defect WHERE defect_id=? AND status='WAITING_ASSIGN'",
              [def.defect_id],
            );
            for (const f of pictures) {
              const key = mediaKey(String(f.file_url));
              if (key) tx.removedFiles.push(mediaPath(key));
            }
          }
          return { message: mode === "edit" ? "แก้ไขจุดแล้ว" : "ลบรายการแล้ว" };
        }
        case "UC-03": {
          const e = employee(id, ["TECHNICIAN", "HEAD_TECHNICIAN"]);
          for (const key of ids(d)) {
            const def = await scopedDefect(id, key, tx.db, true);
            requireThat(
              def.status === "WAITING_ASSIGN" &&
                (!e.craft || e.craft === def.category),
              "งานนี้รับไปแล้วหรือประเภทไม่ตรงกับสิทธิ์ของคุณ",
            );
            requireThat(def.round_status !== "CLOSED", "รอบตรวจนี้ปิดแล้ว");
            const n = await change(
              tx.db,
              "UPDATE defect SET technician_id=?,status='ASSIGNED',assigned_date=NOW(6) WHERE defect_id=? AND status='WAITING_ASSIGN'",
              [e.employeeId, key],
            );
            requireThat(n === 1, "งานนี้ถูกผู้อื่นรับแล้ว");
          }
          return { message: "รับงานซ่อมแล้ว" };
        }
        case "UC-04": {
          const e = employee(id, ["TECHNICIAN", "HEAD_TECHNICIAN"]);
          const def = await scopedDefect(id, code(d, "defect_id"), tx.db, true);
          requireThat(
            def.technician_id === e.employeeId &&
              ["ASSIGNED", "REWORK"].includes(String(def.status)) &&
              def.round_status !== "CLOSED",
            "ซ่อมได้เฉพาะงานที่คุณรับไว้และยังไม่ปิดรอบ",
          );
          await attachAll(
            tx,
            uploads,
            { defect_id: String(def.defect_id) },
            "AFTER_FIX",
          );
          const r = await one(
            tx.db,
            "SELECT COUNT(*) n FROM file WHERE defect_id=? AND file_usage='AFTER_FIX' AND uploaded_at>COALESCE(?, '1000-01-01 00:00:00')",
            [def.defect_id, def.completed_date],
          );
          requireThat(
            Number(r.n) > 0,
            "ต้องมีรูปหลังซ่อมของรอบซ่อมล่าสุดอย่างน้อย 1 รูป",
            422,
          );
          await change(
            tx.db,
            "UPDATE defect SET status='FIXED',completed_date=NOW(6) WHERE defect_id=? AND technician_id=? AND status IN ('ASSIGNED','REWORK')",
            [def.defect_id, e.employeeId],
          );
          return { message: "บันทึกซ่อมเสร็จพร้อมรูปแล้ว" };
        }
        case "UC-05": {
          const e = employee(id, ["INSPECTOR"]);
          const def = await scopedDefect(id, code(d, "defect_id"), tx.db, true);
          requireThat(
            def.status === "FIXED" &&
              def.round_type === "QC_INTERNAL" &&
              def.round_status === "OPEN",
            "ตรวจอนุมัติได้เฉพาะงานซ่อมเสร็จในรอบ QC ที่เปิดอยู่",
          );
          if (z.boolean().parse(d.approve))
            await change(
              tx.db,
              "UPDATE defect SET status='VERIFIED',verified_by=?,verified_at=NOW(6) WHERE defect_id=? AND status='FIXED'",
              [e.employeeId, def.defect_id],
            );
          else
            await change(
              tx.db,
              "UPDATE defect SET status='REWORK',rework_count=rework_count+1 WHERE defect_id=? AND status='FIXED'",
              [def.defect_id],
            );
          return {
            message: d.approve
              ? "อนุมัติงานซ่อมแล้ว"
              : "ส่งกลับให้ช่างแก้ไขแล้ว",
          };
        }
        case "UC-06": {
          employee(id, ["INSPECTOR"]);
          const r = await round(tx, id, code(d, "round_id"));
          requireThat(r.round_type === "QC_INTERNAL", "ใช้ได้เฉพาะรอบ QC");
          const mode = z.enum(["schedule", "result"]).parse(d.mode);
          if (mode === "schedule") {
            requireThat(
              r.status === "OPEN",
              "รอบนี้นัดตรวจซ้ำแล้วหรือปิดไปแล้ว",
            );
            await ready(tx, String(r.round_id), ["VERIFIED"]);
            await change(
              tx.db,
              "UPDATE inspection_round SET status='RECHECK_SCHEDULED',recheck_date=?,recheck_result=NULL WHERE round_id=? AND status='OPEN'",
              [date(d, "recheck_date"), r.round_id],
            );
            return { message: "นัดตรวจซ้ำแล้ว" };
          }
          requireThat(
            r.status === "RECHECK_SCHEDULED",
            "ยังไม่ถึงขั้นบันทึกผลตรวจซ้ำ",
          );
          const result = z
            .enum(["NO_DEFECT", "DEFECT_FOUND"])
            .parse(d.recheck_result);
          if (result === "NO_DEFECT") {
            await change(
              tx.db,
              "UPDATE inspection_round SET recheck_result='NO_DEFECT' WHERE round_id=? AND status='RECHECK_SCHEDULED'",
              [r.round_id],
            );
            return { message: "บันทึกผลไม่พบจุดที่ต้องแก้ไขแล้ว" };
          }
          const e = employee(id, ["INSPECTOR"]);
          const item = await one(
            tx.db,
            "INSERT INTO defect(round_id,category,location_pin,description,status,reported_by_type,reported_by_employee) VALUES(?,?,?,?,'WAITING_ASSIGN','INSPECTOR',?) RETURNING defect_id",
            [
              r.round_id,
              category(d),
              text(d, "location_pin"),
              optional(d, "description", 10000),
              e.employeeId,
            ],
          );
          await attachAll(
            tx,
            uploads,
            { defect_id: String(item.defect_id) },
            "BEFORE_FIX",
          );
          await change(
            tx.db,
            "UPDATE inspection_round SET status='OPEN',recheck_result=NULL,recheck_date=NULL WHERE round_id=? AND status='RECHECK_SCHEDULED'",
            [r.round_id],
          );
          return { message: "บันทึกจุดใหม่และเปิดรอบให้ซ่อมต่อแล้ว", ...item };
        }
        case "UC-07": {
          employee(id, ["INSPECTOR"]);
          const r = await round(tx, id, code(d, "round_id"));
          requireThat(
            r.round_type === "QC_INTERNAL" &&
              r.status === "RECHECK_SCHEDULED" &&
              r.recheck_result === "NO_DEFECT",
            "ปิดรอบได้หลังตรวจซ้ำแล้วไม่พบจุดที่ต้องแก้ไข",
          );
          await ready(tx, String(r.round_id), ["VERIFIED"]);
          const single = z.boolean().parse(d.is_single_certify);
          const co = optional(d, "co_inspector_id", 12);
          requireThat(
            Boolean(co) !== single,
            "เลือกผู้ตรวจร่วม หรือยืนยันคนเดียว อย่างใดอย่างหนึ่ง",
            422,
          );
          if (co) {
            const p = await one(
              tx.db,
              "SELECT employee_id FROM employee WHERE employee_id=? AND role='INSPECTOR' AND is_active=1 AND employee_id<>?",
              [co, r.inspector_id],
            );
            requireThat(
              p,
              "ผู้ตรวจร่วมต้องเป็นฝ่ายตรวจบ้านอีกคนที่เปิดใช้งานอยู่",
              422,
            );
          }
          await change(
            tx.db,
            "UPDATE inspection_round SET status='CLOSED',closed_at=NOW(6),is_single_certify=?,co_inspector_id=? WHERE round_id=? AND status='RECHECK_SCHEDULED' AND recheck_result='NO_DEFECT'",
            [single ? 1 : 0, co, r.round_id],
          );
          return { message: "ปิดรอบ QC แล้ว" };
        }
        case "UC-08": {
          employee(id, ["INSPECTOR"]);
          const u = await scopedUnit(id, code(d, "unit_id"), tx.db, true);
          const r = await one(
            tx.db,
            "SELECT round_id FROM inspection_round WHERE unit_id=? AND round_type='QC_INTERNAL' AND status='CLOSED' LIMIT 1",
            [u.unit_id],
          );
          requireThat(
            u.status === "IN_QC" && r,
            "บ้านต้องผ่านและปิดรอบ QC ก่อนแจ้งพร้อมขาย",
          );
          await change(
            tx.db,
            "UPDATE property_unit SET status='READY_TO_SELL' WHERE unit_id=? AND status='IN_QC'",
            [u.unit_id],
          );
          return { message: "แจ้งฝ่ายขายว่าบ้านพร้อมขายแล้ว" };
        }
        case "UC-09": {
          const e = employee(id, ["SALES"]);
          const u = await scopedUnit(id, code(d, "unit_id"), tx.db, true);
          requireThat(
            [
              "READY_TO_SELL",
              "CONTRACTED",
              "WAITING_INSPECTION",
              "IN_INSPECTION",
              "READY_HANDOVER",
            ].includes(String(u.status)),
            "บ้านยังไม่พร้อมผูกลูกค้าหรือออกลิงก์",
          );
          let customerId = u.customer_id;
          if (u.status === "READY_TO_SELL") {
            const card = z
              .string()
              .regex(/^\d{13}$/, "เลขประจำตัวต้องเป็นตัวเลข 13 หลัก")
              .parse(d.id_card_no);
            let c = await one(
              tx.db,
              "SELECT customer_id FROM customer WHERE id_card_no=?",
              [card],
            );
            if (!c)
              c = await one(
                tx.db,
                "INSERT INTO customer(id_card_no,full_name,phone_number,email) VALUES(?,?,?,?) RETURNING customer_id",
                [
                  card,
                  text(d, "full_name"),
                  z
                    .string()
                    .regex(/^0\d{8,9}$/, "เบอร์โทรไม่ถูกต้อง")
                    .parse(d.phone_number),
                  d.email ? z.email().max(100).parse(d.email) : null,
                ],
              );
            customerId = c.customer_id;
            await change(
              tx.db,
              "UPDATE property_unit SET customer_id=?,status='CONTRACTED' WHERE unit_id=? AND status='READY_TO_SELL'",
              [customerId, u.unit_id],
            );
          }
          requireThat(customerId, "ยังไม่มีลูกค้าที่ผูกกับบ้าน");
          const token = randomBytes(32).toString("base64url");
          const l = await one(
            tx.db,
            "INSERT INTO access_link(unit_id,customer_id,token,expires_at,created_by,created_at) VALUES(?,?,?,DATE_ADD(NOW(6),INTERVAL 30 DAY),?,NOW(6)) RETURNING link_id,expires_at",
            [u.unit_id, customerId, digest(token), e.employeeId],
          );
          return {
            message: "สร้างลิงก์แล้ว คัดลอกส่งให้ลูกค้าได้ ลิงก์มีอายุ 30 วัน",
            ...l,
            url:
              (process.env.APP_URL ?? "http://localhost:3000") +
              "/access#token=" +
              token,
          };
        }
        case "UC-10": {
          const c = customer(id);
          const u = await scopedUnit(id, c.unitId, tx.db, true);
          requireThat(
            u.status === "CONTRACTED",
            "บ้านนี้ตอบความต้องการตรวจแล้ว",
          );
          requireThat(
            d.wants_inspection === false,
            "กรุณาใช้แบบฟอร์มยื่นคำขอตรวจ",
            422,
          );
          await change(
            tx.db,
            "UPDATE property_unit SET status='READY_HANDOVER' WHERE unit_id=? AND status='CONTRACTED'",
            [u.unit_id],
          );
          return {
            message: "บันทึกไม่ต้องการตรวจก่อนรับมอบแล้ว สามารถเซ็นรับมอบได้",
          };
        }
        case "UC-11":
        case "UC-12": {
          const c = uc === "UC-11" ? customer(id) : null;
          const sales = uc === "UC-12" ? employee(id, ["SALES"]) : null;
          const u = await scopedUnit(
            id,
            c ? c.unitId : code(d, "unit_id"),
            tx.db,
            true,
          );
          requireThat(
            u.status === "CONTRACTED" && u.customer_id,
            "บ้านต้องทำสัญญาและผูกลูกค้าก่อนยื่นคำขอ",
          );
          const req = await one(
            tx.db,
            "INSERT INTO inspection_request(unit_id,customer_id,requested_by,preferred_date) VALUES(?,?,?,?) RETURNING request_id,status",
            [
              u.unit_id,
              u.customer_id,
              sales?.employeeId ?? null,
              date(d, "preferred_date"),
            ],
          );
          await change(
            tx.db,
            "UPDATE property_unit SET status='WAITING_INSPECTION' WHERE unit_id=? AND status='CONTRACTED'",
            [u.unit_id],
          );
          return { message: "ยื่นคำขอตรวจบ้านแล้ว", ...req };
        }
        case "UC-13": {
          employee(id, ["SALES"]);
          const r = await one(
            tx.db,
            "SELECT * FROM inspection_request WHERE request_id=? FOR UPDATE",
            [code(d, "request_id")],
          );
          requireThat(r, "ไม่พบคำขอตรวจ", 404);
          const u = await scopedUnit(id, String(r.unit_id), tx.db, true);
          requireThat(
            r.status === "SUBMITTED" && u.status === "WAITING_INSPECTION",
            "คำขอนี้เริ่มตรวจแล้วหรือปิดไปแล้ว",
          );
          if (d.mode === "appointment") {
            await change(
              tx.db,
              "UPDATE inspection_request SET appointment=? WHERE request_id=? AND status='SUBMITTED'",
              [utc(d, "appointment"), r.request_id],
            );
            return { message: "บันทึกหรือเลื่อนนัดในคำขอเดิมแล้ว" };
          }
          requireThat(d.mode === "arrival", "คำสั่งไม่ถูกต้อง", 422);
          requireThat(r.appointment, "กรุณากำหนดนัดก่อนบันทึกการมาถึง");
          await change(
            tx.db,
            "UPDATE inspection_request SET arrival=NOW(6),status='IN_PROGRESS' WHERE request_id=? AND status='SUBMITTED'",
            [r.request_id],
          );
          const opened = await one(
            tx.db,
            "INSERT INTO inspection_round(unit_id,round_type,request_id) VALUES(?,'CUSTOMER_HANDOVER',?) RETURNING round_id",
            [u.unit_id, r.request_id],
          );
          await change(
            tx.db,
            "UPDATE property_unit SET status='IN_INSPECTION' WHERE unit_id=? AND status='WAITING_INSPECTION'",
            [u.unit_id],
          );
          return { message: "บันทึกลูกค้ามาถึงและเปิดรอบตรวจแล้ว", ...opened };
        }
        case "UC-14": {
          const r = await handoverRound(tx, id);
          const reporter = z
            .enum(["CUSTOMER", "EXTERNAL"])
            .parse(d.reported_by_type);
          const def = await one(
            tx.db,
            "INSERT INTO defect(round_id,location_pin,description,status,reported_by_type) VALUES(?,?,?,'NEW',?) RETURNING defect_id",
            [
              r.round_id,
              text(d, "location_pin"),
              optional(d, "description", 10000),
              reporter,
            ],
          );
          await attachAll(
            tx,
            uploads,
            { defect_id: String(def.defect_id) },
            "BEFORE_FIX",
          );
          return { message: "แจ้งจุดที่ต้องแก้ไขแล้ว", ...def };
        }
        case "UC-15": {
          const e = employee(id, ["HEAD_TECHNICIAN"]);
          const def = await scopedDefect(id, code(d, "defect_id"), tx.db, true);
          requireThat(
            def.status === "NEW" && def.round_status === "OPEN",
            "แยกประเภทได้เฉพาะจุดใหม่ในรอบที่เปิดอยู่",
          );
          await change(
            tx.db,
            "UPDATE defect SET category=?,target_date=?,assigned_by=?,status='WAITING_ASSIGN' WHERE defect_id=? AND status='NEW'",
            [
              category(d),
              d.target_date ? date(d, "target_date") : null,
              e.employeeId,
              def.defect_id,
            ],
          );
          return { message: "แยกประเภทและส่งเข้าคิวงานแล้ว" };
        }
        case "UC-16": {
          const e = employee(id, ["INSPECTOR"]);
          const r = await round(tx, id, code(d, "round_id"));
          requireThat(
            r.round_type === "CUSTOMER_HANDOVER" && r.status === "OPEN",
            "เลือกได้เฉพาะรอบตรวจก่อนรับมอบที่เปิดอยู่",
          );
          const defs = await ready(tx, String(r.round_id), [
            "FIXED",
            "VERIFIED",
          ]);
          requireThat(defs.length, "ยังไม่มีจุดที่ใช้สรุปการซ่อม");
          const u = await scopedUnit(id, String(r.unit_id), tx.db);
          const title = text(d, "title");
          const pdf = await repairPdf(
            u,
            r,
            defs,
            await fileRows(tx.db, String(r.round_id)),
            title,
          );
          staged.push(pdf);
          const report = await one(
            tx.db,
            "INSERT INTO repair_report(round_id,created_by,title) VALUES(?,?,?) RETURNING report_id",
            [r.round_id, e.employeeId, title],
          );
          const f = await attach(
            tx,
            pdf,
            { report_id: String(report.report_id) },
            "SUMMARY_PDF",
          );
          return {
            message: "ออกเอกสารสรุปการซ่อมแล้ว",
            ...report,
            path: "/api/files/" + mediaKey(String(f.file_url)),
          };
        }
        case "UC-17": {
          const c = customer(id);
          const r = await handoverRound(tx, id);
          const req = await one(
            tx.db,
            "SELECT * FROM inspection_request WHERE request_id=? FOR UPDATE",
            [r.request_id],
          );
          const u = await scopedUnit(id, c.unitId, tx.db, true);
          requireThat(
            req?.status === "IN_PROGRESS" && u.status === "IN_INSPECTION",
            "ยังไม่อยู่ในขั้นตรวจยอมรับสภาพ",
          );
          if (d.accept === false) {
            const reason = text(d, "accept_reason", 10000);
            const selected = d.defect_ids
              ? z.array(z.string()).max(100).parse(d.defect_ids)
              : [];
            requireThat(
              new Set(selected).size === selected.length,
              "รายการซ้ำกัน",
              422,
            );
            for (const key of selected.sort()) {
              const def = await scopedDefect(id, key, tx.db, true);
              requireThat(
                def.round_id === r.round_id && def.status === "FIXED",
                "เลือกไม่ผ่านได้เฉพาะจุดซ่อมเสร็จในรอบนี้",
              );
              await change(
                tx.db,
                "UPDATE defect SET status='REWORK',rework_count=rework_count+1 WHERE defect_id=? AND round_id=? AND status='FIXED'",
                [key, r.round_id],
              );
            }
            await change(
              tx.db,
              "UPDATE inspection_request SET accept_result='REJECTED',accept_reason=? WHERE request_id=? AND status='IN_PROGRESS'",
              [reason, req.request_id],
            );
            return { message: "บันทึกไม่ผ่านและส่งจุดที่เลือกกลับแก้แล้ว" };
          }
          requireThat(d.accept === true, "กรุณาระบุผลการยอมรับ", 422);
          await ready(tx, String(r.round_id), ["FIXED", "VERIFIED"]);
          await change(
            tx.db,
            "UPDATE defect SET status='VERIFIED',verified_at=NOW(6) WHERE round_id=? AND status='FIXED'",
            [r.round_id],
          );
          await change(
            tx.db,
            "UPDATE inspection_request SET status='COMPLETED',accept_result='ACCEPTED',accepted_at=NOW(6) WHERE request_id=? AND status='IN_PROGRESS'",
            [req.request_id],
          );
          await change(
            tx.db,
            "UPDATE inspection_round SET status='CLOSED',closed_at=NOW(6) WHERE round_id=? AND status='OPEN'",
            [r.round_id],
          );
          await change(
            tx.db,
            "UPDATE property_unit SET status='READY_HANDOVER' WHERE unit_id=? AND status='IN_INSPECTION'",
            [c.unitId],
          );
          return { message: "ยืนยันยอมรับสภาพแล้ว สามารถเซ็นรับมอบได้" };
        }
        case "UC-18": {
          const c = customer(id);
          const u = await scopedUnit(id, c.unitId, tx.db, true);
          if (u.status === "HANDED_OVER")
            return { message: "บ้านนี้เซ็นรับมอบไว้แล้ว" };
          requireThat(u.status === "READY_HANDOVER", "บ้านยังไม่พร้อมรับมอบ");
          requireThat(uploads.length === 1, "แนบลายเซ็นเพียง 1 รูป", 422);
          const f = await attach(
            tx,
            uploads[0],
            { unit_id: c.unitId },
            "SIGNATURE",
          );
          await change(
            tx.db,
            "UPDATE property_unit SET status='HANDED_OVER',handed_over_at=NOW(6) WHERE unit_id=? AND status='READY_HANDOVER'",
            [c.unitId],
          );
          return {
            message: "บันทึกเซ็นรับมอบบ้านแล้ว",
            path: "/api/files/" + mediaKey(String(f.file_url)),
          };
        }
        default:
          throw new AppError(404, "NOT_FOUND", "ไม่พบการทำงาน");
      }
    });
  } finally {
    await cleanup(staged);
  }
}
