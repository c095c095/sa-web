import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { exchangeLink, login } from "./auth";
import { one, pool } from "./db";
import { AppError, requireThat } from "./errors";

const accounts = {
  SALES: "EMP0001",
  INSPECTOR: "EMP0003",
  TECHNICIAN: "EMP0007",
  HEAD_TECHNICIAN: "EMP0008",
  ADMIN: "ADMIN",
} as const;

export async function demoEnabled() {
  const { SA_DEMO_MODE, DB_NAME, DB_HOST, SA_DEMO_SECRET, APP_URL } =
    process.env;
  if (
    SA_DEMO_MODE !== "1" ||
    DB_NAME !== "sa_web_demo" ||
    DB_HOST !== "127.0.0.1" ||
    !SA_DEMO_SECRET ||
    !APP_URL ||
    new URL(APP_URL).hostname !== "127.0.0.1"
  )
    return false;
  const marker = await one(
    pool,
    "SELECT digest FROM demo_install WHERE id=1",
  ).catch((error) => {
    if (error.code === "ER_NO_SUCH_TABLE") return undefined;
    throw error;
  });
  return (
    marker?.digest === createHash("sha256").update(SA_DEMO_SECRET).digest("hex")
  );
}

export async function demoLogin(data: unknown, req: Request) {
  if (!(await demoEnabled()))
    throw new AppError(404, "NOT_FOUND", "ไม่พบการทำงานที่ต้องการ");
  const { role } = z
    .object({
      role: z.enum([
        "SALES",
        "INSPECTOR",
        "TECHNICIAN",
        "HEAD_TECHNICIAN",
        "ADMIN",
        "CUSTOMER",
      ]),
    })
    .parse(data);
  if (role === "CUSTOMER")
    return exchangeLink({ token: process.env.SA_DEMO_CUSTOMER_TOKEN }, req);
  const employeeId = accounts[role];
  const account = await one(
    pool,
    "SELECT role FROM employee WHERE employee_id=? AND is_active=1",
    [employeeId],
  );
  requireThat(account?.role === role, "บัญชีสาธิตนี้ไม่พร้อมใช้งาน", 409);
  return login(
    { employee_id: employeeId, password: process.env.SA_DEMO_SECRET },
    req,
  );
}
