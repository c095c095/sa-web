import { type DataRow } from "./runtime-contracts";
export interface ManagementView {
  section: string;
  items?: DataRow[];
  total?: number;
  page?: number;
  pages?: number;
  projects?: DataRow[];
  units?: DataRow[];
  counts?: DataRow[];
  tasks?: DataRow;
  upcoming?: DataRow[];
  recentAudit?: DataRow[];
}
export interface ManagementDetail {
  files?: DataRow[];
  employee?: DataRow;
  unit?: DataRow;
  jobs?: DataRow[];
  technicians?: DataRow[];
  rounds?: DataRow[];
  defects?: DataRow[];
  requests?: DataRow[];
  customers?: DataRow[];
}
export const managementSections: Record<string, string> = {
  overview: "ภาพรวม",
  projects: "โครงการ",
  units: "บ้าน",
  customers: "ลูกค้า",
  employees: "พนักงาน",
  links: "ลิงก์ลูกค้า",
  sessions: "การเข้าสู่ระบบ",
  audit: "ประวัติการจัดการ",
};
