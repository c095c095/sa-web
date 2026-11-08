export const categories = { CEILING:"ฝ้าเพดาน", ELECTRICAL:"ไฟฟ้า", PLUMBING:"ประปา", WALL:"ผนัง", FLOOR:"พื้น", DOOR_WINDOW:"ประตู-หน้าต่าง" } as const;
export type Category = keyof typeof categories;
export const defectStatuses = { NEW:"ใหม่", WAITING_ASSIGN:"รอช่างรับ", ASSIGNED:"ช่างรับงานแล้ว", FIXED:"ซ่อมเสร็จ", REWORK:"ส่งกลับแก้", VERIFIED:"ตรวจผ่านแล้ว" } as const;
export type DefectStatus = keyof typeof defectStatuses;
export interface QueueItem { defect_id:string; project_name:string; house_no:string; category:Category; location_pin:string; description:string|null; target_date:string|null; }
export interface RepairItem { defect_id:string; location_pin:string; category:Category|null; status:DefectStatus; target_date:string|null; }
