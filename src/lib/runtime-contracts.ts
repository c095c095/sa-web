export type DataRow = Record<string, string | number | null>;
export type SessionView =
  | {
      kind: "EMPLOYEE";
      employeeId: string;
      role: "SALES" | "INSPECTOR" | "TECHNICIAN" | "HEAD_TECHNICIAN";
      craft: string | null;
      fullName: string;
    }
  | { kind: "CUSTOMER"; unitId: string; fullName: string };
export interface Workspace {
  identity: SessionView;
  units: DataRow[];
  unit: DataRow | null;
  rounds: DataRow[];
  defects: DataRow[];
  files: DataRow[];
  requests: DataRow[];
  reports: DataRow[];
  queue: DataRow[];
  myJobs: DataRow[];
  newDefects: DataRow[];
  inspectors: DataRow[];
}
export const roleLabels = {
  SALES: "ฝ่ายขาย",
  INSPECTOR: "ฝ่ายตรวจบ้าน",
  TECHNICIAN: "ช่าง",
  HEAD_TECHNICIAN: "หัวหน้าช่าง",
};
export const screens: Record<string, string> = {
  "SCR-01": "ลงทะเบียนบ้านเข้าระบบ",
  "SCR-02": "บันทึกจุดที่ต้องแก้ไข",
  "SCR-03": "รับงานซ่อมตามประเภทช่าง",
  "SCR-04": "ซ่อมและแนบรูปหลังซ่อม",
  "SCR-05": "ตรวจรูปและอนุมัติงานซ่อม",
  "SCR-06": "นัดตรวจหน้างานซ้ำรวมทีเดียว",
  "SCR-07": "ปิดรอบ QC",
  "SCR-08": "แจ้งฝ่ายขายว่าบ้านพร้อมขาย",
  "SCR-09": "ส่งลิงก์เข้าสู่ระบบให้ลูกค้า",
  "SCR-10": "ระบุความต้องการตรวจก่อนรับมอบ",
  "SCR-11": "ลูกค้ายื่นคำขอตรวจเอง",
  "SCR-12": "ยื่นคำขอตรวจให้ลูกค้า",
  "SCR-13": "เปิดบ้านและดูแลระหว่างลูกค้าตรวจ",
  "SCR-14": "แจ้งจุดที่ต้องแก้ในระบบ",
  "SCR-15": "แยกงานตามประเภทช่าง",
  "SCR-16": "ออกเอกสารสรุปการซ่อม",
  "SCR-17": "ติดตามสถานะการซ่อมและยืนยันยอมรับสภาพ",
  "SCR-18": "เซ็นรับมอบ",
};
export const screenRoles: Record<string, string[]> = {
  SALES: ["SCR-01", "SCR-09", "SCR-12", "SCR-13"],
  INSPECTOR: ["SCR-02", "SCR-05", "SCR-06", "SCR-07", "SCR-08", "SCR-16"],
  TECHNICIAN: ["SCR-03", "SCR-04"],
  HEAD_TECHNICIAN: ["SCR-03", "SCR-04", "SCR-15"],
  CUSTOMER: ["SCR-10", "SCR-11", "SCR-14", "SCR-17", "SCR-18"],
};
export const unitStates: Record<string, string> = {
  IN_QC: "อยู่ระหว่างตรวจ QC",
  READY_TO_SELL: "พร้อมขาย",
  CONTRACTED: "ทำสัญญาแล้ว",
  WAITING_INSPECTION: "รอตรวจก่อนรับมอบ",
  IN_INSPECTION: "อยู่ระหว่างตรวจ/ซ่อม",
  READY_HANDOVER: "พร้อมรับมอบ",
  HANDED_OVER: "ส่งมอบแล้ว",
};
