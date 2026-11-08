"use client";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { type Workspace, type DataRow } from "@/lib/runtime-contracts";
import { categories, defectStatuses } from "@/lib/domain";
import { RecordsTable } from "../records-table";
export const PickedDefect = createContext("");
type Payload = Record<string, unknown>;
export const str = (v: unknown) => String(v ?? "");
export const label = (map: Record<string, string>, v: unknown) =>
  map[str(v)] ?? str(v);
export const when = (v: unknown) =>
  v
    ? new Date(
        str(v).replace(" ", "T") + (str(v).endsWith("Z") ? "" : "Z"),
      ).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
    : "ยังไม่ระบุ";
export function Field({
  name,
  title,
  type = "text",
  required = true,
  value,
  max = 100,
}: {
  name: string;
  title: string;
  type?: string;
  required?: boolean;
  value?: string;
  max?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {title}
        {!required && " (ไม่บังคับ)"}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={max}
        className="input w-full"
      />
    </div>
  );
}
export function Select({
  name,
  title,
  items,
  required = true,
}: {
  name: string;
  title: string;
  items: { value: string; title: string }[];
  required?: boolean;
}) {
  const id = useId(),
    picked = useContext(PickedDefect);
  const chosen =
    name === "defect_id" && items.some((i) => i.value === picked)
      ? picked
      : items.length === 1
        ? items[0].value
        : "";
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {title}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        className="select w-full"
        key={items.map((i) => i.value).join(",") + chosen}
        defaultValue={chosen}
      >
        <option value="" disabled={required}>
          {required ? "เลือกรายการ" : "ไม่ระบุ"}
        </option>
        {items.map((x) => (
          <option key={x.value} value={x.value}>
            {x.title}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Photos({ required = false }: { required?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        รูปประกอบ{required ? " (อย่างน้อย 1 รูป)" : " (ไม่บังคับ)"}
      </label>
      <input
        id={id}
        name="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        required={required}
        className="file-input w-full"
      />
      <p className="helper mt-1">
        JPEG, PNG หรือ WebP ไม่เกิน 5 MB ต่อรูป สูงสุด 10 รูปต่อครั้ง
      </p>
    </div>
  );
}
export function Description() {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        รายละเอียด (ไม่บังคับ)
      </label>
      <textarea
        id={id}
        name="description"
        maxLength={10000}
        rows={3}
        className="textarea w-full"
      />
    </div>
  );
}
export function Category() {
  return (
    <Select
      name="category"
      title="ประเภทงาน"
      items={Object.entries(categories).map(([value, title]) => ({
        value,
        title,
      }))}
    />
  );
}
export function Check({
  name,
  title,
  required = false,
  value,
  defaultChecked = false,
}: {
  name?: string;
  title: string;
  required?: boolean;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 py-2">
      <input
        name={name}
        type="checkbox"
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="checkbox mt-1 shrink-0"
      />
      <span>{title}</span>
    </label>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="panel-surface p-5 sm:p-7">
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
export function Empty({
  children = "ไม่มีรายการในขั้นตอนนี้",
}: {
  children?: ReactNode;
}) {
  return <p className="py-5 text-muted">{children}</p>;
}
export type Run = (uc: string, data: Payload, files?: File[]) => Promise<void>;
export function Action({
  uc,
  extra = {},
  run,
  title,
  children,
  disabled = false,
  primary = false,
  reset = true,
}: {
  uc: string;
  extra?: Payload;
  run: Run;
  title: string;
  children?: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  reset?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      fd = new FormData(form);
    const data: Payload = {
      ...Object.fromEntries(
        [...fd.entries()].filter(([, v]) => typeof v === "string"),
      ),
      ...extra,
    };
    if (fd.has("defect_ids")) data.defect_ids = fd.getAll("defect_ids");
    if (fd.has("is_single_certify")) data.is_single_certify = true;
    if (fd.has("appointment")) {
      const v = str(fd.get("appointment"));
      if (v) data.appointment = new Date(v).toISOString();
    }
    const files = [...fd.values()].filter(
      (v): v is File => v instanceof File && v.size > 0,
    );
    setBusy(true);
    setError("");
    try {
      await run(uc, data, files);
      if (reset) form.reset();
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
          : err instanceof Error
            ? err.message
            : "บันทึกไม่ได้ กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy || disabled} className="space-y-5">
        {children}
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        <button className={`btn ${primary ? "btn-primary" : ""}`} type="submit">
          {busy && (
            <span
              className="loading loading-spinner loading-sm"
              aria-hidden="true"
            />
          )}
          {busy ? "กำลังบันทึก" : title}
        </button>
      </fieldset>
    </form>
  );
}
export function Signature({ run, disabled }: { run: Run; disabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    last = useRef<{ x: number; y: number } | null>(null);
  const [drawn, setDrawn] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * e.currentTarget.width) / r.width,
      y: ((e.clientY - r.top) * e.currentTarget.height) / r.height,
    };
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!drawn) {
      setError("กรุณาเขียนลายเซ็นก่อนยืนยัน");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        ref.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("อ่านลายเซ็นไม่ได้"))),
          "image/png",
        ),
      );
      await run("UC-18", {}, [
        new File([blob], "signature.png", { type: "image/png" }),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่ได้");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-muted">
        ตรวจข้อมูลบ้านและผลการยอมรับสภาพให้ครบก่อนลงลายเซ็นรับมอบ
      </p>
      <fieldset disabled={busy || disabled} className="space-y-5">
        <div>
          <p id="signature-label" className="field-label">
            เขียนลายเซ็นในกรอบ
          </p>
          <canvas
            ref={ref}
            width={900}
            height={300}
            aria-labelledby="signature-label"
            className="w-full touch-none rounded-field border border-base-content [background:var(--color-field-surface)]"
            onPointerDown={(e) => {
              if (disabled || busy) return;
              drawing.current = true;
              last.current = point(e);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drawing.current || !last.current) return;
              const p = point(e),
                ctx = e.currentTarget.getContext("2d")!;
              ctx.strokeStyle = getComputedStyle(e.currentTarget).color;
              ctx.lineWidth = 3;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(last.current.x, last.current.y);
              ctx.lineTo(p.x, p.y);
              ctx.stroke();
              last.current = p;
              setDrawn(true);
            }}
            onPointerUp={() => {
              drawing.current = false;
              last.current = null;
            }}
            onPointerCancel={() => {
              drawing.current = false;
              last.current = null;
            }}
          />
          <button
            type="button"
            className="btn btn-ghost mt-2"
            onClick={() => {
              ref.current?.getContext("2d")?.clearRect(0, 0, 900, 300);
              setDrawn(false);
            }}
          >
            ล้างลายเซ็น
          </button>
          <p className="helper">
            หากเขียนบนหน้าจอไม่สะดวก ใช้แบบแนบรูปลายเซ็นด้านล่างได้
          </p>
        </div>
        <Check required title="ฉันตรวจข้อมูลและยืนยันรับมอบบ้านหลังนี้" />
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!drawn || busy || disabled}
        >
          {busy ? "กำลังบันทึก" : "ยืนยันเซ็นรับมอบ"}
        </button>
      </fieldset>
    </form>
  );
}
export function Files({
  defectId,
  files: allFiles,
}: {
  defectId?: string;
  files: DataRow[];
}) {
  const files = allFiles.filter((f) =>
    defectId ? f.defect_id === defectId : !f.defect_id,
  );
  return files.length ? (
    <div className="mt-4 flex flex-wrap gap-3">
      {files.map((f) => (
        <a
          key={str(f.file_id)}
          href={str(f.path)}
          target="_blank"
          rel="noreferrer"
          className="block rounded-field border border-base-300 p-2 text-sm underline underline-offset-4"
        >
          {f.file_usage !== "SUMMARY_PDF" && (
            <Image
              src={str(f.path)}
              alt={
                f.file_usage === "BEFORE_FIX"
                  ? "รูปก่อนซ่อม"
                  : f.file_usage === "AFTER_FIX"
                    ? "รูปหลังซ่อม"
                    : "ลายเซ็นรับมอบ"
              }
              width={160}
              height={110}
              unoptimized
              className="mb-2 h-24 w-36 object-contain"
            />
          )}
          {f.file_usage === "SUMMARY_PDF"
            ? "เปิดเอกสารสรุป PDF"
            : f.file_usage === "BEFORE_FIX"
              ? "เปิดรูปก่อนซ่อม"
              : f.file_usage === "AFTER_FIX"
                ? "เปิดรูปหลังซ่อม"
                : "เปิดลายเซ็นรับมอบ"}{" "}
          · {str(f.file_id)}
        </a>
      ))}
    </div>
  ) : null;
}
const statusBadgeConfig: Record<string, string> = {
  NEW: "badge-status-new",
  WAITING_ASSIGN: "badge-status-waiting",
  ASSIGNED: "badge-status-assigned",
  FIXED: "badge-status-fixed",
  REWORK: "badge-status-rework",
  VERIFIED: "badge-status-verified",
};
function DefectStatusBadge({ status }: { status: unknown }) {
  const code = str(status);
  const badgeClass = statusBadgeConfig[code] ?? "badge-outline";
  return (
    <span className={`badge ${badgeClass} font-medium`}>
      {label(defectStatuses, code)}
    </span>
  );
}

export function RepairDocuments({
  reports,
  files,
}: Pick<Workspace, "reports" | "files">) {
  return (
    <Panel title="เอกสารสรุปการซ่อม">
      <RecordsTable
        label="เอกสารสรุปการซ่อม"
        columns={["เอกสาร", "วันที่สร้าง", "ไฟล์"]}
        empty="ยังไม่มีเอกสารสรุปการซ่อมสำหรับบ้านหลังนี้"
        rows={reports.map((report) => {
          const pdf = files.find(
            (file) =>
              file.file_usage === "SUMMARY_PDF" &&
              file.report_id === report.report_id,
          );
          return {
            key: str(report.report_id),
            cells: [
              report.title,
              when(report.created_at),
              pdf ? (
                <a
                  key="pdf"
                  className="btn"
                  href={str(pdf.path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิดเอกสารสรุป PDF
                  <span className="sr-only"> {report.title}</span>
                </a>
              ) : (
                "ไม่มีไฟล์แนบ"
              ),
            ],
          };
        })}
      />
    </Panel>
  );
}
export function Defects({
  items,
  select = false,
  files,
}: {
  items: DataRow[];
  select?: boolean;
  files: DataRow[];
}) {
  return items.length ? (
    <ul className="divide-y divide-base-300">
      {items.map((d) => (
        <li key={str(d.defect_id)} className="py-4">
          <div className="flex flex-wrap items-start gap-3">
            {select && (
              <input
                type="checkbox"
                name="defect_ids"
                value={str(d.defect_id)}
                aria-label={"เลือกจุด " + d.defect_id}
                disabled={d.status !== "FIXED"}
                className="checkbox mt-1"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{str(d.location_pin)}</p>
                {d.house_no && (
                  <span className="badge badge-sm badge-outline">
                    บ้าน {str(d.house_no)}
                  </span>
                )}
                {Number(d.rework_count) > 0 && (
                  <span className="badge badge-sm badge-warning">
                    แก้รอบที่ {str(d.rework_count)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                <span className="font-mono text-xs">{str(d.defect_id)}</span> ·{" "}
                {label(categories, d.category) || "รอแยกประเภท"}
                {d.target_date
                  ? " · เป้าหมาย " + str(d.target_date).slice(0, 10)
                  : ""}
              </p>
            </div>
            <DefectStatusBadge status={d.status} />
          </div>
          <details className="mt-3 rounded-field bg-base-200/50 p-3">
            <summary className="cursor-pointer font-medium text-sm text-muted hover:text-base-content">
              ดูรายละเอียดและรูปประกอบ
            </summary>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              {str(d.description) || "ไม่มีรายละเอียดเพิ่มเติม"}
            </p>
            <p className="mt-2 text-xs text-muted">
              ช่างผู้รับงาน: {str(d.technician_id) || "ยังไม่มีผู้รับงาน"}
            </p>
            <Files files={files} defectId={str(d.defect_id)} />
          </details>
        </li>
      ))}
    </ul>
  ) : (
    <Empty />
  );
}
