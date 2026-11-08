import { workflowPath } from "./routes";
import { type Workspace } from "./runtime-contracts";
export type Task = {
  screen: string;
  title: string;
  hint: string;
  defect?: string;
};
export function taskUrl(t: Task, unit: string, q?: string) {
  return workflowPath(t.screen, unit, t.defect, q);
}
export function journey(w: Workspace) {
  const role = w.identity.kind === "CUSTOMER" ? "CUSTOMER" : w.identity.role,
    u = w.unit,
    actions: Task[] = [];
  let waiting = "เลือกบ้านเพื่อดูงานที่ต้องทำ",
    stage = 0;
  if (!u) return { actions, waiting, stage };
  const unit = String(u.unit_id),
    qc = w.rounds.find(
      (r) => r.round_type === "QC_INTERNAL" && r.status !== "CLOSED",
    ),
    hand = w.rounds.find(
      (r) => r.round_type === "CUSTOMER_HANDOVER" && r.status === "OPEN",
    ),
    qcDefs = w.defects.filter((d) => d.round_id === qc?.round_id),
    defs = w.defects.filter((d) => d.round_id === hand?.round_id);
  const add = (screen: string, title: string, hint: string, defect?: string) =>
    actions.push({ screen, title, hint, defect });
  const stages: Record<string, number> = {
    IN_QC: 0,
    READY_TO_SELL: 1,
    CONTRACTED: 2,
    WAITING_INSPECTION: 3,
    IN_INSPECTION: 4,
    READY_HANDOVER: 5,
    HANDED_OVER: 6,
  };
  stage = stages[String(u.status)] ?? 0;
  switch (u.status) {
    case "IN_QC":
      waiting = "รอฝ่ายตรวจบ้านตรวจ QC และตรวจงานซ่อม";
      if (role === "INSPECTOR") {
        if (!qc) {
          if (
            w.rounds.some(
              (r) => r.round_type === "QC_INTERNAL" && r.status === "CLOSED",
            )
          )
            add(
              "SCR-08",
              "แจ้งบ้านพร้อมขาย",
              "รอบ QC ปิดแล้ว ส่งต่อให้ฝ่ายขายได้",
            );
          else
            add(
              "SCR-02",
              "เริ่มตรวจ QC",
              "บันทึกจุดที่พบ แล้วกดเสร็จสิ้นการตรวจเมื่อครบ",
            );
        } else if (qc.status === "RECHECK_SCHEDULED") {
          if (qc.recheck_result === "NO_DEFECT")
            add(
              "SCR-07",
              "รับรองและปิดรอบ QC",
              "ผลตรวจซ้ำไม่พบจุดที่ต้องแก้ไขแล้ว",
            );
          else
            add("SCR-06", "บันทึกผลตรวจซ้ำ", "ตรวจหน้างานตามนัดแล้วบันทึกผล");
        } else {
          const fixed = qcDefs.filter((d) => d.status === "FIXED");
          if (fixed.length)
            add(
              "SCR-05",
              `ตรวจงานซ่อม ${fixed.length} จุด`,
              "เปิดรูปและให้ผลผ่านหรือส่งกลับแก้",
              String(fixed[0].defect_id),
            );
          if (!qc.inspection_finished_at)
            add(
              "SCR-02",
              "ตรวจและบันทึกจุด",
              "เพิ่มจุดที่พบและยืนยันเมื่อตรวจครบ",
            );
          else if (qcDefs.every((d) => d.status === "VERIFIED"))
            add(
              "SCR-06",
              "นัดตรวจหน้างานซ้ำ",
              "จุดทั้งหมดตรวจผ่านแล้ว นัดตรวจรวมอีกครั้ง",
            );
          else waiting = "ตรวจครบแล้ว กำลังรอช่างรับงานหรือส่งงานซ่อมกลับมา";
        }
      }
      break;
    case "READY_TO_SELL":
      waiting = "บ้านผ่าน QC แล้ว รอฝ่ายขายผูกลูกค้า";
      if (role === "SALES")
        add(
          "SCR-09",
          "ผูกลูกค้าและออกลิงก์",
          "กรอกข้อมูลลูกค้า แล้วคัดลอกลิงก์ให้ลูกค้า",
        );
      break;
    case "CONTRACTED":
      waiting = "รอลูกค้าตอบว่าต้องการตรวจบ้านหรือรับมอบเลย";
      if (role === "CUSTOMER")
        add(
          "SCR-10",
          "เลือกว่าจะตรวจบ้านหรือไม่",
          "ต้องการตรวจให้เลือกวันสะดวก หรือไปขั้นรับมอบได้",
        );
      if (role === "SALES") {
        add(
          "SCR-12",
          "ยื่นคำขอตรวจให้ลูกค้า",
          "ใช้เมื่อลูกค้าต้องการให้ฝ่ายขายยื่นแทน",
        );
        add(
          "SCR-09",
          "ออกลิงก์ให้ลูกค้า",
          "ให้ลูกค้าตอบความต้องการและทำรายการด้วยตนเอง",
        );
      }
      break;
    case "WAITING_INSPECTION":
      waiting = "ยื่นคำขอแล้ว รอฝ่ายขายกำหนดนัดและบันทึกมาถึง";
      if (role === "SALES") {
        const req = w.requests.find((r) => r.status === "SUBMITTED");
        add(
          "SCR-13",
          req?.appointment ? "บันทึกลูกค้ามาถึง" : "กำหนดนัดตรวจบ้าน",
          req?.appointment
            ? "เปิดรอบตรวจเมื่อลูกค้ามาถึงตามนัด"
            : "กำหนดวันและเวลาในคำขอที่ยื่นไว้",
        );
      }
      break;
    case "IN_INSPECTION":
      waiting = "อยู่ระหว่างแจ้งจุดและซ่อมก่อนรับมอบ";
      if (role === "CUSTOMER") {
        if (!defs.length) {
          add(
            "SCR-14",
            "แจ้งจุดที่ต้องแก้",
            "เปิดรอบแล้ว เริ่มตรวจบ้านและบันทึกจุดที่พบ",
          );
          add(
            "SCR-17",
            "ยืนยันตรวจครบ ไม่พบจุด",
            "ใช้เมื่อตรวจครบแล้วและไม่มีจุดที่ต้องแก้ไข",
          );
          break;
        }
        const pending = defs.filter(
          (d) => !["FIXED", "VERIFIED"].includes(String(d.status)),
        );
        add(
          "SCR-17",
          pending.length ? "ติดตามการซ่อม" : "ตรวจงานและยอมรับสภาพ",
          pending.length
            ? `รอดำเนินการอีก ${pending.length} จุด เปิดดูสถานะและรูปได้`
            : "ตรวจรูปแต่ละจุด แล้วเลือกยอมรับหรือส่งกลับแก้",
        );
        add(
          "SCR-14",
          "แจ้งจุดที่ต้องแก้เพิ่ม",
          "ใช้เมื่อพบจุดเพิ่มเติมระหว่างตรวจบ้าน",
        );
      }
      if (role === "HEAD_TECHNICIAN") {
        const fresh = w.newDefects.filter((d) => d.unit_id === unit);
        if (fresh.length)
          add(
            "SCR-15",
            `แยกประเภทงานใหม่ ${fresh.length} จุด`,
            "จัดประเภทแล้วส่งเข้าคิวช่าง",
            String(fresh[0].defect_id),
          );
      }
      if (role === "INSPECTOR") {
        if (
          defs.length &&
          defs.every((d) => ["FIXED", "VERIFIED"].includes(String(d.status)))
        )
          add(
            "SCR-16",
            "ออกเอกสารสรุปการซ่อม",
            "ทุกจุดซ่อมเสร็จแล้ว สร้าง PDF ให้ลูกค้าตรวจรับ",
          );
        else waiting = "รอช่างซ่อมทุกจุดให้เสร็จ แล้วจึงออกเอกสารสรุปได้";
      }
      break;
    case "READY_HANDOVER":
      waiting = "บ้านพร้อมรับมอบแล้ว รอลูกค้าลงลายเซ็น";
      if (role === "CUSTOMER")
        add(
          "SCR-18",
          "ลงลายเซ็นรับมอบบ้าน",
          "ตรวจข้อมูลบ้านและลงลายเซ็นยืนยัน",
        );
      break;
    case "HANDED_OVER":
      waiting = "ส่งมอบบ้านเรียบร้อยแล้ว ดูประวัติและเอกสารได้";
      if (role === "CUSTOMER")
        add("SCR-18", "ดูหลักฐานรับมอบ", "บ้านนี้ลงลายเซ็นรับมอบไว้แล้ว");
      break;
  }
  if (role === "TECHNICIAN" || role === "HEAD_TECHNICIAN") {
    const own = w.myJobs.filter((d) => d.unit_id === unit),
      queue = w.queue.filter((d) => d.unit_id === unit);
    if (own.length)
      add(
        "SCR-04",
        `ซ่อมงานที่รับไว้ ${own.length} จุด`,
        "เปิดงานแล้วแนบรูปหลังซ่อมเพื่อส่งตรวจ",
        String(own[0].defect_id),
      );
    if (queue.length)
      add(
        "SCR-03",
        `รับงานซ่อม ${queue.length} จุด`,
        "มีงานที่คุณรับได้ในบ้านนี้",
        String(queue[0].defect_id),
      );
    if (!actions.length)
      waiting =
        "ตอนนี้ไม่มีงานที่คุณต้องทำในบ้านนี้ รอฝ่ายที่เกี่ยวข้องดำเนินการต่อ";
  }
  if (u.archived_at) {
    actions.splice(0);
    waiting = "บ้านนี้เก็บเข้าคลังแล้ว ดูประวัติได้จากทะเบียนบ้าน";
  }
  return { actions, waiting, stage };
}
