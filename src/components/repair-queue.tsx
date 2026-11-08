import { Fragment } from "react";
import Link from "next/link";
import { categories, defectStatuses } from "@/lib/domain";
import { screens, type Workspace } from "@/lib/runtime-contracts";
import { workflowPath, workflowPaths } from "@/lib/routes";
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

export function RepairTable({
  w,
  screen,
  q,
}: {
  w: Workspace;
  screen: string;
  q: string;
}) {
  const needle = q.trim().toLocaleLowerCase("th");
  const jobs = (
    screen === "SCR-04"
      ? w.myJobs
      : screen === "SCR-15"
        ? w.newDefects
        : w.queue
  ).filter((d) =>
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
    <RecordsTable
      label="คิวงานซ่อม"
      columns={["ตำแหน่ง", "บ้านและโครงการ", "หมวดหมู่", "สถานะ", "ดำเนินการ"]}
      empty={q ? "ไม่พบงานที่ตรงกับการค้นหา" : "ไม่มีงานในรายการนี้"}
      rows={jobs.map((d) => ({
        key: String(d.defect_id),
        cells: [
          d.location_pin,
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
          <Link
            key="action"
            className="btn"
            href={workflowPath(
              screen,
              String(d.unit_id),
              String(d.defect_id),
              q,
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
  );
}

export function RepairQueue({
  initial,
  screen,
  query,
}: {
  initial: Workspace;
  screen: string;
  query: string;
}) {
  return (
    <AppFrame
      identity={initial.identity}
      active={screen}
      title={screens[screen]}
    >
      <WorkflowSearch path={workflowPaths[screen]} query={query} repairs />
      <RepairTable w={initial} screen={screen} q={query} />
    </AppFrame>
  );
}
