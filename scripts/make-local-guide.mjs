import fs from "node:fs";
import path from "node:path";
import { local, connect } from "./db-common.mjs";
const examples = JSON.parse(
  fs.readFileSync(path.join(local, "customer-demo-links.json"), "utf8"),
);
const db = await connect("sa_web_dev_p1");
try {
  const [rows] = await db.query(
    "SELECT l.link_id,l.expires_at,l.expires_at>NOW() valid,u.house_no,u.status FROM access_link l JOIN property_unit u ON u.unit_id=l.unit_id",
  );
  const lines = [
    "# ลิงก์บ้านสมมติสำหรับตรวจระบบ",
    "",
    "เปิดคนละหน้าต่างกับบัญชีพนักงาน เพื่อไม่ให้ session แทนกัน",
    "",
    "| บ้าน | สถานะ | ลิงก์ | ใช้ได้ |",
    "|---|---|---|---|",
  ];
  for (const r of rows) {
    const raw = examples.links.find((l) => l.link_id === r.link_id);
    if (raw) {
      const url = raw.url.replace("/access?token=", "/access#token=");
      lines.push(
        "| " +
          r.house_no +
          " | " +
          r.status +
          " | [เปิดบ้าน](" +
          url +
          ") | " +
          (r.valid ? "ยังไม่หมดอายุ" : "หมดอายุ ให้ฝ่ายขายออกใหม่") +
          " |",
      );
    }
  }
  fs.writeFileSync(
    path.join(local, "CUSTOMER-LINKS.md"),
    lines.join("\n") + "\n",
  );
  console.log(
    "Created private synthetic customer-link guide; no tokens printed.",
  );
} finally {
  await db.end();
}
