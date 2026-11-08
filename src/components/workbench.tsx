"use client";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";
import {
  type Workspace,
  type DataRow,
  screens,
  unitStates,
} from "@/lib/runtime-contracts";
import { categories, defectStatuses } from "@/lib/domain";
import { AppFrame, Back } from "./manage-ui";
import { journey, taskUrl } from "@/lib/journey";
const PickedDefect = createContext("");
type Payload = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");
const label = (map: Record<string, string>, v: unknown) =>
  map[str(v)] ?? str(v);
const when = (v: unknown) =>
  v
    ? new Date(
        str(v).replace(" ", "T") + (str(v).endsWith("Z") ? "" : "Z"),
      ).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
    : "ยังไม่ระบุ";
function Field({
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
function Select({
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
function Photos({ required = false }: { required?: boolean }) {
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
function Description() {
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
function Category() {
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
function Check({
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
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-5 sm:p-7">
      <h2 className="mb-5 text-xl">{title}</h2>
      {children}
    </section>
  );
}
function Empty({
  children = "ไม่มีรายการในขั้นตอนนี้",
}: {
  children?: ReactNode;
}) {
  return <p className="py-5 text-muted">{children}</p>;
}
type Run = (uc: string, data: Payload, files?: File[]) => Promise<void>;
function Action({
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
function Signature({ run, disabled }: { run: Run; disabled: boolean }) {
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
function Files({
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
function Defects({
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
        <li key={str(d.defect_id)} className="py-5">
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
              <p className="font-medium">
                {str(d.location_pin)}
                {d.house_no && (
                  <span className="ml-2 text-sm text-muted">
                    บ้าน {str(d.house_no)}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted">
                {str(d.defect_id)} ·{" "}
                {label(categories, d.category) || "รอแยกประเภท"}
                {d.target_date
                  ? " · เป้าหมาย " + str(d.target_date).slice(0, 10)
                  : ""}
              </p>
            </div>
            <span
              className={`badge ${d.status === "VERIFIED" ? "badge-success" : d.status === "REWORK" ? "badge-warning" : "badge-outline"}`}
            >
              {label(defectStatuses, d.status)}
            </span>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer py-2 underline underline-offset-4">
              รายละเอียดและรูป
            </summary>
            <p className="whitespace-pre-wrap break-words">
              {str(d.description) || "ไม่มีรายละเอียดเพิ่มเติม"}
            </p>
            <p className="text-sm text-muted">
              ช่าง {str(d.technician_id) || "ยังไม่มีผู้รับงาน"} · ส่งกลับแก้{" "}
              {str(d.rework_count) || "0"} ครั้ง
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
export function Workbench({
  initial,
  screen,
  selectedDefect = "",
}: {
  initial: Workspace;
  screen: string;
  selectedDefect?: string;
}) {
  const [w, setW] = useState(initial),
    [message, setMessage] = useState(""),
    [resultUrl, setResultUrl] = useState(""),
    [loadError, setLoadError] = useState(""),
    [refreshing, setRefreshing] = useState(false),
    [search, setSearch] = useState(""),
    [completed, setCompleted] = useState(false);
  const router = useRouter();
  const identity = w.identity,
    unit = w.unit,
    unitId = str(unit?.unit_id),
    qc = w.rounds.find(
      (r) => r.round_type === "QC_INTERNAL" && r.status !== "CLOSED",
    ),
    hand = w.rounds.find(
      (r) => r.round_type === "CUSTOMER_HANDOVER" && r.status === "OPEN",
    );
  async function reload() {
    setRefreshing(true);
    setLoadError("");
    try {
      const r = await fetch(
        "/api/workspace" +
          (unitId ? "?unit=" + encodeURIComponent(unitId) : ""),
        { cache: "no-store" },
      );
      const json = await r.json();
      if (r.status === 401) {
        router.replace("/login");
        return;
      }
      if (!r.ok) throw new Error(json.error?.message ?? "โหลดรายการไม่ได้");
      setW(json.data);
    } catch (e) {
      setLoadError(
        e instanceof TypeError
          ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
          : e instanceof Error
            ? e.message
            : "เชื่อมต่อไม่ได้",
      );
    } finally {
      setRefreshing(false);
    }
  }
  const run: Run = async (uc, data, files = []) => {
    setMessage("");
    setResultUrl("");
    const fd = new FormData();
    fd.set("data", JSON.stringify(data));
    for (const f of files) fd.append("photos", f);
    const r = await fetch("/api/actions/" + uc, { method: "POST", body: fd });
    const result = await r.json();
    if (!r.ok) {
      if (r.status === 401) router.replace("/login");
      const fields = result.error?.fields
        ? " " + Object.values(result.error.fields).flat().join(" ")
        : "";
      throw new Error((result.error?.message ?? "บันทึกไม่ได้") + fields);
    }
    setMessage(result.data.message);
    setResultUrl(result.data.url ?? result.data.path ?? "");
    await reload();
    setCompleted(
      !(
        (uc === "UC-02" && data.mode !== "finish") ||
        (uc === "UC-06" && data.mode === "schedule") ||
        uc === "UC-14" ||
        (uc === "UC-13" && data.mode === "appointment")
      ),
    );
    if (uc === "UC-01" && result.data.unit_id)
      router.push("/home?unit=" + result.data.unit_id);
  };
  const prefer = (items: DataRow[]) =>
    selectedDefect
      ? items.filter((d) => d.defect_id === selectedDefect)
      : items;
  const localJobs = prefer(w.myJobs.filter((d) => d.unit_id === unitId)),
    localNew = prefer(w.newDefects.filter((d) => d.unit_id === unitId));
  const flow = journey(w);
  const unitExtra = { unit_id: unitId },
    roundExtra = { round_id: str(qc?.round_id) },
    qcDefs = w.defects.filter((d) => d.round_id === qc?.round_id),
    handoverDefs = w.defects.filter((d) => d.round_id === hand?.round_id),
    openQc = unit?.status === "IN_QC" && (!qc || qc.status === "OPEN"),
    editable = qcDefs.filter(
      (d) => d.status === "WAITING_ASSIGN" && !qc?.inspection_finished_at,
    ),
    fixed = prefer(qcDefs.filter((d) => d.status === "FIXED")),
    request = w.requests.find((r) => r.status === "SUBMITTED"),
    canCustomer = unit?.status === "IN_INSPECTION" && Boolean(hand);
  const opts = (items: DataRow[], key = "defect_id") =>
    items.map((d) => ({
      value: str(d[key]),
      title:
        key === "round_id"
          ? `${d[key]} · ${d.round_type} · ${d.status}`
          : `${d[key]} · ${d.house_no ? "บ้าน " + d.house_no + " · " : ""}${d.location_pin ?? d.status}`,
    }));
  const actionBase = { run };
  let content: ReactNode;
  switch (screen) {
    case "SCR-01":
      content = (
        <Panel title="ข้อมูลบ้านใหม่">
          <Action {...actionBase} uc="UC-01" title="ลงทะเบียนบ้าน" primary>
            <Select
              name="project_id"
              title="โครงการ"
              items={w.projects.map((p) => ({
                value: str(p.project_id),
                title: str(p.project_name),
              }))}
            />
            <Field name="house_no" title="เลขที่บ้าน" max={20} />
            <Field name="unit_type" title="แบบบ้าน" required={false} max={50} />
          </Action>
        </Panel>
      );
      break;
    case "SCR-02":
      content = (
        <>
          <Panel title="บันทึกการตรวจ QC">
            {openQc && !qc?.inspection_finished_at ? (
              <>
                <Action
                  {...actionBase}
                  uc="UC-02"
                  extra={{ ...unitExtra, mode: "add" }}
                  title="บันทึกจุดที่ต้องแก้ไข"
                  primary
                >
                  <Category />
                  <Field name="location_pin" title="ตำแหน่งที่ต้องแก้" />
                  <Description />
                  <Photos />
                </Action>
                <div className="mt-8 border-t border-base-300 pt-5">
                  <Action
                    {...actionBase}
                    uc="UC-02"
                    extra={{ ...unitExtra, mode: "finish" }}
                    title="เสร็จสิ้นการตรวจ"
                  >
                    <Check
                      required
                      title="ตรวจครบแล้ว เมื่อยืนยันจะเพิ่ม แก้ หรือลบรายการเดิมไม่ได้"
                    />
                  </Action>
                </div>
              </>
            ) : (
              <Empty>
                {qc?.inspection_finished_at
                  ? "บันทึกเสร็จสิ้นการตรวจแล้ว รายการเดิมถูกล็อก"
                  : "เลือกบ้านที่อยู่ระหว่างตรวจ QC"}
              </Empty>
            )}
          </Panel>
          <Panel title="รายการในรอบตรวจ">
            <Defects files={w.files} items={qcDefs} />
          </Panel>
          {editable.length > 0 && (
            <Panel title="แก้ไขหรือลบก่อนเสร็จสิ้นการตรวจ">
              <Action
                {...actionBase}
                uc="UC-02"
                extra={{ mode: "edit" }}
                title="บันทึกการแก้ไข"
              >
                <Select
                  name="defect_id"
                  title="จุดที่ต้องการแก้"
                  items={opts(editable)}
                />
                <Category />
                <Field name="location_pin" title="ตำแหน่งที่แก้ไขแล้ว" />
                <Description />
                <Photos />
              </Action>
              <div className="mt-8 border-t border-base-300 pt-5">
                <Action
                  {...actionBase}
                  uc="UC-02"
                  extra={{ mode: "delete" }}
                  title="ลบจุดที่เลือก"
                >
                  <Select
                    name="defect_id"
                    title="จุดที่จะลบ"
                    items={opts(editable)}
                  />
                  <Check
                    required
                    title="ยืนยันลบจุดและรูปประกอบ รายการนี้จะถูกลบออกจากรอบตรวจ"
                  />
                </Action>
              </div>
              {w.files.some((f) =>
                editable.some((d) => d.defect_id === f.defect_id),
              ) && (
                <div className="mt-8 border-t border-base-300 pt-5">
                  <Action
                    {...actionBase}
                    uc="UC-02"
                    extra={{ mode: "remove-photo" }}
                    title="ลบรูปที่เลือก"
                  >
                    <Select
                      name="defect_id"
                      title="จุดเจ้าของรูป"
                      items={opts(editable)}
                    />
                    <Select
                      name="file_id"
                      title="รูปที่จะลบ"
                      items={w.files
                        .filter((f) =>
                          editable.some((d) => d.defect_id === f.defect_id),
                        )
                        .map((f) => ({
                          value: str(f.file_id),
                          title: `${f.file_id} · ${f.defect_id}`,
                        }))}
                    />
                    <Check required title="ยืนยันลบรูปนี้" />
                  </Action>
                </div>
              )}
            </Panel>
          )}
        </>
      );
      break;
    case "SCR-03": {
      const items = prefer(w.queue.filter((d) => d.unit_id === unitId)).filter(
        (d) =>
          (
            str(d.house_no) +
            str(d.location_pin) +
            str(d.project_name)
          ).includes(search),
      );
      content = (
        <Panel title="งานที่รอช่างรับ">
          {!selectedDefect && (
            <>
              <label htmlFor="queue-search" className="field-label">
                ค้นหางาน
              </label>
              <div className="input mb-6 flex w-full items-center gap-3">
                <Search size={19} aria-hidden="true" />
                <input
                  id="queue-search"
                  type="search"
                  autoComplete="off"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="เลขที่บ้านหรือตำแหน่งที่ต้องแก้"
                  className="min-w-0 grow"
                />
              </div>
            </>
          )}
          {items.length ? (
            <Action
              {...actionBase}
              uc="UC-03"
              extra={selectedDefect ? { defect_ids: [selectedDefect] } : {}}
              title={items.length === 1 ? "รับงานนี้" : "รับงานที่เลือก"}
              primary
            >
              <ul className="divide-y divide-base-300">
                {items.map((d) => (
                  <li key={str(d.defect_id)}>
                    {selectedDefect ? (
                      <div className="py-3">
                        <h3>{str(d.location_pin)}</h3>
                        <p className="text-sm text-muted">
                          {label(categories, d.category)}
                        </p>
                      </div>
                    ) : (
                      <Check
                        name="defect_ids"
                        defaultChecked={
                          items.length === 1 || d.defect_id === selectedDefect
                        }
                        value={str(d.defect_id)}
                        title={`บ้าน ${d.house_no} · ${d.location_pin} · ${label(categories, d.category)} · ${d.defect_id}`}
                      />
                    )}
                    <details className={selectedDefect ? "mb-4" : "mb-4 pl-9"}>
                      <summary className="cursor-pointer py-2 underline underline-offset-4">
                        รายละเอียดและรูปก่อนซ่อม
                      </summary>
                      <p className="whitespace-pre-wrap break-words">
                        {str(d.description) || "ไม่มีรายละเอียดเพิ่มเติม"}
                      </p>
                      <p className="text-sm text-muted">
                        รหัสงาน {str(d.defect_id)}
                      </p>
                      <Files files={w.files} defectId={str(d.defect_id)} />
                    </details>
                  </li>
                ))}
              </ul>
            </Action>
          ) : (
            <Empty>
              {selectedDefect
                ? "ไม่พบงานนี้ในคิวที่รับได้ เปิดรายการงานล่าสุดจากภาพรวมบ้าน"
                : "ไม่มีงานที่ตรงกับการค้นหาหรือประเภทช่างของคุณ"}
            </Empty>
          )}
        </Panel>
      );
      break;
    }
    case "SCR-04":
      content = (
        <>
          <Panel title="บันทึกผลซ่อม">
            {localJobs.length ? (
              <Action
                {...actionBase}
                uc="UC-04"
                title="บันทึกซ่อมเสร็จ"
                primary
              >
                <Select
                  name="defect_id"
                  title="งานที่คุณรับไว้"
                  items={opts(localJobs)}
                />
                <Photos required />
              </Action>
            ) : (
              <Empty>ไม่มีงานที่คุณรับไว้และรอซ่อม</Empty>
            )}
          </Panel>
          <Panel title="งานซ่อมของคุณ">
            <Defects files={w.files} items={localJobs} />
          </Panel>
        </>
      );
      break;
    case "SCR-05":
      content = (
        <>
          <Panel title="งานรอตรวจอนุมัติ">
            <Defects files={w.files} items={fixed} />
          </Panel>
          {fixed.length > 0 && (
            <Panel title="ผลตรวจงานซ่อม">
              <Action
                {...actionBase}
                uc="UC-05"
                extra={{ approve: true }}
                title="อนุมัติงานซ่อม"
                primary
              >
                <Select
                  name="defect_id"
                  title="งานซ่อมที่ตรวจผ่าน"
                  items={opts(fixed)}
                />
              </Action>
              <div className="mt-8 border-t border-base-300 pt-5">
                <Action
                  {...actionBase}
                  uc="UC-05"
                  extra={{ approve: false }}
                  title="ส่งกลับแก้"
                >
                  <Select
                    name="defect_id"
                    title="งานซ่อมที่ไม่ผ่าน"
                    items={opts(fixed)}
                  />
                </Action>
              </div>
            </Panel>
          )}
        </>
      );
      break;
    case "SCR-06":
      content = (
        <>
          <Panel title="นัดตรวจซ้ำและบันทึกผล">
            {qc?.status === "OPEN" ? (
              <Action
                {...actionBase}
                uc="UC-06"
                extra={{ ...roundExtra, mode: "schedule" }}
                title="นัดตรวจซ้ำ"
                primary
              >
                <p className="text-muted">นัดได้เมื่อทุกจุดในรอบตรวจผ่านแล้ว</p>
                <Field name="recheck_date" title="วันที่ตรวจซ้ำ" type="date" />
              </Action>
            ) : qc?.status === "RECHECK_SCHEDULED" ? (
              <>
                <p className="mb-5">
                  นัดวันที่ {str(qc.recheck_date).slice(0, 10)}
                </p>
                <Action
                  {...actionBase}
                  uc="UC-06"
                  extra={{
                    ...roundExtra,
                    mode: "result",
                    recheck_result: "NO_DEFECT",
                  }}
                  title="บันทึกไม่พบจุดที่ต้องแก้"
                  primary
                >
                  <Check
                    required
                    title="ตรวจหน้างานแล้ว ไม่พบจุดที่ต้องแก้ไข"
                  />
                </Action>
                <div className="mt-8 border-t border-base-300 pt-5">
                  <Action
                    {...actionBase}
                    uc="UC-06"
                    extra={{
                      ...roundExtra,
                      mode: "result",
                      recheck_result: "DEFECT_FOUND",
                    }}
                    title="บันทึกจุดใหม่และเปิดรอบซ่อมต่อ"
                  >
                    <Category />
                    <Field name="location_pin" title="ตำแหน่งที่พบจุดใหม่" />
                    <Description />
                    <Photos />
                  </Action>
                </div>
              </>
            ) : (
              <Empty>ไม่มีรอบ QC ที่เปิดอยู่</Empty>
            )}
          </Panel>
          <Panel title="รายการในรอบ">
            <Defects files={w.files} items={qcDefs} />
          </Panel>
        </>
      );
      break;
    case "SCR-07":
      content = (
        <Panel title="รับรองและปิดรอบ QC">
          {qc?.status === "RECHECK_SCHEDULED" &&
          qc.recheck_result === "NO_DEFECT" ? (
            <>
              <Action
                {...actionBase}
                uc="UC-07"
                extra={{ ...roundExtra, is_single_certify: false }}
                title="ปิดรอบด้วยผู้ตรวจร่วม"
                primary
              >
                <Select
                  name="co_inspector_id"
                  title="ผู้ตรวจร่วม"
                  items={w.inspectors
                    .filter((e) => e.employee_id !== qc.inspector_id)
                    .map((e) => ({
                      value: str(e.employee_id),
                      title: str(e.full_name),
                    }))}
                />
                <Check required title="ยืนยันผลตรวจร่วมก่อนปิดรอบ" />
              </Action>
              <div className="mt-8 border-t border-base-300 pt-5">
                <Action
                  {...actionBase}
                  uc="UC-07"
                  extra={{ ...roundExtra, is_single_certify: true }}
                  title="ปิดรอบแบบรับรองคนเดียว"
                >
                  <Check required title="ยืนยันรับรองผลการตรวจคนเดียว" />
                </Action>
              </div>
            </>
          ) : (
            <Empty>ต้องตรวจซ้ำและบันทึกว่าไม่พบจุดที่ต้องแก้ไขก่อนปิดรอบ</Empty>
          )}
        </Panel>
      );
      break;
    case "SCR-08":
      content = (
        <Panel title="พร้อมขาย">
          <p className="mb-5 text-muted">
            เมื่อรอบ QC ปิดแล้วจึงแจ้งฝ่ายขายให้ทำสัญญาและผูกลูกค้าได้
          </p>
          <Action
            {...actionBase}
            uc="UC-08"
            extra={unitExtra}
            title="แจ้งบ้านพร้อมขาย"
            primary
            disabled={
              !unitId ||
              unit?.status !== "IN_QC" ||
              !w.rounds.some(
                (r) => r.round_type === "QC_INTERNAL" && r.status === "CLOSED",
              )
            }
          >
            <Check required title="ตรวจข้อมูลบ้านและการปิดรอบ QC แล้ว" />
          </Action>
        </Panel>
      );
      break;
    case "SCR-09":
      content = (
        <Panel title="ผูกลูกค้าและออกลิงก์">
          {unit?.status === "READY_TO_SELL" ? (
            <Action
              {...actionBase}
              uc="UC-09"
              extra={unitExtra}
              title="ผูกลูกค้าและสร้างลิงก์"
              primary
            >
              <Field
                name="id_card_no"
                title="เลขประจำตัวลูกค้า 13 หลัก"
                max={13}
              />
              <Field name="full_name" title="ชื่อ–นามสกุลลูกค้า" />
              <Field
                name="phone_number"
                title="เบอร์โทรศัพท์"
                type="tel"
                max={10}
              />
              <Field name="email" title="อีเมล" type="email" required={false} />
            </Action>
          ) : unit?.customer_id && unit.status !== "HANDED_OVER" ? (
            <>
              <p className="mb-5">
                ลูกค้า {str(unit.customer_name)} · ลิงก์ใหม่มีอายุ 30 วัน
              </p>
              <Action
                {...actionBase}
                uc="UC-09"
                extra={unitExtra}
                title="สร้างลิงก์ใหม่ให้ลูกค้าเดิม"
                primary
              />
            </>
          ) : (
            <Empty>เลือกบ้านที่พร้อมขายหรือผูกลูกค้าแล้วและยังไม่ส่งมอบ</Empty>
          )}
        </Panel>
      );
      break;
    case "SCR-10":
      content = (
        <Panel title="ความต้องการตรวจก่อนรับมอบ">
          {unit?.status === "CONTRACTED" ? (
            <>
              <p className="mb-5">
                หากต้องการตรวจบ้าน ให้เลือกวันที่สะดวกในแบบยื่นคำขอ
              </p>
              <Link
                href={"/app?screen=SCR-11&unit=" + unitId}
                className="btn btn-primary"
              >
                ต้องการตรวจบ้าน · เลือกวัน
              </Link>
              <div className="mt-8 border-t border-base-300 pt-5">
                <Action
                  {...actionBase}
                  uc="UC-10"
                  extra={{ wants_inspection: false }}
                  title="ยืนยันไม่ต้องการตรวจบ้าน"
                >
                  <Check
                    required
                    title="ฉันไม่ต้องการตรวจก่อนรับมอบ และต้องการไปขั้นเซ็นรับมอบ"
                  />
                </Action>
              </div>
            </>
          ) : (
            <Empty>
              บ้านนี้ตอบความต้องการตรวจแล้ว
              ดูสถานะบ้านด้านบนและเลือกขั้นตอนถัดไปจากเมนู
            </Empty>
          )}
        </Panel>
      );
      break;
    case "SCR-11":
    case "SCR-12":
      content = (
        <Panel
          title={
            screen === "SCR-11" ? "วันที่สะดวกเข้าตรวจ" : "ยื่นคำขอแทนลูกค้า"
          }
        >
          <Action
            {...actionBase}
            uc={screen === "SCR-11" ? "UC-11" : "UC-12"}
            extra={unitExtra}
            title="ยื่นคำขอตรวจบ้าน"
            primary
            disabled={unit?.status !== "CONTRACTED"}
          >
            <Field
              name="preferred_date"
              title="วันที่ต้องการตรวจ"
              type="date"
            />
            <p className="text-muted">ฝ่ายขายจะกำหนดเวลานัดในคำขอนี้อีกครั้ง</p>
          </Action>
          {unit?.status !== "CONTRACTED" && (
            <Empty>ยื่นได้เฉพาะบ้านที่ทำสัญญาแล้วและยังไม่ยื่นคำขอ</Empty>
          )}
        </Panel>
      );
      break;
    case "SCR-13":
      content = (
        <>
          <Panel title="นัดและเปิดรอบตรวจ">
            {request ? (
              <>
                <p className="mb-5">
                  คำขอ {str(request.request_id)} · วันที่ลูกค้าสะดวก{" "}
                  {str(request.preferred_date).slice(0, 10)}
                  <br />
                  นัดปัจจุบัน {when(request.appointment)}
                </p>
                <Action
                  {...actionBase}
                  uc="UC-13"
                  extra={{
                    request_id: request.request_id,
                    mode: "appointment",
                  }}
                  title="บันทึกหรือเลื่อนนัด"
                  primary
                >
                  <Field
                    name="appointment"
                    title="วันและเวลานัด (เวลาไทย)"
                    type="datetime-local"
                  />
                </Action>
                <div className="mt-8 border-t border-base-300 pt-5">
                  <Action
                    {...actionBase}
                    uc="UC-13"
                    extra={{ request_id: request.request_id, mode: "arrival" }}
                    title="บันทึกมาถึงและเปิดรอบตรวจ"
                    disabled={!request.appointment}
                  >
                    <Check required title="ลูกค้ามาถึงบ้านแล้ว" />
                  </Action>
                </div>
              </>
            ) : (
              <Empty>
                ไม่มีคำขอที่รอเข้าตรวจ หากเปิดรอบแล้ว
                ลูกค้าสามารถแจ้งจุดที่ต้องแก้ผ่านลิงก์ของตนได้
              </Empty>
            )}
          </Panel>
          <Panel title="ประวัติคำขอตรวจ">
            <ul className="divide-y divide-base-300">
              {w.requests.map((r) => (
                <li key={str(r.request_id)} className="py-3">
                  {str(r.request_id)} · {str(r.status)}
                  <p className="text-sm text-muted">
                    นัด {when(r.appointment)} · มาถึง {when(r.arrival)}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      );
      break;
    case "SCR-14":
      content = (
        <>
          <Panel title="แจ้งจุดใหม่">
            <Action
              {...actionBase}
              uc="UC-14"
              title="บันทึกจุดที่ต้องแก้ไข"
              primary
              disabled={!canCustomer}
            >
              <fieldset>
                <legend className="field-label">ผู้แจ้ง</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["CUSTOMER", "ลูกค้า"],
                    ["EXTERNAL", "บริษัทตรวจนอก"],
                  ].map(([value, title]) => (
                    <label key={value} className="btn reporter-choice">
                      <input
                        type="radio"
                        name="reported_by_type"
                        value={value}
                        defaultChecked={value === "CUSTOMER"}
                        className="radio radio-sm"
                      />
                      {title}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field name="location_pin" title="ตำแหน่งที่ต้องแก้" />
              <Description />
              <Photos required />
            </Action>
            {!canCustomer && (
              <Empty>แจ้งจุดได้เมื่อฝ่ายขายบันทึกมาถึงและเปิดรอบตรวจแล้ว</Empty>
            )}
          </Panel>
          <Panel title="จุดที่แจ้งในรอบนี้">
            <Defects files={w.files} items={handoverDefs} />
          </Panel>
        </>
      );
      break;
    case "SCR-15":
      content = (
        <>
          <Panel title="จุดใหม่ที่รอแยกประเภท">
            {localNew.length ? (
              <Action {...actionBase} uc="UC-15" title="ส่งเข้าคิวช่าง" primary>
                <Select
                  name="defect_id"
                  title="จุดใหม่"
                  items={opts(localNew)}
                />
                <Category />
                <Field
                  name="target_date"
                  title="เป้าหมายซ่อมเสร็จ"
                  type="date"
                  required={false}
                />
              </Action>
            ) : (
              <Empty />
            )}
          </Panel>
          <Panel title="รายละเอียดจุดใหม่">
            <Defects files={w.files} items={localNew} />
          </Panel>
        </>
      );
      break;
    case "SCR-16":
      content = (
        <Panel title="เอกสารสรุปการซ่อม">
          <Action
            {...actionBase}
            uc="UC-16"
            extra={{ round_id: str(hand?.round_id) }}
            title="สร้างเอกสาร PDF"
            primary
            disabled={
              !hand ||
              !handoverDefs.length ||
              handoverDefs.some(
                (d) => !["FIXED", "VERIFIED"].includes(str(d.status)),
              )
            }
          >
            <p className="text-muted">
              สร้างได้เมื่อทุกจุดในรอบตรวจก่อนรับมอบซ่อมเสร็จแล้ว เอกสาร A4
              แนวตั้งรวมรูปที่อัปโหลดไว้จริง
            </p>
            <Field
              name="title"
              title="ชื่อเอกสาร"
              value="เอกสารสรุปการซ่อมก่อนรับมอบ"
            />
          </Action>
          <Files files={w.files} />
        </Panel>
      );
      break;
    case "SCR-17":
      content = (
        <>
          <Panel title="รายงานติดตามสถานะการซ่อม">
            <p className="mb-3 text-muted">
              ตรวจสถานะและรูปก่อนและหลังซ่อมด้านล่าง
              เลือกเฉพาะจุดซ่อมเสร็จที่ต้องการให้แก้อีกครั้ง
            </p>
            {canCustomer ? (
              <Action
                {...actionBase}
                uc="UC-17"
                extra={{ accept: false }}
                title="ยืนยันไม่ผ่านและส่งกลับแก้"
                reset={false}
              >
                <Defects files={w.files} items={handoverDefs} select />
                <Field
                  name="accept_reason"
                  title="เหตุผลที่ไม่ยอมรับ"
                  max={10000}
                />
              </Action>
            ) : (
              <Defects
                files={w.files}
                items={w.defects.filter((d) =>
                  w.rounds.some(
                    (r) =>
                      r.round_id === d.round_id &&
                      r.round_type === "CUSTOMER_HANDOVER",
                  ),
                )}
              />
            )}
            <Files files={w.files} />
          </Panel>
          {canCustomer && (
            <Panel title="ยอมรับสภาพบ้าน">
              <Action
                {...actionBase}
                uc="UC-17"
                extra={{ accept: true }}
                title="ยืนยันยอมรับสภาพ"
                primary
                disabled={handoverDefs.some(
                  (d) => !["FIXED", "VERIFIED"].includes(str(d.status)),
                )}
              >
                <Check
                  required
                  title="ตรวจครบทุกจุดแล้ว ยอมรับสภาพบ้านเพื่อเข้าสู่ขั้นเซ็นรับมอบ"
                />
              </Action>
            </Panel>
          )}
        </>
      );
      break;
    case "SCR-18":
      content = (
        <>
          <Panel title="ลงลายเซ็นรับมอบ">
            {unit?.status === "HANDED_OVER" ? (
              <>
                <p role="status">
                  เซ็นรับมอบแล้ว เมื่อ {when(unit.handed_over_at)}
                </p>
                <Files files={w.files} />
              </>
            ) : (
              <>
                <Signature
                  run={run}
                  disabled={unit?.status !== "READY_HANDOVER"}
                />
                {unit?.status !== "READY_HANDOVER" && (
                  <Empty>บ้านยังไม่พร้อมรับมอบ กรุณาตรวจขั้นตอนก่อนหน้า</Empty>
                )}
              </>
            )}
          </Panel>
          {unit?.status === "READY_HANDOVER" && (
            <Panel title="แนบลายเซ็นแทนการเขียนบนหน้าจอ">
              <Action
                {...actionBase}
                uc="UC-18"
                title="แนบลายเซ็นและยืนยันรับมอบ"
              >
                <Field
                  name="signature"
                  title="รูปลายเซ็น (1 รูป ไม่เกิน 5 MB)"
                  type="file"
                />
                <Check
                  required
                  title="ฉันยืนยันว่าลายเซ็นนี้เป็นของฉันและยืนยันรับมอบบ้านหลังนี้"
                />
              </Action>
            </Panel>
          )}
        </>
      );
      break;
    default:
      content = <Empty>เลือกขั้นตอนจากเมนู</Empty>;
  }
  return (
    <PickedDefect.Provider value={selectedDefect}>
      <AppFrame identity={identity}>
        <Back href={unitId ? "/home?unit=" + unitId : "/home"}>
          {unit
            ? "กลับไปภาพรวมบ้านเลขที่ " + unit.house_no
            : "กลับไปทะเบียนบ้าน"}
        </Back>
        <div className="flex items-start gap-4">
          <h1 className="page-heading flex-1">{screens[screen]}</h1>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="โหลดข้อมูลล่าสุด"
            disabled={refreshing}
            onClick={reload}
          >
            <RefreshCw
              size={19}
              className={refreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
          </button>
        </div>
        {unit && (
          <section className="border-y border-base-300 py-4">
            <p className="text-lg font-semibold">
              บ้านเลขที่ {str(unit.house_no)}{" "}
              <span className="ml-2 text-sm font-normal">
                {unitStates[str(unit.status)]}
              </span>
            </p>
            <p>{str(unit.project_name)}</p>
            <p className="mt-2 text-sm text-muted">
              {flow.actions.find((a) => a.screen === screen)?.hint ??
                flow.waiting}
            </p>
          </section>
        )}
        {loadError && (
          <p role="alert" className="alert alert-error">
            {loadError}
          </p>
        )}
        {message && (
          <div role="status" className="alert alert-success block">
            <p>{message}</p>
            {resultUrl && (
              <div className="mt-3 space-y-3">
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all underline underline-offset-4"
                >
                  {resultUrl.startsWith("/api/")
                    ? "เปิดเอกสารที่บันทึกแล้ว"
                    : resultUrl}
                </a>
                {!resultUrl.startsWith("/api/") && (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(resultUrl);
                        setMessage("คัดลอกลิงก์แล้ว ส่งให้ลูกค้าเปิดได้");
                      } catch {
                        setMessage("เลือกและคัดลอกลิงก์ด้านบนได้เลย");
                      }
                    }}
                  >
                    คัดลอกลิงก์
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {completed ? (
          <Panel
            title={flow.actions.length ? "ทำอะไรต่อ" : "ส่งต่อขั้นตอนแล้ว"}
          >
            <p className="mb-5 text-muted">{flow.waiting}</p>
            <div className="flex flex-wrap gap-3">
              {flow.actions.map((a, i) => (
                <Link
                  key={a.screen + a.defect}
                  className={"btn " + (i === 0 ? "btn-primary" : "")}
                  href={taskUrl(a, unitId)}
                >
                  {a.title}
                </Link>
              ))}
              <Link
                className="btn"
                href={unitId ? "/home?unit=" + unitId : "/home"}
              >
                ดูภาพรวมบ้าน
              </Link>
            </div>
          </Panel>
        ) : (
          content
        )}
        {!completed && message && screen === "SCR-14" && (
          <Link className="btn" href={"/app?screen=SCR-17&unit=" + unitId}>
            แจ้งครบแล้ว ติดตามการซ่อม
          </Link>
        )}
        <p className="text-sm text-muted">
          ข้อมูลตั้งต้นเป็นข้อมูลสมมติ การยืนยันบันทึกจะเปลี่ยนข้อมูลในระบบจริง
        </p>
      </AppFrame>
    </PickedDefect.Provider>
  );
}
