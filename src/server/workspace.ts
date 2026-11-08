import "server-only";
import { type Identity, employee, scopedUnit, inspectors } from "./auth";
import { pool, rows, type Row } from "./db";
import { mediaKey } from "./media";
export async function workspace(id: Identity, requestedUnit?: string) {
  const values: (string | null)[] = [];
  let where = "";
  if (id.kind === "CUSTOMER") {
    where = "WHERE u.unit_id=? AND u.customer_id=?";
    values.push(id.unitId, id.customerId);
  } else if (id.role === "TECHNICIAN") {
    where =
      "WHERE EXISTS(SELECT 1 FROM inspection_round r JOIN defect d ON d.round_id=r.round_id WHERE r.unit_id=u.unit_id AND d.category=? AND (d.technician_id=? OR d.status='WAITING_ASSIGN'))";
    values.push(id.craft, id.employeeId);
  }
  const units = await rows(
    pool,
    `SELECT u.*,c.full_name customer_name FROM property_unit u LEFT JOIN customer c ON c.customer_id=u.customer_id ${where} ORDER BY u.created_at DESC,u.unit_id DESC`,
    values,
  );
  const unitId =
    requestedUnit ?? (units[0]?.unit_id ? String(units[0].unit_id) : "");
  if (unitId) await scopedUnit(id, unitId);
  const unit = units.find((u) => u.unit_id === unitId);
  const rounds = unit
    ? await rows(
        pool,
        "SELECT * FROM inspection_round WHERE unit_id=? ORDER BY started_at DESC,round_id DESC",
        [unitId],
      )
    : [];
  const defects = unit
    ? await rows(
        pool,
        "SELECT d.* FROM defect d JOIN inspection_round r ON r.round_id=d.round_id WHERE r.unit_id=? ORDER BY d.created_at,d.defect_id",
        [unitId],
      )
    : [];
  const visible = defects.filter(
    (d) =>
      id.kind !== "EMPLOYEE" ||
      id.role !== "TECHNICIAN" ||
      (d.category === id.craft &&
        (d.technician_id === null || d.technician_id === id.employeeId)),
  );
  const allFiles = unit
    ? await rows(
        pool,
        `SELECT f.* FROM file f LEFT JOIN defect d ON d.defect_id=f.defect_id LEFT JOIN inspection_round r ON r.round_id=d.round_id LEFT JOIN repair_report rp ON rp.report_id=f.report_id LEFT JOIN inspection_round rr ON rr.round_id=rp.round_id WHERE f.unit_id=? OR r.unit_id=? OR rr.unit_id=? ORDER BY f.uploaded_at`,
        [unitId, unitId, unitId],
      )
    : [];
  const files: (Row & { path: string })[] = allFiles
    .filter(
      (f) =>
        mediaKey(String(f.file_url)) &&
        (id.kind !== "EMPLOYEE" ||
          id.role !== "TECHNICIAN" ||
          visible.some((d) => d.defect_id === f.defect_id)),
    )
    .map((f) => ({ ...f, path: "/api/files/" + mediaKey(String(f.file_url)) }));
  let queue: Row[] = [],
    myJobs: Row[] = [],
    newDefects: Row[] = [];
  if (
    id.kind === "EMPLOYEE" &&
    ["TECHNICIAN", "HEAD_TECHNICIAN"].includes(id.role)
  ) {
    const e = employee(id, ["TECHNICIAN", "HEAD_TECHNICIAN"]);
    const condition = e.craft ? " AND d.category=?" : "";
    queue = await rows(
      pool,
      `SELECT d.*,r.unit_id,u.project_name,u.house_no FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id WHERE d.status='WAITING_ASSIGN'${condition} ORDER BY d.created_at`,
      e.craft ? [e.craft] : [],
    );
    myJobs = await rows(
      pool,
      "SELECT d.*,r.unit_id,u.project_name,u.house_no FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id WHERE d.technician_id=? AND d.status IN ('ASSIGNED','REWORK') ORDER BY d.assigned_date",
      [e.employeeId],
    );
    if (e.role === "HEAD_TECHNICIAN")
      newDefects = await rows(
        pool,
        "SELECT d.*,r.unit_id,u.house_no,u.project_name FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id WHERE d.status='NEW' ORDER BY d.created_at",
      );
    const relevant = [
      ...new Set(
        [...queue, ...myJobs, ...newDefects].map((d) => String(d.defect_id)),
      ),
    ];
    if (relevant.length) {
      const extra = await rows(
        pool,
        `SELECT * FROM file WHERE defect_id IN (${relevant.map(() => "?").join(",")})`,
        relevant,
      );
      for (const f of extra) {
        const key = mediaKey(String(f.file_url));
        if (key && !files.some((old) => old.file_id === f.file_id))
          files.push({ ...f, path: "/api/files/" + key });
      }
    }
  }
  return {
    units,
    unit: unit ?? null,
    rounds,
    defects: visible,
    files,
    requests: unit
      ? await rows(
          pool,
          "SELECT * FROM inspection_request WHERE unit_id=? ORDER BY created_at DESC",
          [unitId],
        )
      : [],
    reports: unit
      ? await rows(
          pool,
          "SELECT rp.* FROM repair_report rp JOIN inspection_round r ON r.round_id=rp.round_id WHERE r.unit_id=? ORDER BY rp.created_at DESC",
          [unitId],
        )
      : [],
    queue,
    myJobs,
    newDefects,
    inspectors:
      id.kind === "EMPLOYEE" && id.role === "INSPECTOR"
        ? await inspectors()
        : [],
  };
}
