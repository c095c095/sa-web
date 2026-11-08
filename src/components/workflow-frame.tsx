"use client";
import { useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import {
  type Workspace,
  type DataRow,
  screens,
  unitStates,
} from "@/lib/runtime-contracts";
import { AppFrame, Back } from "./manage-ui";
import { journey, taskUrl } from "@/lib/journey";
import {
  housePath,
  workflowPath,
  workflowPaths,
  withSearch,
  type ListFilters,
} from "@/lib/routes";
import { Panel, PickedDefect, str, type Run } from "./workflows/controls";

export type WorkflowState = {
  w: Workspace;
  unit: Workspace["unit"];
  unitId: string;
  qc: DataRow | undefined;
  hand: DataRow | undefined;
  search: string;
  setSearch: (value: string) => void;
  run: Run;
  selectedDefect: string;
  prefer: (items: DataRow[]) => DataRow[];
  localJobs: DataRow[];
  localNew: DataRow[];
  unitExtra: { unit_id: string };
  roundExtra: { round_id: string };
  qcDefs: DataRow[];
  handoverDefs: DataRow[];
  openQc: boolean;
  editable: DataRow[];
  fixed: DataRow[];
  request: DataRow | undefined;
  canCustomer: boolean;
  opts: (items: DataRow[], key?: string) => { value: string; title: string }[];
  actionBase: { run: Run };
};

export function WorkflowFrame({
  initial,
  Operation,
  screen,
  selectedDefect = "",
  listQuery,
}: {
  initial: Workspace;
  Operation: ComponentType<WorkflowState>;
  screen: string;
  selectedDefect?: string;
  listQuery?: ListFilters;
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
      router.push(housePath(String(result.data.unit_id)));
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
  const state = {
    w,
    unit,
    unitId,
    qc,
    hand,
    search,
    setSearch,
    run,
    selectedDefect,
    prefer,
    localJobs,
    localNew,
    unitExtra,
    roundExtra,
    qcDefs,
    handoverDefs,
    openQc,
    editable,
    fixed,
    request,
    canCustomer,
    opts,
    actionBase,
  };
  return (
    <PickedDefect.Provider value={selectedDefect}>
      <AppFrame identity={identity} active={screen}>
        <div className="flex flex-wrap gap-x-5">
          <Back href={withSearch(workflowPaths[screen], listQuery)}>
            กลับไปรายการงาน
          </Back>
          {unit && (
            <Link
              className="inline-flex min-h-11 items-center link"
              href={housePath(unitId)}
            >
              ภาพรวมบ้านเลขที่ {unit.house_no}
            </Link>
          )}
        </div>
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
          <section className="panel-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">
                  บ้านเลขที่ {str(unit.house_no)}{" "}
                  <span className="ml-2 badge badge-outline font-normal">
                    {unitStates[str(unit.status)]}
                  </span>
                </p>
                <p className="text-sm text-muted">{str(unit.project_name)}</p>
              </div>
            </div>
            <p className="text-sm text-muted border-t border-base-300 pt-3">
              {flow.actions.find((a) => a.screen === screen)?.hint ??
                flow.waiting}
            </p>
            {w.defects.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
                <div className="stat-card">
                  <span className="stat-card-label">จุดที่พบทั้งหมด</span>
                  <span className="stat-card-value">{w.defects.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">รอช่างรับ / ซ่อม</span>
                  <span className="stat-card-value text-warning">
                    {
                      w.defects.filter((d) =>
                        [
                          "NEW",
                          "WAITING_ASSIGN",
                          "ASSIGNED",
                          "REWORK",
                        ].includes(str(d.status)),
                      ).length
                    }
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">ซ่อมเสร็จรอตรวจ</span>
                  <span className="stat-card-value text-info">
                    {w.defects.filter((d) => d.status === "FIXED").length}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">ตรวจผ่านแล้ว</span>
                  <span className="stat-card-value text-success">
                    {w.defects.filter((d) => d.status === "VERIFIED").length}
                  </span>
                </div>
              </div>
            )}
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
              <Link className="btn" href={unitId ? housePath(unitId) : "/"}>
                ดูภาพรวมบ้าน
              </Link>
            </div>
          </Panel>
        ) : (
          <Operation {...state} />
        )}
        {!completed && message && screen === "SCR-14" && (
          <Link className="btn" href={workflowPath("SCR-17", unitId)}>
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
