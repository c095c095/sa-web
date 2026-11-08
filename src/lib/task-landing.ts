// Visibility on the SCR-09 landing: the houses the SCR-09 screen can act on
// (workbench.tsx: bind form for READY_TO_SELL, re-issue for a bound customer
// that is not handed over). The server accepts the same houses (workflows.ts
// UC-09) and refuses the rest; test-task-landing T-LAND-17 calls UC-09 for every
// fixture house to prove the two agree. Which rows are the primary action is
// not decided here; that comes from journey.ts.
export function canIssueLink(unit: {
  status?: unknown;
  customer_id?: unknown;
}) {
  return (
    unit.status === "READY_TO_SELL" ||
    (Boolean(unit.customer_id) && unit.status !== "HANDED_OVER")
  );
}
import { type Workspace } from "./runtime-contracts";
import { thaiTime } from "./display-time";

export function taskContext(w: Workspace, screen: string) {
  const qc = w.rounds.find((round) => round.round_type === "QC_INTERNAL");
  const handover = w.rounds.find(
    (round) => round.round_type === "CUSTOMER_HANDOVER",
  );
  const request = w.requests[0];
  const count = (roundId: unknown, status?: string) =>
    w.defects.filter(
      (defect) =>
        defect.round_id === roundId && (!status || defect.status === status),
    ).length;
  switch (screen) {
    case "SCR-02":
      return qc && qc.status !== "CLOSED"
        ? `รอบ ${qc.round_id} · พบ ${count(qc.round_id)} จุด`
        : "รอเปิดรอบตรวจ";
    case "SCR-05":
      return `รอตรวจผลซ่อม ${count(qc?.round_id, "FIXED")} จุด`;
    case "SCR-06":
      return qc?.recheck_date
        ? `นัดตรวจซ้ำ ${thaiTime(qc.recheck_date)}`
        : "ยังไม่ได้กำหนดวันตรวจซ้ำ";
    case "SCR-07":
      return qc?.recheck_result === "NO_DEFECT"
        ? "ตรวจซ้ำแล้ว ไม่พบจุดที่ต้องแก้"
        : "รอผลตรวจซ้ำ";
    case "SCR-08":
      return qc?.closed_at
        ? `ปิดรอบ QC ${thaiTime(qc.closed_at)}`
        : "รอปิดรอบ QC";
    case "SCR-09":
      return w.unit?.customer_id ? "ผูกลูกค้าแล้ว" : "รอผูกลูกค้า";
    case "SCR-10":
      return request ? `มีคำขอตรวจ ${request.request_id}` : "ยังไม่มีคำขอตรวจ";
    case "SCR-11":
    case "SCR-12":
    case "SCR-13":
      return request?.appointment
        ? `นัดยืนยันแล้ว ${thaiTime(request.appointment)}`
        : request
          ? `วันที่ขอตรวจ ${thaiTime(request.preferred_date)}`
          : "ยังไม่มีวันขอตรวจ";
    case "SCR-14":
    case "SCR-16":
    case "SCR-17":
      return handover
        ? `รอบ ${handover.round_id} · แจ้งแล้ว ${count(handover.round_id)} จุด`
        : "ยังไม่มีรอบตรวจก่อนรับมอบ";
    case "SCR-18":
      return w.unit?.handed_over_at
        ? `รับมอบแล้ว ${thaiTime(w.unit.handed_over_at)}`
        : "ยังไม่มีบันทึกรับมอบ";
    default:
      return "";
  }
}
