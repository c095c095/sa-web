import "server-only";
import mysql, { type RowDataPacket } from "mysql2/promise";
import type { QueueItem, RepairItem } from "./domain";
const globalDb = globalThis as unknown as { pilotPool?:mysql.Pool };
const pool = globalDb.pilotPool ?? mysql.createPool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT??3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,charset:"utf8mb4",timezone:"Z",dateStrings:true,connectionLimit:4});
if(process.env.NODE_ENV!=="production")globalDb.pilotPool=pool;
function checkDb(){if(process.env.DB_NAME!=="sa_web_dev_p1")throw new Error("Pilot may only read the P1 fixture database");}
export async function getQueue():Promise<QueueItem[]> {
  checkDb();
  // Q03.1 with a fixed fictional head-technician fixture, not employee login.
  const [rows]=await pool.execute<RowDataPacket[]>(`SELECT d.defect_id,u.project_name,u.house_no,d.category,d.location_pin,d.description,d.target_date FROM defect d JOIN inspection_round r ON r.round_id=d.round_id JOIN property_unit u ON u.unit_id=r.unit_id JOIN employee e ON e.employee_id=? WHERE d.status='WAITING_ASSIGN' AND e.is_active=1 AND e.role='HEAD_TECHNICIAN' AND (e.craft_category IS NULL OR d.category=e.craft_category) ORDER BY d.created_at`,["EMP0008"]);
  return rows as (RowDataPacket&QueueItem)[];
}
export async function getRepairItems():Promise<RepairItem[]> {
  checkDb();
  // Q17.2 reads only fictional H0006; customer authentication is implemented after G1.
  const [rows]=await pool.execute<RowDataPacket[]>(`SELECT d.defect_id,d.location_pin,d.category,d.status,d.target_date FROM defect d JOIN inspection_round r ON r.round_id=d.round_id WHERE r.unit_id=? AND r.round_type='CUSTOMER_HANDOVER' ORDER BY d.defect_id`,["H0006"]);
  return rows as (RowDataPacket&RepairItem)[];
}
