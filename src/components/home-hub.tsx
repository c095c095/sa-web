"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { type Workspace, unitStates } from "@/lib/runtime-contracts";
import { categories, defectStatuses } from "@/lib/domain";
import { journey, taskUrl } from "@/lib/journey";
import { buildAppPath, type DeepLink } from "@/lib/deep-link";
import { AppFrame, Panel, Back, string, thaiTime } from "./manage-ui";
import { Search, ArrowRight } from "lucide-react";
export function HomeHub({
  initial,
  selected = false,
  deepLink = null,
}: {
  initial: Workspace;
  selected?: boolean;
  deepLink?: DeepLink | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState(""),
    [tab, setTab] = useState(
      initial.identity.kind === "EMPLOYEE" &&
        initial.identity.role === "HEAD_TECHNICIAN" &&
        initial.newDefects.length
        ? "new"
        : initial.myJobs.length
          ? "mine"
          : "queue",
    );
  const w = initial,
    role = w.identity.kind === "CUSTOMER" ? "CUSTOMER" : w.identity.role,
    tech = role === "TECHNICIAN" || role === "HEAD_TECHNICIAN",
    flow = journey(w),
    unit = w.unit;
  const filtered = w.units.filter((u) =>
    (string(u.house_no) + string(u.project_name) + string(u.customer_name))
      .toLocaleLowerCase()
      .includes(q.toLocaleLowerCase()),
  );
  const jobs = (
    tab === "mine" ? w.myJobs : tab === "new" ? w.newDefects : w.queue
  ).filter((d) =>
    (string(d.house_no) + string(d.location_pin) + string(d.project_name))
      .toLocaleLowerCase()
      .includes(q.toLocaleLowerCase()),
  );
  return (
    <AppFrame
      identity={w.identity}
      title={
        selected && unit
          ? "บ้านเลขที่ " + unit.house_no
          : tech
            ? "งานของฉัน"
            : "ทะเบียนบ้านและงานที่ต้องทำ"
      }
    >
      <div className="flex justify-end">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.refresh()}
        >
          อัปเดตสถานะ
        </button>
      </div>
      {selected && unit ? (
        <>
          <Back />
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
            <div className="grid gap-5 sm:grid-cols-3">
              {Object.entries(defectStatuses).map(([code, label]) => {
                const n = w.defects.filter((d) => d.status === code).length;
                return n ? (
                  <div key={code}>
                    <p className="text-muted">{label}</p>
                    <p className="text-2xl font-semibold">{n} จุด</p>
                  </div>
                ) : null;
              })}
            </div>
            {!w.defects.length && (
              <p className="text-muted">ยังไม่มีรายการจุดที่ต้องแก้ไขในระบบ</p>
            )}
            {w.requests[0] && (
              <p className="mt-5">
                นัดตรวจ {thaiTime(w.requests[0].appointment)}
              </p>
            )}
          </Panel>
          <details className="rounded-box border border-base-300 bg-base-100 p-5">
            <summary className="cursor-pointer font-medium">
              ดูประวัติและรายการจุด
            </summary>
            <ul className="mt-4 divide-y divide-base-300">
              {w.defects.map((d) => (
                <li
                  key={string(d.defect_id)}
                  className="flex flex-wrap justify-between gap-3 py-3"
                >
                  <span>
                    {string(d.location_pin)}
                    <span className="ml-2 text-sm text-muted">
                      {categories[d.category as keyof typeof categories] ??
                        "รอแยกประเภท"}
                    </span>
                  </span>
                  <span className="badge badge-outline">
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
                onChange={(e) => setQ(e.target.value)}
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
              <ul className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100 px-5">
                {jobs.map((d) => (
                  <li
                    key={string(d.defect_id)}
                    className="flex flex-wrap items-center justify-between gap-4 py-5"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg">{string(d.location_pin)}</h2>
                      <p>
                        บ้าน {string(d.house_no)} · {string(d.project_name)}
                      </p>
                      <p className="text-sm text-muted">
                        {categories[d.category as keyof typeof categories] ??
                          "ยังไม่แยกประเภท"}{" "}
                        ·{" "}
                        {
                          defectStatuses[
                            d.status as keyof typeof defectStatuses
                          ]
                        }
                      </p>
                    </div>
                    <Link
                      className="btn"
                      href={taskUrl(
                        {
                          screen:
                            tab === "mine"
                              ? "SCR-04"
                              : tab === "new"
                                ? "SCR-15"
                                : "SCR-03",
                          title: "",
                          hint: "",
                          defect: string(d.defect_id),
                        },
                        string(d.unit_id),
                      )}
                    >
                      {tab === "mine"
                        ? "เปิดงานซ่อม"
                        : tab === "new"
                          ? "แยกประเภท"
                          : "ดูงานและรับงาน"}
                    </Link>
                  </li>
                ))}
                {!jobs.length && (
                  <li className="py-8 text-muted">
                    ไม่มีงานในรายการนี้
                    {tab === "mine" &&
                      w.queue.length > 0 &&
                      " เลือกงานที่รับได้เพื่อเริ่มงานใหม่"}
                  </li>
                )}
              </ul>
            </>
          ) : (
            <>
            {deepLink && !selected && (
              <p className="alert" role="status">
                เลือกบ้านก่อน แล้วจึงจะส่งลิงก์ได้
              </p>
            )}
            <ul className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100 px-5">
              {filtered.map((u) => (
                <li
                  key={string(u.unit_id)}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg">บ้านเลขที่ {string(u.house_no)}</h2>
                    <p>{string(u.project_name)}</p>
                    <p className="text-sm text-muted">
                      {unitStates[string(u.status)]}
                      {u.customer_name ? " · " + u.customer_name : ""}
                    </p>
                  </div>
                  <Link
                    href={
                      deepLink && !selected
                        ? buildAppPath(deepLink, string(u.unit_id))
                        : "/home?unit=" + u.unit_id
                    }
                    className="btn"
                  >
                    เปิดบ้าน
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </li>
              ))}
              {!filtered.length && (
                <li className="py-8 text-muted">ไม่พบบ้านที่ตรงกับการค้นหา</li>
              )}
            </ul>
            </>
          )}
        </>
      )}
    </AppFrame>
  );
}
