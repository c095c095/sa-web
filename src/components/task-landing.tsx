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
import { RecordsTable } from "./records-table";

// The register and the creation form are separate destinations.
export function RegisterLanding({
  identity,
  screen,
  units,
}: {
  identity: SessionView;
  screen: string;
  units: DataRow[];
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
      <RecordsTable
        label="ทะเบียนบ้าน"
        columns={["บ้านเลขที่", "โครงการ", "สถานะ", "รายละเอียด"]}
        empty="ยังไม่มีบ้านในทะเบียน"
        rows={units.map((unit) => ({
          key: String(unit.unit_id),
          cells: [
            unit.house_no,
            unit.project_name,
            unitStates[String(unit.status)] ?? unit.status,
            <Link key="house" className="btn" href={"/home?unit=" + encodeURIComponent(String(unit.unit_id))}>
              เปิดบ้าน<span className="sr-only"> {unit.house_no}</span>
              <LinkPending />
            </Link>,
          ],
        }))}
      />
    </AppFrame>
  );
}

type Item = { unit: DataRow; task: Task; primary: boolean };

function Group({
  list,
  group,
  heading,
  query,
}: {
  list: Item[];
  group: "primary" | "secondary";
  heading?: string;
  query: string;
}) {
  return (
    <section data-group={group} className="space-y-3">
      {heading && <h2 className="text-xl font-semibold">{heading}</h2>}
      <RecordsTable
        label={heading ?? "บ้านในขั้นตอนนี้"}
        columns={["บ้านเลขที่", "โครงการ", "สถานะ", "ขั้นตอนถัดไป"]}
        empty="ไม่มีบ้านในรายการนี้"
        rows={list.map(({ unit, task }) => ({
          key: String(unit.unit_id) + task.screen + (task.defect ?? ""),
          cells: [
            unit.house_no,
            <Fragment key="project">{unit.project_name}{unit.customer_name && <p className="text-muted">{unit.customer_name}</p>}</Fragment>,
            unitStates[String(unit.status)] ?? unit.status,
            <Fragment key="action">
              {task.hint && <p className="mb-2 max-w-sm text-muted">{task.hint}</p>}
              <Link
                href={taskUrl(task, String(unit.unit_id)) + (query ? "&q=" + encodeURIComponent(query) : "")}
                className="btn"
              >
                {task.title}
                <span className="sr-only"> บ้านเลขที่ {String(unit.house_no)}</span>
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
  query = "",
}: {
  identity: SessionView;
  screen: string;
  items: Item[];
  query?: string;
}) {
  const matches = items.filter(({ unit }) =>
    [unit.house_no, unit.project_name, unit.customer_name, unitStates[String(unit.status)]]
      .join(" ").toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")),
  );
  const primary = matches.filter((i) => i.primary);
  const secondary = matches.filter((i) => !i.primary);
  return (
    <AppFrame identity={identity} active={screen} title={screens[screen]}>
      {items.length > 0 ? (
        <>
          <form action={"/tasks/" + screen} className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2">
              ค้นหาบ้านในรายการ
              <input name="q" type="search" defaultValue={query} className="input" placeholder="เลขบ้าน โครงการ ลูกค้า หรือสถานะ" />
            </label>
            <button className="btn" type="submit">ค้นหา</button>
            {query && <Link href={"/tasks/" + screen} className="btn btn-ghost">ล้างการค้นหา</Link>}
          </form>
          <p className="text-muted">{matches.length} จาก {items.length} หลัง เลือกบ้านเพื่อเปิดขั้นตอน</p>
          {!matches.length && <p className="panel-surface p-5">ไม่พบบ้านที่ตรงกับการค้นหา</p>}
          {primary.length > 0 && (
            <Group
              list={primary}
              group="primary"
              query={query}
              heading={secondary.length > 0 ? "ขั้นตอนหลัก" : undefined}
            />
          )}
          {secondary.length > 0 && (
            <Group
              list={secondary}
              group="secondary"
              query={query}
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
              ภาพรวม
            </Link>
          </p>
        </section>
      )}
    </AppFrame>
  );
}
