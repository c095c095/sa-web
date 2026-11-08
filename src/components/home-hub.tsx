"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useTransition } from "react";
import Link from "next/link";
import { roleLabels, type Workspace, unitStates } from "@/lib/runtime-contracts";
import { categories, defectStatuses } from "@/lib/domain";
import { journey, taskUrl } from "@/lib/journey";
import { buildAppPath, type DeepLink } from "@/lib/deep-link";
import { AppFrame, Panel, Back, LinkPending, buildNav, string, thaiTime } from "./manage-ui";
import { RecordsTable } from "./records-table";
import { Search, ArrowRight } from "lucide-react";
const statusBadgeMap: Record<string, string> = {
  NEW: "badge-status-new",
  WAITING_ASSIGN: "badge-status-waiting",
  ASSIGNED: "badge-status-assigned",
  FIXED: "badge-status-fixed",
  REWORK: "badge-status-rework",
  VERIFIED: "badge-status-verified",
};

export function HomeHub({
  initial,
  selected = false,
  deepLink = null,
  active,
  title,
  initialTab,
}: {
  initial: Workspace;
  selected?: boolean;
  deepLink?: DeepLink | null;
  // Phase 2A: set when a technician menu item opens this view (/tasks/SCR-XX).
  active?: string;
  title?: string;
  initialTab?: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const search = useSearchParams();
  const q = search.get("q") ?? "";
  const needle = q.trim().toLocaleLowerCase("th");
  function setQuery(value: string) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("q", value);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }
  const isHead = initial.identity.kind === "EMPLOYEE" && initial.identity.role === "HEAD_TECHNICIAN";
  const requestedTab = search.get("tab");
  const validTab = requestedTab === "mine" || requestedTab === "queue" || (isHead && requestedTab === "new");
  const defaultTab = isHead && initial.newDefects.length ? "new" : initial.myJobs.length ? "mine" : "queue";
  const tab = (validTab ? requestedTab : null) ?? initialTab ?? defaultTab;
  function setTab(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url);
  }
  const w = initial,
    role = w.identity.kind === "CUSTOMER" ? "CUSTOMER" : w.identity.role,
    tech = role === "TECHNICIAN" || role === "HEAD_TECHNICIAN",
    flow = journey(w),
    unit = w.unit;
  const overview = !active && !deepLink && !search.has("unit");
  const filtered = w.units.filter((u) =>
    [u.house_no, u.project_name, u.customer_name, unitStates[string(u.status)]]
      .join(" ").toLocaleLowerCase("th").includes(needle),
  );
  const jobs = (
    tab === "mine" ? w.myJobs : tab === "new" ? w.newDefects : w.queue
  ).filter((d) =>
    [d.house_no, d.location_pin, d.project_name, categories[d.category as keyof typeof categories],
      defectStatuses[d.status as keyof typeof defectStatuses]]
      .join(" ").toLocaleLowerCase("th").includes(needle),
  );
  return (
    <AppFrame
      identity={w.identity}
      active={active}
      title={
        title ??
        (overview ? "ภาพรวม" : selected && unit
          ? "บ้านเลขที่ " + unit.house_no
          : tech
            ? "งานของฉัน"
            : "ทะเบียนบ้านและงานที่ต้องทำ")
      }
    >
      {overview && (
        <section className="panel-surface space-y-4 p-5 sm:p-7" aria-labelledby="overview-title">
          <div>
            <h2 id="overview-title" className="text-xl font-semibold">
              {w.identity.kind === "EMPLOYEE" ? roleLabels[w.identity.role] : "บ้านของคุณ"}
            </h2>
            <p className="mt-1 text-muted">
              {tech
                ? `งานที่รับไว้ ${w.myJobs.length} รายการ และงานที่รับได้ ${w.queue.length} รายการ`
                : w.identity.kind === "CUSTOMER"
                  ? flow.waiting
                  : `มีบ้านในทะเบียนที่คุณเข้าถึงได้ ${w.units.length} หลัง`}
            </p>
          </div>
          {w.identity.kind === "EMPLOYEE" && (
            <ul className="grid gap-x-6 border-b border-base-300 sm:grid-cols-2">
              {buildNav(w.identity).filter((item) => item.key !== "home").map((item) => (
                <li key={item.key} className="border-t border-base-300">
                  <Link className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline" href={item.href}>
                    {item.label}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
        >
          {refreshing ? "กำลังอัปเดตสถานะ…" : "อัปเดตสถานะ"}
        </button>
      </div>
      {selected && unit ? (
        <>
          {w.identity.kind === "EMPLOYEE" && <Back href={q ? "/home?q=" + encodeURIComponent(q) : "/home"} />}
          <div className="border-y border-base-300 py-5">
            <p className="text-lg">{string(unit.project_name)}</p>
            <p className="mt-1 font-medium">
              {unitStates[string(unit.status)]}
            </p>
            {unit.customer_name && (
              <p className="text-muted">ลูกค้า {string(unit.customer_name)}</p>
            )}
          </div>
          <Panel
            title={
              flow.actions.length ? "งานที่ทำได้ตอนนี้" : "กำลังรอขั้นตอนถัดไป"
            }
          >
            <p className="mb-5 text-muted">{flow.waiting}</p>
            {flow.actions.length > 0 && (
              <ul className="divide-y divide-base-300">
                {flow.actions.map((a, i) => (
                  <li
                    key={a.screen + a.defect}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3>{a.title}</h3>
                      <p className="mt-1 text-sm text-muted">{a.hint}</p>
                    </div>
                    <Link
                      href={taskUrl(a, string(unit.unit_id))}
                      className={`btn ${i === 0 ? "btn-primary" : ""}`}
                    >
                      {i === 0 ? "เริ่มทำงานนี้" : "เปิดขั้นตอน"}
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="ความคืบหน้าของบ้าน">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(defectStatuses).map(([code, label]) => {
                const n = w.defects.filter((d) => d.status === code).length;
                return n ? (
                  <div key={code} className="stat-card">
                    <span className="stat-card-label">{label}</span>
                    <span className="stat-card-value">{n} <span className="text-sm font-normal text-muted">จุด</span></span>
                  </div>
                ) : null;
              })}
            </div>
            {!w.defects.length && (
              <p className="text-muted">ยังไม่มีรายการจุดที่ต้องแก้ไขในระบบ</p>
            )}
            {w.requests[0] && (
              <p className="mt-5 text-sm">
                นัดตรวจ {thaiTime(w.requests[0].appointment)}
              </p>
            )}
          </Panel>
          <details className="panel-surface p-5">
            <summary className="cursor-pointer font-medium">
              ดูประวัติและรายการจุด
            </summary>
            <ul className="mt-4 divide-y divide-base-300">
              {w.defects.map((d) => (
                <li
                  key={string(d.defect_id)}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <span>
                    {string(d.location_pin)}
                    <span className="ml-2 text-sm text-muted">
                      {categories[d.category as keyof typeof categories] ??
                        "รอแยกประเภท"}
                    </span>
                  </span>
                  <span className={`badge ${statusBadgeMap[string(d.status)] ?? "badge-outline"}`}>
                    {defectStatuses[d.status as keyof typeof defectStatuses]}
                  </span>
                </li>
              ))}
            </ul>
            {w.rounds.map((r) => (
              <p key={string(r.round_id)} className="mt-4 text-sm text-muted">
                {r.round_type === "QC_INTERNAL" ? "ตรวจ QC" : "ตรวจก่อนรับมอบ"}{" "}
                ·{" "}
                {r.status === "CLOSED"
                  ? "ปิดรอบแล้ว"
                  : r.status === "RECHECK_SCHEDULED"
                    ? "นัดตรวจซ้ำแล้ว"
                    : "เปิดรอบอยู่"}{" "}
                · เริ่ม {thaiTime(r.started_at)}
              </p>
            ))}
          </details>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-xl text-muted">
              {tech
                ? "เปิดงานที่คุณรับไว้ หรือเลือกงานใหม่ที่รับได้ ระบบจะพาไปขั้นตอนที่เกี่ยวข้อง"
                : "เลือกบ้านหนึ่งหลัง ระบบจะแสดงงานที่ต้องทำและฝ่ายที่กำลังดำเนินการ"}
            </p>
            {role === "SALES" && (
              <Link href="/app?screen=SCR-01" className="btn btn-primary">
                เพิ่มบ้าน
              </Link>
            )}
          </div>
          <div>
            <label htmlFor="hub-search" className="field-label">
              {tech ? "ค้นหางาน" : "ค้นหาบ้าน"}
            </label>
            <div className="input flex w-full items-center gap-3">
              <Search size={18} aria-hidden="true" />
              <input
                id="hub-search"
                className="min-w-0 grow"
                value={q}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="เลขบ้าน ชื่อโครงการ หรือตำแหน่งงาน"
              />
            </div>
          </div>
          {tech ? (
            <>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="ประเภทคิวงาน"
              >
                {[
                  ["mine", `งานที่รับไว้ (${w.myJobs.length})`],
                  ["queue", `งานที่รับได้ (${w.queue.length})`],
                  ...(role === "HEAD_TECHNICIAN"
                    ? [["new", `รอแยกประเภท (${w.newDefects.length})`]]
                    : []),
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn ${tab === value ? "bg-neutral text-neutral-content" : ""}`}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <RecordsTable
                label="คิวงานซ่อม"
                columns={["ตำแหน่ง", "บ้านและโครงการ", "หมวดหมู่", "สถานะ", "ดำเนินการ"]}
                empty={q ? "ไม่พบงานที่ตรงกับการค้นหา" : "ไม่มีงานในรายการนี้"}
                rows={jobs.map((d) => ({
                  key: string(d.defect_id),
                  cells: [
                    d.location_pin,
                    <Fragment key="house"><span className="block">บ้าน {d.house_no}</span>{d.project_name}</Fragment>,
                    categories[d.category as keyof typeof categories] ?? "ยังไม่แยกประเภท",
                    <span key="status" className={"badge " + (statusBadgeMap[string(d.status)] ?? "badge-outline")}>
                      {defectStatuses[d.status as keyof typeof defectStatuses]}
                    </span>,
                    <Link key="action" className="btn" href={buildAppPath({
                      screen: tab === "mine" ? "SCR-04" : tab === "new" ? "SCR-15" : "SCR-03",
                      defect: string(d.defect_id),
                    }, string(d.unit_id)) + (q ? "&q=" + encodeURIComponent(q) : "")}>
                      {tab === "mine" ? "เปิดงานซ่อม" : tab === "new" ? "แยกประเภท" : "ดูงานและรับงาน"}
                      <span className="sr-only"> {d.location_pin} บ้าน {d.house_no}</span>
                      <LinkPending />
                    </Link>,
                  ],
                }))}
              />
            </>
          ) : (
            <>
            {deepLink && !selected && (
              <p className="alert" role="status">
                เลือกบ้านก่อน แล้วจึงจะส่งลิงก์ได้
              </p>
            )}
            <RecordsTable
              label="ทะเบียนบ้าน"
              columns={["บ้านเลขที่", "โครงการ", "ลูกค้า", "สถานะ", "ดำเนินการ"]}
              empty={q ? "ไม่พบบ้านที่ตรงกับการค้นหา" : "ยังไม่มีบ้านในทะเบียนที่คุณเข้าถึงได้"}
              rows={filtered.map((u) => ({
                key: string(u.unit_id),
                cells: [
                  u.house_no,
                  u.project_name,
                  u.customer_name ?? "ยังไม่ระบุ",
                  unitStates[string(u.status)] ?? u.status,
                  <Link key="action" className="btn" href={deepLink
                    ? buildAppPath(deepLink, string(u.unit_id))
                    : "/home?" + new URLSearchParams({ unit: string(u.unit_id), ...(q ? { q } : {}) }).toString()}>
                    เปิดบ้าน<span className="sr-only"> {u.house_no}</span>
                    <LinkPending />
                  </Link>,
                ],
              }))}
            />
            </>
          )}
        </>
      )}
    </AppFrame>
  );
}
