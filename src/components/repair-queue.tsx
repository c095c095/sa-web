import { Fragment } from "react";
import Link from "next/link";
import { categories, defectStatuses } from "@/lib/domain";
import { screens, type Workspace } from "@/lib/runtime-contracts";
import { workflowPath, workflowPaths, type ListFilters } from "@/lib/routes";
import { thaiTime } from "@/lib/display-time";
import { AppFrame, LinkPending } from "./manage-ui";
import { RecordsTable } from "./records-table";
import { WorkflowSearch } from "./task-landing";

export const statusBadgeMap: Record<string, string> = {
  NEW: "badge-status-new",
  WAITING_ASSIGN: "badge-status-waiting",
  ASSIGNED: "badge-status-assigned",
  FIXED: "badge-status-fixed",
  REWORK: "badge-status-rework",
  VERIFIED: "badge-status-verified",
};

function repairJobs(w: Workspace, screen: string) {
  if (screen === "SCR-04") return w.myJobs;
  if (screen === "SCR-15") return w.newDefects;
  return w.queue;
}

export function RepairTable({
  w,
  screen,
  q,
  filters = {},
}: {
  w: Workspace;
  screen: string;
  q: string;
  filters?: ListFilters;
}) {
  const needle = q.trim().toLocaleLowerCase("th");
  const all = repairJobs(w, screen);
  const jobs = all.filter(
    (d) =>
      (!filters.category ||
        (d.category ?? "uncategorized") === filters.category) &&
      (!filters.status || d.status === filters.status) &&
      [
        d.house_no,
        d.location_pin,
        d.project_name,
        categories[d.category as keyof typeof categories],
        defectStatuses[d.status as keyof typeof defectStatuses],
      ]
        .join(" ")
        .toLocaleLowerCase("th")
        .includes(needle),
  );

  return (
    <>
      <p className="text-muted">
        แสดง {jobs.length} จาก {all.length} งาน
      </p>
      <RecordsTable
        label="คิวงานซ่อม"
        columns={[
          "ตำแหน่ง",
          "บ้านและโครงการ",
          "หมวดหมู่",
          "สถานะ",
          screen === "SCR-04" ? "กำหนดเสร็จ" : "วันที่แจ้ง",
          "ดำเนินการ",
        ]}
        empty={all.length ? "ไม่พบงานที่ตรงกับตัวกรอง" : "ไม่มีงานในรายการนี้"}
        rows={jobs.map((d) => ({
          key: String(d.defect_id),
          cells: [
            <Fragment key="location">
              {d.location_pin}
              <p className="text-sm text-muted">{d.defect_id}</p>
            </Fragment>,
            <Fragment key="house">
              <span className="block">บ้าน {d.house_no}</span>
              {d.project_name}
            </Fragment>,
            categories[d.category as keyof typeof categories] ??
              "ยังไม่แยกประเภท",
            <span
              key="status"
              className={
                "badge " + (statusBadgeMap[String(d.status)] ?? "badge-outline")
              }
            >
              {defectStatuses[d.status as keyof typeof defectStatuses]}
            </span>,
            thaiTime(screen === "SCR-04" ? d.target_date : d.created_at),
            <Link
              key="action"
              className="btn"
              href={workflowPath(
                screen,
                String(d.unit_id),
                String(d.defect_id),
                { ...filters, q },
              )}
            >
              {screen === "SCR-04"
                ? "เปิดงานซ่อม"
                : screen === "SCR-15"
                  ? "แยกประเภท"
                  : "ดูงานและรับงาน"}
              <span className="sr-only">
                {" "}
                {d.location_pin} บ้าน {d.house_no}
              </span>
              <LinkPending />
            </Link>,
          ],
        }))}
      />
    </>
  );
}

export function RepairQueue({
  initial,
  screen,
  filters,
}: {
  initial: Workspace;
  screen: string;
  filters: ListFilters;
}) {
  const jobs = repairJobs(initial, screen);
  const statuses = new Set(jobs.map((job) => job.status));
  return (
    <AppFrame
      identity={initial.identity}
      active={screen}
      title={screens[screen]}
    >
      <WorkflowSearch
        path={workflowPaths[screen]}
        filters={filters}
        repairs
        choices={[
          {
            name: "category",
            label: "หมวดงาน",
            options: [
              ...Object.entries(categories),
              ["uncategorized", "ยังไม่แยกประเภท"],
            ],
          },
          {
            name: "status",
            label: "สถานะงาน",
            options: Object.entries(defectStatuses).filter(([status]) =>
              statuses.has(status),
            ),
          },
        ]}
      />
      <RepairTable
        w={initial}
        screen={screen}
        q={filters.q ?? ""}
        filters={filters}
      />
    </AppFrame>
  );
}
