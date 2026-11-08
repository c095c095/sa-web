import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile, rename, readFile, unlink } from "node:fs/promises";
import fs from "node:fs";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import puppeteer from "puppeteer-core";
import { categories, defectStatuses } from "@/lib/domain";
import { pool, one, rows, type Tx, type Row } from "./db";
import { type Identity, scopedDefect } from "./auth";
import { AppError, requireThat } from "./errors";
// Runtime data is backed up separately; never bundle private uploads or secrets.
const root = path.resolve(/* turbopackIgnore: true */
  process.cwd(),
  process.env.APP_STORAGE_DIR ?? ".local/storage",
);
const keyPattern = /^[a-f0-9-]{36}\.(webp|pdf)$/;
export interface Media {
  key: string;
  temp: string;
  final: string;
}
export function mediaPath(key: string) {
  requireThat(keyPattern.test(key), "ไม่พบไฟล์", 404);
  return path.join(root, "files", key);
}
export function mediaKey(url: string) {
  try {
    const key = new URL(url).pathname.split("/").pop() ?? "";
    return keyPattern.test(key) ? key : null;
  } catch {
    return null;
  }
}
async function stage(bytes: Buffer, ext: "webp" | "pdf"): Promise<Media> {
  await mkdir(path.join(root, "staging"), { recursive: true });
  await mkdir(path.join(root, "files"), { recursive: true });
  const key = randomUUID() + "." + ext;
  const temp = path.join(root, "staging", key);
  await writeFile(temp, bytes, { flag: "wx" });
  return { key, temp, final: mediaPath(key) };
}
export async function imageUploads(files: File[], required = false) {
  requireThat(!required || files.length, "กรุณาแนบรูปอย่างน้อย 1 รูป", 422);
  requireThat(files.length <= 10, "แนบรูปได้ไม่เกิน 10 รูปต่อครั้ง", 422);
  const staged: Media[] = [];
  try {
    for (const file of files) {
      requireThat(
        file.size <= 5 * 1024 * 1024,
        "รูปต้องมีขนาดไม่เกิน 5 MB ต่อรูป",
        422,
      );
      const bytes = Buffer.from(await file.arrayBuffer());
      const type = await fileTypeFromBuffer(bytes);
      requireThat(
        type && ["image/jpeg", "image/png", "image/webp"].includes(type.mime),
        "ใช้รูป JPEG, PNG หรือ WebP ที่เปิดอ่านได้เท่านั้น",
        422,
      );
      let output: Buffer;
      try {
        output = await sharp(bytes, { limitInputPixels: 25_000_000 })
          .rotate()
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new AppError(
          422,
          "INVALID_IMAGE",
          "อ่านรูปไม่ได้หรือรูปมีขนาดพิกเซลใหญ่เกินไป กรุณาเลือกรูปใหม่",
        );
      }
      staged.push(await stage(output, "webp"));
    }
    return staged;
  } catch (e) {
    await cleanup(staged);
    throw e;
  }
}
export async function cleanup(files: Media[]) {
  await Promise.all(files.map((f) => unlink(f.temp).catch(() => {})));
}
export async function attach(
  tx: Tx,
  media: Media,
  owner: { defect_id?: string; unit_id?: string; report_id?: string },
  usage: "BEFORE_FIX" | "AFTER_FIX" | "SIGNATURE" | "SUMMARY_PDF",
) {
  const url =
    (process.env.APP_URL ?? "http://localhost:3000") +
    "/api/files/" +
    media.key;
  requireThat(url.length <= 255, "ที่อยู่ระบบยาวเกินขนาดที่จัดเก็บได้", 422);
  const f = await one(
    tx.db,
    "INSERT INTO file(unit_id,defect_id,report_id,file_url,file_usage,uploaded_at) VALUES(?,?,?,?,?,NOW(6)) RETURNING file_id,file_url,file_usage",
    [
      owner.unit_id ?? null,
      owner.defect_id ?? null,
      owner.report_id ?? null,
      url,
      usage,
    ],
  );
  await rename(media.temp, media.final);
  tx.createdFiles.push(media.final);
  return f;
}
export async function privateFile(id: Identity, key: string) {
  requireThat(keyPattern.test(key), "ไม่พบไฟล์", 404);
  const url =
    (process.env.APP_URL ?? "http://localhost:3000") + "/api/files/" + key;
  const f = await one(
    pool,
    `SELECT f.*,COALESCE(f.unit_id,dr.unit_id,pr.unit_id) owner_unit FROM file f LEFT JOIN defect d ON d.defect_id=f.defect_id LEFT JOIN inspection_round dr ON dr.round_id=d.round_id LEFT JOIN repair_report rp ON rp.report_id=f.report_id LEFT JOIN inspection_round pr ON pr.round_id=rp.round_id WHERE f.file_url=?`,
    [url],
  );
  requireThat(
    f && (id.kind !== "CUSTOMER" || f.owner_unit === id.unitId),
    "ไม่พบไฟล์",
    404,
  );
  if (
    id.kind === "EMPLOYEE" &&
    ["TECHNICIAN", "HEAD_TECHNICIAN"].includes(id.role)
  ) {
    requireThat(f.defect_id, "ไม่พบไฟล์", 404);
    await scopedDefect(id, String(f.defect_id));
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(mediaPath(key));
  } catch {
    throw new AppError(
      404,
      "FILE_UNAVAILABLE",
      "ยังไม่มีไฟล์นี้ในพื้นที่จัดเก็บ",
    );
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": key.endsWith(".pdf") ? "application/pdf" : "image/webp",
      "Content-Disposition": `inline; filename="${f.file_id}.${key.endsWith(".pdf") ? "pdf" : "webp"}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
const escapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escape = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => escapes[c]);
export async function repairPdf(
  unit: Row,
  round: Row,
  defects: Row[],
  files: Row[],
  title: string,
) {
  const faceRoot = path.join(
    process.cwd(),
    "node_modules/@fontsource/ibm-plex-sans-thai",
  );
  let fontCss = "";
  for (const weight of [400, 600]) {
    const css = fs.readFileSync(path.join(faceRoot, `${weight}.css`), "utf8");
    fontCss += css.replace(
      /url\((?:'|")?\.\/([^)'"\s]+)(?:'|")?\)/g,
      (_, p: string) =>
        `url(data:font/woff2;base64,${fs.readFileSync(path.join(faceRoot, p)).toString("base64")})`,
    );
  }
  const content = await Promise.all(
    defects.map(async (d) => {
      const pics = await Promise.all(
        files
          .filter((f) => f.defect_id === d.defect_id)
          .map(async (f) => {
            const key = mediaKey(String(f.file_url));
            if (!key || !key.endsWith(".webp")) return "";
            try {
              return `<figure><img src="data:image/webp;base64,${(await readFile(mediaPath(key))).toString("base64")}"><figcaption>${f.file_usage === "BEFORE_FIX" ? "รูปก่อนซ่อม" : "รูปหลังซ่อม"}</figcaption></figure>`;
            } catch {
              return "";
            }
          }),
      );
      return `<section><h2>${escape(d.location_pin)}</h2><p>${escape(d.defect_id)} / ${escape((categories as Record<string, string>)[String(d.category)] ?? d.category)} / ${escape((defectStatuses as Record<string, string>)[String(d.status)] ?? d.status)}</p><p>${escape(d.description)}</p><div class="pictures">${pics.filter(Boolean).join("") || "<p>ไม่มีรูปที่อัปโหลดในระบบสำหรับรายการนี้</p>"}</div></section>`;
    }),
  );
  const executable = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find((p) => p && fs.existsSync(p));
  requireThat(executable, "เครื่องมือสร้าง PDF ยังไม่พร้อม", 503);
  const browser = await puppeteer.launch({
    executablePath: executable,
    headless: true,
    args: ["--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url().startsWith("data:") || req.url() === "about:blank")
        req.continue();
      else req.abort();
    });
    await page.setContent(
      `<!doctype html><html lang="th"><meta charset="utf-8"><title>${escape(title)}</title><style>${fontCss}body{font-family:'IBM Plex Sans Thai';font-size:12px;color:#111}h1{font-size:20px}h2{font-size:15px}section{border-top:1px solid #aaa;padding:12px 0;break-inside:avoid}.pictures{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0;max-width:45%}img{max-width:100%;max-height:200px}figcaption{font-size:11px}</style><h1>${escape(title)}</h1><p>โครงการ ${escape(unit.project_name)} บ้านเลขที่ ${escape(unit.house_no)}</p><p>รอบ ${escape(round.round_id)} / รอบตรวจก่อนรับมอบ</p>${content.join("")}<p>ออกจากข้อมูลที่บันทึกในระบบ ${escape(new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }))}</p></html>`,
      { waitUntil: "load" },
    );
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:10px;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
    });
    return await stage(Buffer.from(bytes), "pdf");
  } finally {
    await browser.close();
  }
}
export async function fileRows(db: Tx["db"], roundId: string) {
  return rows(
    db,
    "SELECT f.* FROM file f JOIN defect d ON d.defect_id=f.defect_id WHERE d.round_id=? ORDER BY f.uploaded_at",
    [roundId],
  );
}
