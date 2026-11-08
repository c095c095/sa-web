import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight } from "lucide-react";
import {
  type DataRow,
  type SessionView,
  screens,
  unitStates,
} from "@/lib/runtime-contracts";
import { taskUrl, type Task } from "@/lib/journey";
import { AppFrame, LinkPending } from "./manage-ui";
import { thaiTime } from "@/lib/display-time";
import {
  housePath,
  workflowPath,
  workflowPaths,
  type ListFilters,
} from "@/lib/routes";
import { RecordsTable } from "./records-table";

export function WorkflowSearch({
  path,
  filters,
  repairs = false,
  choices = [],
}: {
  path: string;
  filters: ListFilters;
  repairs?: boolean;
  choices?: {
    name: "project" | "status" | "category";
    label: string;
    options: [string, string][];
  }[];
}) {
  return (
    <form action={path} className="flex flex-wrap items-end gap-3">
      <label className="grid gap-2">
        {repairs ? "ค้นหางาน" : "ค้นหาบ้านในรายการ"}
        <input
          key={filters.q}
          name="q"
          type="search"
          defaultValue={filters.q}
          className="input"
          placeholder={
            repairs
              ? "เลขบ้าน โครงการ หรือตำแหน่งงาน"
              : "เลขบ้าน โครงการ ลูกค้า หรือสถานะ"
          }
        />
      </label>
      {choices.map(({ name, label, options }) => (
        <div key={name} className="grid min-w-0 max-w-full gap-2">
          <label htmlFor={"workflow-filter-" + name}>{label}</label>
          <select
            id={"workflow-filter-" + name}
            key={filters[name]}
            name={name}
            defaultValue={filters[name] ?? ""}
            className="select max-w-full"
          >
            <option value="">ทั้งหมด</option>
            {filters[name] &&
              !options.some(([value]) => value === filters[name]) && (
                <option value={filters[name]}>ตัวเลือกเดิม</option>
              )}
            {options.map(([value, title]) => (
              <option key={value} value={value}>
                {title}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button className="btn" type="submit">
        ค้นหา
      </button>
      {Object.values(filters).some(Boolean) && (
        <Link href={path} className="btn btn-ghost">
          ล้างตัวกรอง
        </Link>
      )}
    </form>
  );
}

function houseChoices(units: DataRow[]) {
  const projects = [
    ...new Set(units.map((unit) => String(unit.project_name))),
  ].sort((a, b) => a.localeCompare(b, "th"));
  return [
    {
      name: "project" as const,
      label: "โครงการ",
      options: projects.map((project): [string, string] => [project, project]),
    },
    {
      name: "status" as const,
      label: "สถานะบ้าน",
      options: Object.entries(unitStates),
    },
  ];
}

function matchesHouse(unit: DataRow, { q = "", project, status }: ListFilters) {
  if (
    (project && unit.project_name !== project) ||
    (status && unit.status !== status)
  )
    return false;
  return [
    unit.house_no,
    unit.project_name,
    unit.customer_name,
    unitStates[String(unit.status)],
  ]
    .join(" ")
    .toLocaleLowerCase("th")
    .includes(q.trim().toLocaleLowerCase("th"));
}

// The register and the creation form are separate destinations.
export function RegisterLanding({
  identity,
  screen,
  units,
  filters,
}: {
  identity: SessionView;
  screen: string;
  units: DataRow[];
  filters: ListFilters;
}) {
  const matches = units.filter((unit) => matchesHouse(unit, filters));
  return (
    <AppFrame identity={identity} active={screen} title={screens[screen]}>
      <section className="panel-surface p-5 sm:p-7">
        <p className="mb-5">เพิ่มบ้านหลังใหม่เข้าระบบ</p>
        <Link
          href={workflowPath(screen, undefined, undefined, filters)}
          className="btn btn-primary"
        >
          ลงทะเบียนบ้านใหม่
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
      <WorkflowSearch
        path={workflowPaths[screen]}
        filters={filters}
        choices={houseChoices(units)}
      />
      <p className="text-muted">
        แสดง {matches.length} จาก {units.length} หลัง
      </p>
      <RecordsTable
        label="ทะเบียนบ้าน"
        columns={[
          "บ้านเลขที่",
          "โครงการ",
          "สถานะ",
          "วันที่ลงทะเบียน",
          "รายละเอียด",
        ]}
        empty={
          units.length ? "ไม่พบบ้านที่ตรงกับตัวกรอง" : "ยังไม่มีบ้านในทะเบียน"
        }
        rows={matches.map((unit) => ({
          key: String(unit.unit_id),
          cells: [
            unit.house_no,
            unit.project_name,
            unitStates[String(unit.status)] ?? unit.status,
            thaiTime(unit.created_at),
            <Link
              key="house"
              className="btn"
              href={
                housePath(String(unit.unit_id)) +
                "?" +
                new URLSearchParams({
                  from: "register",
                  ...Object.fromEntries(
                    Object.entries(filters).filter(
                      (entry): entry is [string, string] => Boolean(entry[1]),
                    ),
                  ),
                })
              }
            >
              เปิดบ้าน<span className="sr-only"> {unit.house_no}</span>
              <LinkPending />
            </Link>,
          ],
        }))}
      />
    </AppFrame>
  );
}

type Item = { unit: DataRow; task: Task; primary: boolean; context?: string };

function Group({
  list,
  group,
  heading,
  filters,
}: {
  list: Item[];
  group: "primary" | "secondary";
  heading?: string;
  filters: ListFilters;
}) {
  return (
    <section data-group={group} className="space-y-3">
      {heading && <h2 className="text-xl font-semibold">{heading}</h2>}
      <RecordsTable
        label={heading ?? "บ้านในขั้นตอนนี้"}
        columns={["บ้านเลขที่", "โครงการ", "สถานะ", "ขั้นตอนถัดไป"]}
        empty="ไม่มีบ้านในรายการนี้"
        rows={list.map(({ unit, task, context }) => ({
          key: String(unit.unit_id) + task.screen + (task.defect ?? ""),
          cells: [
            unit.house_no,
            <Fragment key="project">
              {unit.project_name}
              {unit.customer_name && (
                <p className="text-muted">{unit.customer_name}</p>
              )}
            </Fragment>,
            unitStates[String(unit.status)] ?? unit.status,
            <Fragment key="action">
              {context && <p className="mb-1 font-medium">{context}</p>}
              {task.hint && (
                <p className="mb-2 max-w-sm text-muted">{task.hint}</p>
              )}
              <Link
                href={taskUrl(task, String(unit.unit_id), filters)}
                className="btn"
              >
                {task.title}
                <span className="sr-only">
                  {" "}
                  บ้านเลขที่ {String(unit.house_no)}
                </span>
                <ArrowRight size={17} aria-hidden="true" />
                <LinkPending />
              </Link>
            </Fragment>,
          ],
        }))}
      />
    </section>
  );
}

// Read-only index. SCR-09 reissues are grouped separately from primary work.
export function TaskLanding({
  identity,
  screen,
  items,
  filters,
}: {
  identity: SessionView;
  screen: string;
  items: Item[];
  filters: ListFilters;
}) {
  const matches = items.filter(({ unit }) => matchesHouse(unit, filters));
  const primary = matches.filter((i) => i.primary);
  const secondary = matches.filter((i) => !i.primary);
  return (
    <AppFrame identity={identity} active={screen} title={screens[screen]}>
      {items.length > 0 ? (
        <>
          <WorkflowSearch
            path={workflowPaths[screen]}
            filters={filters}
            choices={houseChoices(items.map(({ unit }) => unit))}
          />
          <p className="text-muted">
            {matches.length} จาก {items.length} หลัง เลือกบ้านเพื่อเปิดขั้นตอน
          </p>
          {!matches.length && (
            <p className="panel-surface p-5">ไม่พบบ้านที่ตรงกับตัวกรอง</p>
          )}
          {primary.length > 0 && (
            <Group
              list={primary}
              group="primary"
              filters={filters}
              heading={
                secondary.length > 0
                  ? screen === "SCR-16"
                    ? "พร้อมสร้าง PDF"
                    : "ขั้นตอนหลัก"
                  : undefined
              }
            />
          )}
          {secondary.length > 0 && (
            <Group
              list={secondary}
              group="secondary"
              filters={filters}
              heading={
                screen === "SCR-16"
                  ? "ติดตามความคืบหน้าและเอกสารย้อนหลัง"
                  : "ออกลิงก์ใหม่ให้ลูกค้าเดิม"
              }
            />
          )}
        </>
      ) : (
        <section className="panel-surface p-5 sm:p-7">
          <p>ตอนนี้ไม่มีบ้านที่ต้องทำขั้นตอนนี้</p>
          <p className="mt-2 text-sm text-muted">
            เมื่อบ้านถึงขั้นตอนนี้ จะแสดงที่หน้านี้ ดูบ้านทั้งหมดได้ที่{" "}
            <Link href="/" className="link">
              ภาพรวม
            </Link>
          </p>
        </section>
      )}
    </AppFrame>
  );
}
