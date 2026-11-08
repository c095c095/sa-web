"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  type DataRow,
  type SessionView,
  screens,
  unitStates,
} from "@/lib/runtime-contracts";
import { taskUrl, type Task } from "@/lib/journey";
import { AppFrame, string } from "./manage-ui";

// Decision 2: the landing page of "register a house" (SCR-01). One call to
// action into the existing registration flow. No house is chosen first, no list.
export function RegisterLanding({
  identity,
  screen,
}: {
  identity: SessionView;
  screen: string;
}) {
  return (
    <AppFrame identity={identity} active={screen} title={screens[screen]}>
      <section className="panel-surface p-5 sm:p-7">
        <p className="mb-5">เพิ่มบ้านหลังใหม่เข้าระบบ</p>
        <Link href={"/app?screen=" + screen} className="btn btn-primary">
          ลงทะเบียนบ้านใหม่
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </AppFrame>
  );
}

type Item = { unit: DataRow; task: Task; primary: boolean };

function Group({
  list,
  group,
  heading,
}: {
  list: Item[];
  group: "primary" | "secondary";
  heading?: string;
}) {
  const Title = heading ? "h3" : "h2";
  return (
    <section data-group={group} className="space-y-3">
      {heading && <h2 className="text-xl font-semibold">{heading}</h2>}
      <ul className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100 px-5">
        {list.map(({ unit, task }) => (
          <li
            key={string(unit.unit_id) + task.screen + (task.defect ?? "")}
            className="flex flex-wrap items-center justify-between gap-4 py-5"
          >
            <div className="min-w-0 flex-1">
              <Title className="text-lg">บ้านเลขที่ {string(unit.house_no)}</Title>
              <p>{string(unit.project_name)}</p>
              <p className="text-sm text-muted">
                {unitStates[string(unit.status)]}
                {unit.customer_name ? " · " + unit.customer_name : ""}
              </p>
              <p className="mt-1 text-sm text-muted">{task.hint}</p>
            </div>
            <Link
              href={taskUrl(task, string(unit.unit_id))}
              className={group === "primary" ? "btn btn-primary" : "btn"}
            >
              {task.title}
              <span className="sr-only"> บ้านเลขที่ {string(unit.house_no)}</span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Phase 2A: the page a menu item opens. It lists the houses that are at this
// step and links each one to the action page. It has no form and changes nothing.
// Rows that are not the primary step (SCR-09 re-issue, Decision 1) form a second group.
export function TaskLanding({
  identity,
  screen,
  items,
}: {
  identity: SessionView;
  screen: string;
  items: Item[];
}) {
  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);
  return (
    <AppFrame identity={identity} active={screen} title={screens[screen]}>
      {items.length > 0 ? (
        <>
          <p className="text-muted">
            {secondary.length > 0
              ? "เลือกบ้านเพื่อเริ่มทำงาน"
              : `บ้านที่ต้องทำขั้นตอนนี้ตอนนี้ ${items.length} หลัง เลือกบ้านเพื่อเริ่มทำงาน`}
          </p>
          {primary.length > 0 && (
            <Group
              list={primary}
              group="primary"
              heading={secondary.length > 0 ? "ขั้นตอนหลัก" : undefined}
            />
          )}
          {secondary.length > 0 && (
            <Group
              list={secondary}
              group="secondary"
              heading="ออกลิงก์ใหม่ให้ลูกค้าเดิม"
            />
          )}
        </>
      ) : (
        <section className="panel-surface p-5 sm:p-7">
          <p>ตอนนี้ไม่มีบ้านที่ต้องทำขั้นตอนนี้</p>
          <p className="mt-2 text-sm text-muted">
            เมื่อบ้านถึงขั้นตอนนี้ จะแสดงที่หน้านี้ ดูบ้านทั้งหมดได้ที่{" "}
            <Link href="/home" className="link">
              งานของฉัน
            </Link>
          </p>
        </section>
      )}
    </AppFrame>
  );
}
