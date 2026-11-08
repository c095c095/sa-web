"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import {
  roleLabels,
  type Workspace,
  unitStates,
} from "@/lib/runtime-contracts";
import { categories, defectStatuses } from "@/lib/domain";
import { journey, taskUrl } from "@/lib/journey";
import {
  housePath,
  withSearch,
  workflowPath,
  workflowPaths,
} from "@/lib/routes";
import { screens } from "@/lib/runtime-contracts";
import { RepairTable, statusBadgeMap } from "./repair-queue";
import {
  AppFrame,
  Panel,
  Back,
  LinkPending,
  buildNav,
  string,
  thaiTime,
} from "./manage-ui";
import { RecordsTable } from "./records-table";
import { Search, ArrowRight } from "lucide-react";
export function HomeHub({
  initial,
  selected = false,
  backPath = "/",
  workCounts = {},
}: {
  initial: Workspace;
  selected?: boolean;
  backPath?: string;
  workCounts?: Record<string, number>;
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
  const isHead =
    initial.identity.kind === "EMPLOYEE" &&
    initial.identity.role === "HEAD_TECHNICIAN";
  const requestedTab = search.get("tab");
  const validTab =
    requestedTab === "mine" ||
    requestedTab === "queue" ||
    (isHead && requestedTab === "new");
  const defaultTab =
    isHead && initial.newDefects.length
      ? "new"
      : initial.myJobs.length
        ? "mine"
        : "queue";
  const tab = (validTab ? requestedTab : null) ?? defaultTab;
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
  const overview = w.identity.kind === "CUSTOMER" || !selected;
  const priorities = tech
    ? ([
        [
          "SCR-04",
          w.myJobs.filter((job) => job.status === "REWORK").length,
          "งานแก้ซ้ำของฉัน",
          "REWORK",
        ],
        ["SCR-04", w.myJobs.length, "งานซ่อมของฉัน", ""],
        ["SCR-15", w.newDefects.length, "งานรอแยกประเภท", ""],
        ["SCR-03", w.queue.length, "งานที่รับได้", ""],
      ] as const)
    : (role === "INSPECTOR"
        ? ["SCR-05", "SCR-06", "SCR-07", "SCR-16", "SCR-02", "SCR-08"]
        : ["SCR-13", "SCR-09", "SCR-12"]
      ).map(
        (screen) =>
          [screen, workCounts[screen] ?? 0, screens[screen], ""] as const,
      );
  const actionable = priorities.filter(([, count]) => count > 0);
  const latestRequest = w.requests[0];
  const milestones = [
    { title: "ลงทะเบียนบ้าน", date: unit?.created_at },
    ...w.rounds.flatMap((round) => {
      const title =
        round.round_type === "QC_INTERNAL" ? "รอบ QC" : "รอบตรวจก่อนรับมอบ";
      return [
        { title: "เปิด" + title, date: round.started_at },
        { title: "ปิด" + title, date: round.closed_at },
      ];
    }),
    ...w.requests.flatMap((request) => [
      { title: "ส่งคำขอตรวจ", date: request.created_at },
      { title: "มาถึงเพื่อตรวจบ้าน", date: request.arrival },
    ]),
    { title: "ลงนามรับมอบ", date: unit?.handed_over_at },
  ]
    .filter((event) => event.date)
    .sort((a, b) => string(b.date).localeCompare(string(a.date)));
  const filtered = w.units.filter((u) =>
    [u.house_no, u.project_name, u.customer_name, unitStates[string(u.status)]]
      .join(" ")
      .toLocaleLowerCase("th")
      .includes(needle),
  );
  return (
    <AppFrame
      identity={w.identity}
      title={
        selected && unit && w.identity.kind === "EMPLOYEE"
          ? "บ้านเลขที่ " + unit.house_no
          : "ภาพรวม"
      }
    >
      {overview && (
        <section
          className="panel-surface space-y-4 p-5 sm:p-7"
          aria-labelledby="overview-title"
        >
          <div>
            <h2 id="overview-title" className="text-xl font-semibold">
              {w.identity.kind === "EMPLOYEE"
                ? roleLabels[w.identity.role]
                : "บ้านของคุณ"}
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
            <div>
              <h3 className="text-lg font-semibold">งานที่ต้องดูตอนนี้</h3>
              {actionable.length ? (
                <ul className="mt-2 divide-y divide-base-300">
                  {actionable.map(([screen, count, label, status]) => (
                    <li key={label}>
                      <Link
                        href={withSearch(workflowPaths[screen], { status })}
                        className="flex min-h-11 items-center justify-between gap-3 py-2 link"
                      >
                        {label}
                        <span className="badge badge-outline">
                          {count} {tech ? "จุด" : "หลัง"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted">
                  ตอนนี้ไม่มีงานที่รอให้คุณดำเนินการ
                </p>
              )}
            </div>
          )}
          {w.identity.kind === "EMPLOYEE" && (
            <ul className="grid gap-x-6 border-b border-base-300 sm:grid-cols-2">
              {buildNav(w.identity)
                .filter((item) => item.key !== "home")
                .map((item) => (
                  <li key={item.key} className="border-t border-base-300">
                    <Link
                      className="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline"
                      href={item.href}
                    >
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
          {w.identity.kind === "EMPLOYEE" && (
            <Back
              href={withSearch(backPath, {
                q,
                project: search.get("project") ?? "",
                status: search.get("status") ?? "",
              })}
            />
          )}
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
                    <span className="stat-card-value">
                      {n}{" "}
                      <span className="text-sm font-normal text-muted">
                        จุด
                      </span>
                    </span>
                  </div>
                ) : null;
              })}
            </div>
            {!w.defects.length && (
              <p className="text-muted">ยังไม่มีรายการจุดที่ต้องแก้ไขในระบบ</p>
            )}
          </Panel>
          {latestRequest && (
            <Panel title="คำขอตรวจล่าสุด">
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-muted">เลขคำขอ</dt>
                  <dd>{latestRequest.request_id}</dd>
                </div>
                <div>
                  <dt className="text-muted">วันที่ขอตรวจ</dt>
                  <dd>{thaiTime(latestRequest.preferred_date)}</dd>
                </div>
                <div>
                  <dt className="text-muted">วันนัดที่ยืนยัน</dt>
                  <dd>
                    {latestRequest.appointment
                      ? thaiTime(latestRequest.appointment)
                      : "รอยืนยันวันนัด"}
                  </dd>
                </div>
              </dl>
            </Panel>
          )}
          {milestones.length > 0 && (
            <Panel title="เหตุการณ์ล่าสุดของบ้าน">
              <ol className="divide-y divide-base-300">
                {milestones.slice(0, 5).map(({ title, date }, index) => (
                  <li
                    key={title + string(date) + index}
                    className="flex flex-wrap justify-between gap-x-4 py-3"
                  >
                    <span>{title}</span>
                    <span className="text-muted">{thaiTime(date)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
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
                  <span
                    className={`badge ${statusBadgeMap[string(d.status)] ?? "badge-outline"}`}
                  >
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
              <Link href={workflowPath("SCR-01")} className="btn btn-primary">
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
              <RepairTable
                w={w}
                screen={
                  tab === "mine"
                    ? "SCR-04"
                    : tab === "new"
                      ? "SCR-15"
                      : "SCR-03"
                }
                q={q}
              />
            </>
          ) : (
            <>
              <RecordsTable
                label="ทะเบียนบ้าน"
                columns={[
                  "บ้านเลขที่",
                  "โครงการ",
                  "ลูกค้า",
                  "สถานะ",
                  "ดำเนินการ",
                ]}
                empty={
                  q
                    ? "ไม่พบบ้านที่ตรงกับการค้นหา"
                    : "ยังไม่มีบ้านในทะเบียนที่คุณเข้าถึงได้"
                }
                rows={filtered.map((u) => ({
                  key: string(u.unit_id),
                  cells: [
                    u.house_no,
                    u.project_name,
                    u.customer_name ?? "ยังไม่ระบุ",
                    unitStates[string(u.status)] ?? u.status,
                    <Link
                      key="action"
                      className="btn"
                      href={housePath(string(u.unit_id), q)}
                    >
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
