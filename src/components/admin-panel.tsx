"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { adminPath } from "@/lib/routes";
import {
  type DataRow,
  type SessionView,
  roleLabels,
  unitStates,
} from "@/lib/runtime-contracts";
import { categories, defectStatuses } from "@/lib/domain";
import {
  type ManagementView,
  type ManagementDetail,
  managementSections,
} from "@/lib/management-contracts";
import {
  AppFrame,
  Panel,
  Field,
  Choice,
  Confirm,
  MutationForm,
  Dialog,
  string,
  thaiTime,
} from "./manage-ui";
const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({
  value,
  label,
}));
const craftOptions = Object.entries(categories).map(([value, label]) => ({
  value,
  label,
}));
const activeOptions = [
  { value: "true", label: "เปิดใช้งาน" },
  { value: "false", label: "ปิดใช้งาน" },
];
function Reason() {
  return <Field name="reason" label="เหตุผลการเปลี่ยนแปลง" max={1000} />;
}
function ResourceEditor({
  section,
  item,
  projects,
  onDone,
}: {
  section: string;
  item: DataRow | null;
  projects: DataRow[];
  onDone: (r: Record<string, unknown>) => void;
}) {
  const [role, setRole] = useState(string(item?.role) || "SALES"),
    editing = Boolean(item),
    extra = item ? { updated_at: item.updated_at } : {};
  let fields: ReactNode,
    command = "";
  switch (section) {
    case "employees":
      command = editing ? "employee.update" : "employee.create";
      fields = (
        <>
          <Field name="full_name" label="ชื่อที่แสดง" value={item?.full_name} />
          <Choice
            name="role"
            label="สิทธิ์การใช้งาน"
            options={roleOptions}
            value={role}
            onChange={setRole}
          />
          {["TECHNICIAN", "HEAD_TECHNICIAN"].includes(role) && (
            <Choice
              key={role}
              name="craft_category"
              label={
                role === "HEAD_TECHNICIAN"
                  ? "ประเภทงาน (ไม่ระบุ = ดูแลทุกประเภท)"
                  : "ประเภทงานช่าง"
              }
              options={craftOptions}
              value={item?.craft_category}
              required={role === "TECHNICIAN"}
            />
          )}
          <Field
            name="phone_number"
            label="เบอร์โทรศัพท์"
            value={item?.phone_number}
            type="tel"
            max={10}
            required={role !== "ADMIN"}
          />
          <Field
            name="email"
            label="อีเมล"
            value={item?.email}
            type="email"
            required={false}
          />
          {editing ? (
            <>
              <input
                type="hidden"
                name="employee_id"
                value={string(item?.employee_id)}
              />
              <Choice
                name="is_active"
                label="สถานะบัญชี"
                options={activeOptions}
                value={string(Boolean(item?.is_active))}
              />
              <Reason />
            </>
          ) : (
            <p className="helper">
              ระบบจะสร้างรหัสชั่วคราวให้ส่งเจ้าของบัญชี
              และให้เปลี่ยนเมื่อเข้าครั้งแรก
            </p>
          )}
        </>
      );
      break;
    case "projects":
      command = editing ? "project.update" : "project.create";
      fields = (
        <>
          <Field
            name="project_name"
            label="ชื่อโครงการ"
            value={item?.project_name}
          />
          {editing && (
            <>
              <input
                type="hidden"
                name="project_id"
                value={string(item?.project_id)}
              />
              <Choice
                name="is_active"
                label="รับบ้านใหม่ในโครงการ"
                options={[
                  { value: "true", label: "รับบ้านใหม่" },
                  { value: "false", label: "ปิดรับบ้านใหม่ (งานเดิมทำต่อได้)" },
                ]}
                value={string(Boolean(item?.is_active))}
              />
              <Reason />
            </>
          )}
        </>
      );
      break;
    case "units":
      command = editing ? "unit.update" : "unit.create";
      fields = (
        <>
          <Choice
            name="project_id"
            label="โครงการ"
            options={projects.map((p) => ({
              value: string(p.project_id),
              label:
                string(p.project_name) +
                (p.is_active ? "" : " (ปิดรับบ้านใหม่)"),
            }))}
            value={item?.project_id}
          />
          <Field
            name="house_no"
            label="เลขที่บ้าน"
            value={item?.house_no}
            max={20}
          />
          <Field
            name="unit_type"
            label="แบบบ้าน"
            value={item?.unit_type}
            max={50}
            required={false}
          />
          {editing && (
            <>
              <input
                type="hidden"
                name="unit_id"
                value={string(item?.unit_id)}
              />
              <p className="helper">
                บ้านที่เริ่มตรวจหรือผูกลูกค้าแล้ว แก้ได้เฉพาะแบบบ้านจากหน้านี้
              </p>
              <Reason />
            </>
          )}
        </>
      );
      break;
    case "customers":
      command = editing ? "customer.update" : "customer.create";
      fields = (
        <>
          {editing ? (
            <>
              <input
                type="hidden"
                name="customer_id"
                value={string(item?.customer_id)}
              />
              <p className="text-sm text-muted">
                เลขประจำตัว {string(item?.id_card_mask)}
              </p>
            </>
          ) : (
            <Field
              name="id_card_no"
              label="เลขประจำตัวลูกค้า 13 หลัก"
              max={13}
            />
          )}
          <Field
            name="full_name"
            label="ชื่อและนามสกุล"
            value={item?.full_name}
          />
          <Field
            name="phone_number"
            label="เบอร์โทรศัพท์"
            value={item?.phone_number}
            type="tel"
            max={10}
          />
          <Field
            name="email"
            label="อีเมล"
            value={item?.email}
            type="email"
            required={false}
          />
          {editing && (
            <>
              <p className="helper">
                ลูกค้าที่เริ่มตรวจหรือรับมอบแล้ว แก้ได้เฉพาะข้อมูลติดต่อ
              </p>
              <Reason />
            </>
          )}
        </>
      );
      break;
    default:
      return null;
  }
  return (
    <MutationForm
      endpoint={"/api/manage/" + command}
      extra={extra}
      label={editing ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}
      primary
      onDone={onDone}
    >
      {fields}
    </MutationForm>
  );
}
function SecretResult({
  result,
  onClose,
}: {
  result: Record<string, unknown>;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false),
    [copied, setCopied] = useState(false);
  return (
    <section role="status" className="alert alert-success block space-y-4">
      <p>{string(result.message)}</p>
      {Boolean(result.temporary_password) && (
        <>
          <p>
            บัญชีเข้าใช้: <strong>{string(result.employee_id)}</strong>
          </p>
          <Field
            name="temporary-result"
            label="รหัสผ่านชั่วคราว (แสดงเฉพาะครั้งนี้)"
            type={shown ? "text" : "password"}
            value={result.temporary_password}
            readOnly
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn"
              onClick={() => setShown(!shown)}
            >
              {shown ? "ซ่อนรหัส" : "แสดงรหัสชั่วคราว"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    string(result.temporary_password),
                  );
                  setCopied(true);
                } catch {
                  setShown(true);
                }
              }}
            >
              {copied ? "คัดลอกแล้ว" : "คัดลอกรหัส"}
            </button>
          </div>
        </>
      )}
      {Boolean(result.url) && (
        <>
          <a
            href={string(result.url)}
            target="_blank"
            rel="noreferrer"
            className="block break-all underline underline-offset-4"
          >
            {string(result.url)}
          </a>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(string(result.url));
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
          </button>
        </>
      )}
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        รับทราบและปิด
      </button>
    </section>
  );
}
const changeLabels: Record<string, string> = {
  full_name: "ชื่อ",
  phone_number: "โทรศัพท์",
  email: "อีเมล",
  role: "สิทธิ์",
  craft_category: "ประเภทช่าง",
  is_active: "เปิดใช้",
  project_name: "โครงการ",
  project_id: "รหัสโครงการ",
  house_no: "เลขบ้าน",
  unit_type: "แบบบ้าน",
  customer_id: "ลูกค้า",
  technician_id: "ช่าง",
  archived: "เก็บเข้าคลัง",
  status: "สถานะ",
  revoked: "เพิกถอน",
  changed: "เปลี่ยนแล้ว",
  reset: "รีเซ็ตแล้ว",
  link_id: "รหัสลิงก์",
  employee_id: "รหัสพนักงาน",
};
function Changes({ value }: { value: unknown }) {
  let data: Record<string, unknown> = {};
  try {
    data =
      typeof value === "string"
        ? JSON.parse(value)
        : ((value ?? {}) as Record<string, unknown>);
  } catch {}
  return (
    <dl className="space-y-1 text-sm">
      {Object.entries(data)
        .filter(([key]) => changeLabels[key])
        .map(([key, v]) => (
          <div key={key} className="flex flex-wrap gap-2">
            <dt className="text-muted">{changeLabels[key]}:</dt>
            <dd className="break-all">
              {key === "role"
                ? (roleLabels[v as keyof typeof roleLabels] ?? string(v))
                : key === "craft_category"
                  ? (categories[v as keyof typeof categories] ?? "ทุกประเภท")
                  : typeof v === "boolean"
                    ? v
                      ? "ใช่"
                      : "ไม่"
                    : string(v) || "ไม่ระบุ"}
            </dd>
          </div>
        ))}
    </dl>
  );
}
function DetailPanel({
  data,
  onDone,
}: {
  data: ManagementDetail;
  onDone: (r: Record<string, unknown>) => void;
}) {
  const unit = data.unit,
    employee = data.employee;
  return (
    <div className="space-y-6">
      {unit && (
        <>
          <p>
            {string(unit.project_name)} · {unitStates[string(unit.status)]}
            <br />
            ลูกค้า {string(unit.customer_name) || "ยังไม่ผูกลูกค้า"}
          </p>
          {["READY_TO_SELL", "CONTRACTED", "WAITING_INSPECTION"].includes(
            string(unit.status),
          ) &&
            !unit.archived_at && (
              <Panel
                title={
                  unit.customer_id ? "เปลี่ยนลูกค้าก่อนเริ่มตรวจ" : "ผูกลูกค้า"
                }
              >
                <MutationForm
                  endpoint="/api/manage/unit.customer"
                  extra={{ unit_id: unit.unit_id }}
                  label="ผูกลูกค้าและออกลิงก์"
                  onDone={onDone}
                >
                  <Choice
                    name="customer_id"
                    label="ลูกค้าที่จะผูกกับบ้านนี้"
                    options={(data.customers ?? []).map((c) => ({
                      value: string(c.customer_id),
                      label: string(c.full_name) + " · " + c.phone_number,
                    }))}
                    value={unit.customer_id}
                  />
                  <p className="helper">
                    หากยังไม่มีลูกค้า ให้เพิ่มในทะเบียนลูกค้าก่อน
                    เมื่อเปลี่ยนลูกค้า
                    ลิงก์และการเข้าสู่ระบบของผู้เดิมจะถูกเพิกถอน
                  </p>
                  <Reason />
                  <Confirm>ตรวจข้อมูลและยืนยันลูกค้าของบ้านหลังนี้</Confirm>
                </MutationForm>
              </Panel>
            )}
          <h3>ไฟล์และเอกสารของบ้าน</h3>
          {(data.files ?? []).length ? (
            <ul className="space-y-2">
              {(data.files ?? []).map((f) => (
                <li key={string(f.file_id)}>
                  <a
                    href={string(f.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                  >
                    {f.file_usage === "SUMMARY_PDF"
                      ? "เอกสารสรุป PDF"
                      : f.file_usage === "SIGNATURE"
                        ? "ลายเซ็นรับมอบ"
                        : f.file_usage === "BEFORE_FIX"
                          ? "รูปก่อนซ่อม"
                          : "รูปหลังซ่อม"}{" "}
                    · {string(f.defect_id || f.file_id)}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              ยังไม่มีไฟล์อัปโหลดในพื้นที่จัดเก็บสำหรับบ้านนี้
            </p>
          )}
          <h3>ประวัติรอบตรวจ</h3>
          {(data.rounds ?? []).map((r) => (
            <p key={string(r.round_id)} className="text-sm">
              {r.round_type === "QC_INTERNAL" ? "ตรวจ QC" : "ตรวจก่อนรับมอบ"} ·{" "}
              {r.status === "CLOSED"
                ? "ปิดรอบแล้ว"
                : r.status === "OPEN"
                  ? "เปิดรอบ"
                  : "นัดตรวจซ้ำ"}{" "}
              · {thaiTime(r.started_at)}
            </p>
          ))}
          <h3>รายการจุด</h3>
          <ul className="divide-y divide-base-300">
            {(data.defects ?? []).map((d) => (
              <li
                key={string(d.defect_id)}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <span>{string(d.location_pin)}</span>
                <span className="text-sm text-muted">
                  {defectStatuses[d.status as keyof typeof defectStatuses]}
                </span>
              </li>
            ))}
          </ul>
          <h3>คำขอตรวจ</h3>
          {(data.requests ?? []).map((r) => (
            <p key={string(r.request_id)} className="text-sm">
              {r.status === "SUBMITTED"
                ? "รอเข้าตรวจ"
                : r.status === "IN_PROGRESS"
                  ? "กำลังตรวจและซ่อม"
                  : "เสร็จสิ้น"}{" "}
              · นัด {thaiTime(r.appointment)}
            </p>
          ))}
        </>
      )}
      {employee && (
        <>
          <p>
            {string(employee.full_name)} ·{" "}
            {roleLabels[employee.role as keyof typeof roleLabels]}
          </p>
          <p className="text-muted">
            เลือกงานที่ต้องโอนและช่างผู้รับที่ตรงประเภท
            ก่อนปิดบัญชีหรือเปลี่ยนสิทธิ์
          </p>
          {data.jobs?.length ? (
            <MutationForm
              endpoint="/api/manage/employee.transfer"
              extra={{ employee_id: employee.employee_id }}
              label="โอนงานที่เลือก"
              primary
              onDone={onDone}
            >
              <ul className="divide-y divide-base-300">
                {data.jobs.map((d) => (
                  <li key={string(d.defect_id)}>
                    <label className="flex cursor-pointer items-start gap-3 py-3">
                      <input
                        name="defect_ids"
                        value={string(d.defect_id)}
                        type="checkbox"
                        className="checkbox mt-1"
                      />
                      <span>
                        บ้าน {string(d.house_no)} · {string(d.location_pin)}
                        <span className="block text-sm text-muted">
                          {categories[d.category as keyof typeof categories]}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Choice
                name="technician_id"
                label="ช่างผู้รับงาน"
                options={(data.technicians ?? [])
                  .filter((e) => e.employee_id !== employee.employee_id)
                  .map((e) => ({
                    value: string(e.employee_id),
                    label:
                      string(e.full_name) +
                      " · " +
                      (categories[
                        e.craft_category as keyof typeof categories
                      ] ?? "ทุกประเภท"),
                  }))}
              />
              <Reason />
              <Confirm>ยืนยันโอนงานที่เลือก โดยเก็บสถานะและรูปเดิมไว้</Confirm>
            </MutationForm>
          ) : (
            <p>ไม่มีงานค้างที่ต้องโอน</p>
          )}
        </>
      )}
    </div>
  );
}
export function AdminPanel({
  identity,
  view,
  query = "",
  status = "",
  sort = "newest",
}: {
  identity: SessionView;
  view: ManagementView;
  query?: string;
  status?: string;
  sort?: string;
}) {
  const [editor, setEditor] = useState<{
      mode: string;
      item: DataRow | null;
    } | null>(null),
    [result, setResult] = useState<Record<string, unknown> | null>(null),
    [detail, setDetail] = useState<ManagementDetail | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const section = view.section,
    items = view.items ?? [];
  const done = (r: Record<string, unknown>) => {
    setResult(r);
    setEditor(null);
    setDetail(null);
  };
  async function openDetail(kind: string, key: string) {
    setError("");
    setLoading(true);
    try {
      const r = await fetch(`/api/manage/${kind}/${encodeURIComponent(key)}`);
      const json = await r.json();
      if (!r.ok) throw Error(json.error?.message ?? "เปิดข้อมูลไม่ได้");
      setDetail(json.data);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
          : e instanceof Error
            ? e.message
            : "เปิดข้อมูลไม่ได้",
      );
    } finally {
      setLoading(false);
    }
  }
  const pageLink = (page: number) =>
    adminPath(section) + "?" +
    new URLSearchParams({
      q: query,
      status,
      sort,
      page: String(page),
    });
  const title = managementSections[section] ?? "ภาพรวม",
    creatable = ["employees", "projects", "units", "customers"].includes(
      section,
    ),
    pk = (
      {
        employees: "employee_id",
        projects: "project_id",
        units: "unit_id",
        customers: "customer_id",
        links: "link_id",
        sessions: "session_ref",
        audit: "event_id",
      } as Record<string, string>
    )[section];
  function rowTitle(r: DataRow) {
    return section === "units"
      ? "บ้านเลขที่ " + r.house_no
      : section === "projects"
        ? string(r.project_name)
        : section === "links"
          ? "บ้าน " + r.house_no
          : section === "audit"
            ? string(r.action_name)
            : string(r.full_name);
  }
  function summary(r: DataRow) {
    switch (section) {
      case "employees":
        return `${roleLabels[r.role as keyof typeof roleLabels]} · ${r.is_active ? "เปิดใช้" : "ปิดใช้"}${Number(r.active_jobs) ? " · งานค้าง " + r.active_jobs + " จุด" : ""}`;
      case "projects":
        return `${r.unit_count} หลัง · ${r.is_active ? "รับบ้านใหม่" : "ปิดรับบ้านใหม่"}`;
      case "units":
        return `${r.project_name} · ${unitStates[string(r.status)]}${r.archived_at ? " · เก็บเข้าคลัง" : ""}`;
      case "customers":
        return `${r.phone_number} · บ้าน ${r.houses || "ยังไม่ผูกบ้าน"}`;
      case "links":
        return `${r.customer_name} · ${r.revoked_at ? "เพิกถอนแล้ว" : "หมดอายุ " + thaiTime(r.expires_at)}`;
      case "sessions":
        return `เริ่ม ${thaiTime(r.created_at)} · หมดอายุ ${thaiTime(r.expires_at)}`;
      case "audit":
        return `${thaiTime(r.created_at)} · ${r.actor_name} · ${r.entity_id}`;
      default:
        return "";
    }
  }
  function actions(r: DataRow) {
    return (
      <div className="flex flex-wrap gap-2">
        {creatable && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setEditor({ mode: "edit", item: r })}
          >
            แก้ไข
          </button>
        )}
        {section === "employees" && (
          <>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEditor({ mode: "reset", item: r })}
            >
              รีเซ็ตรหัส
            </button>
            {Number(r.active_jobs) > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => openDetail("employee", string(r.employee_id))}
              >
                จัดการงานค้าง
              </button>
            )}
          </>
        )}
        {section === "units" && (
          <>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => openDetail("unit", string(r.unit_id))}
            >
              ประวัติ / ลูกค้า
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setEditor({ mode: "archive", item: r })}
            >
              {r.archived_at ? "นำกลับ" : "เก็บเข้าคลัง"}
            </button>
          </>
        )}
        {section === "links" && !r.revoked_at && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setEditor({ mode: "revoke-link", item: r })}
          >
            เพิกถอน
          </button>
        )}
        {section === "sessions" && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setEditor({ mode: "revoke-session", item: r })}
          >
            ออกจากระบบรายการนี้
          </button>
        )}
        {section === "audit" && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setEditor({ mode: "audit", item: r })}
          >
            ดูการเปลี่ยนแปลง
          </button>
        )}
      </div>
    );
  }
  return (
    <AppFrame
      identity={identity}
      title={title}
      active={section}
      nav={[
        ...Object.entries(managementSections).map(([key, label]) => ({
          key,
          label,
          href: adminPath(key),
        })),
      ]}
    >
      {result && (
        <SecretResult result={result} onClose={() => setResult(null)} />
      )}
      <p className="text-sm text-muted">
        ส่วนจัดการข้อมูลและบัญชี
        การตรวจงานซ่อมและยืนยันรับมอบดำเนินการโดยฝ่ายที่รับผิดชอบ
      </p>
      {error && (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      )}
      {loading && (
        <p role="status">
          <span
            className="loading loading-spinner loading-sm"
            aria-hidden="true"
          />{" "}
          กำลังเปิดข้อมูล
        </p>
      )}
      {section === "overview" ? (
        <>
          <Panel title="สถานะบ้านในระบบ">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(view.counts ?? []).map((r) => (
                <Link
                  key={string(r.status)}
                  href={adminPath("units") + "?status=" + r.status}
                  className="border-b border-base-300 px-2 py-4 hover:bg-base-200"
                >
                  <p className="text-muted">{unitStates[string(r.status)]}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {string(r.n)} หลัง
                  </p>
                </Link>
              ))}
            </div>
            {!view.counts?.length && (
              <p className="text-muted">
                ยังไม่มีบ้าน เริ่มจากเพิ่มโครงการและบ้าน
              </p>
            )}
          </Panel>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              [
                "โครงการที่รับบ้านใหม่",
                view.tasks?.active_projects,
                "projects",
              ],
              ["บัญชีที่เปิดใช้", view.tasks?.active_employees, "employees"],
              ["จุดที่รอดำเนินการ", view.tasks?.pending_defects, "units"],
            ].map(([label, n, key]) => (
              <Link
                key={string(key)}
                className="stat-card hover:bg-base-200 transition-colors"
                href={
                  adminPath(String(key)) +
                  (key === "projects" || key === "employees"
                    ? "?status=active"
                    : key === "units"
                      ? "?status=pending-work"
                      : "")
                }
              >
                <span className="stat-card-label">{label}</span>
                <span className="stat-card-value">{string(n)}</span>
              </Link>
            ))}
          </div>
          <Panel title="นัดหมายที่กำลังจะมาถึง">
            <ul className="divide-y divide-base-300">
              {(view.upcoming ?? []).map((r) => (
                <li key={string(r.request_id)} className="py-3">
                  บ้าน {string(r.house_no)} · {string(r.project_name)}
                  <p className="text-sm text-muted">
                    {thaiTime(r.appointment)}
                  </p>
                </li>
              ))}
            </ul>
            {!view.upcoming?.length && (
              <p className="text-muted">ไม่มีนัดหมายที่กำลังจะมาถึง</p>
            )}
          </Panel>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-muted">ทั้งหมด {view.total ?? 0} รายการ</p>
            {creatable && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditor({ mode: "create", item: null })}
              >
                เพิ่ม
                {section === "employees"
                  ? "พนักงาน"
                  : section === "projects"
                    ? "โครงการ"
                    : section === "units"
                      ? "บ้าน"
                      : "ลูกค้า"}
              </button>
            )}
            {section === "links" && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditor({ mode: "create-link", item: null })}
              >
                ออกลิงก์ให้ลูกค้า
              </button>
            )}
          </div>
          <form
            action={adminPath(section)}
            method="get"
            className="flex flex-wrap items-end gap-3"
          >
            <div className="min-w-0 grow">
              <Field
                key={query}
                name="q"
                label="ค้นหารายการ"
                value={query}
                type="search"
                required={false}
              />
            </div>
            {["units", "employees", "projects", "links"].includes(section) && (
              <Choice
                key={status}
                name="status"
                label="แสดงสถานะ"
                options={
                  section === "units"
                    ? [
                        { value: "", label: "บ้านที่ใช้งาน" },
                        ...Object.entries(unitStates).map(([value, label]) => ({
                          value,
                          label,
                        })),
                        { value: "pending-work", label: "บ้านที่มีจุดค้าง" },
                        { value: "archived", label: "เก็บเข้าคลัง" },
                      ]
                    : [
                        { value: "", label: "ทั้งหมด" },
                        {
                          value: "active",
                          label:
                            section === "links" ? "ยังใช้ได้" : "เปิดใช้งาน",
                        },
                        {
                          value: "inactive",
                          label:
                            section === "links"
                              ? "หมดอายุหรือเพิกถอน"
                              : "ปิดใช้งาน",
                        },
                      ]
                }
                value={status}
                required={false}
              />
            )}
            {
              <Choice
                name="sort"
                label="เรียงลำดับ"
                value={sort}
                options={[
                  ...(["employees", "projects", "customers"].includes(section)
                    ? [{ value: "name", label: "ตามชื่อ" }]
                    : []),
                  {
                    value: "newest",
                    label: ["employees", "projects", "customers"].includes(
                      section,
                    )
                      ? "แก้ไขล่าสุดก่อน"
                      : "ล่าสุดก่อน",
                  },
                  {
                    value: "oldest",
                    label: ["employees", "projects", "customers"].includes(
                      section,
                    )
                      ? "แก้ไขก่อนสุด"
                      : "ก่อนสุด",
                  },
                ]}
              />
            }
            <button type="submit" className="btn">
              ค้นหา
            </button>
            <Link className="btn btn-ghost" href={adminPath(section)}>
              ล้างตัวกรอง
            </Link>
          </form>
          <div className="hidden overflow-x-auto rounded-box border border-base-300 bg-base-100 md:block">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th scope="col">รายการ</th>
                  <th scope="col">รายละเอียด</th>
                  <th scope="col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={string(r[pk])}>
                    <th scope="row">
                      <span>{rowTitle(r)}</span>
                      {section !== "sessions" && (
                        <span className="block text-sm font-normal text-muted">
                          {string(r[pk])}
                        </span>
                      )}
                    </th>
                    <td>{summary(r)}</td>
                    <td>{actions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <p className="p-6 text-muted">ไม่พบรายการที่ตรงกับตัวกรอง</p>
            )}
          </div>
          <ul className="divide-y divide-base-300 rounded-box border border-base-300 bg-base-100 px-5 md:hidden">
            {items.map((r) => (
              <li key={string(r[pk])} className="space-y-3 py-5">
                <h2 className="text-lg">{rowTitle(r)}</h2>
                <p className="break-words text-sm text-muted">{summary(r)}</p>
                {actions(r)}
              </li>
            ))}
            {!items.length && (
              <li className="py-6 text-muted">ไม่พบรายการที่ตรงกับตัวกรอง</li>
            )}
          </ul>
          <nav
            aria-label="หน้ารายการ"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted">
              หน้า {view.page ?? 1} จาก {view.pages ?? 1}
            </p>
            <div className="flex gap-2">
              {(view.page ?? 1) > 1 ? (
                <Link className="btn" href={pageLink((view.page ?? 1) - 1)}>
                  ก่อนหน้า
                </Link>
              ) : (
                <button type="button" className="btn" disabled>
                  ก่อนหน้า
                </button>
              )}
              {(view.page ?? 1) < (view.pages ?? 1) ? (
                <Link className="btn" href={pageLink((view.page ?? 1) + 1)}>
                  ถัดไป
                </Link>
              ) : (
                <button type="button" className="btn" disabled>
                  ถัดไป
                </button>
              )}
            </div>
          </nav>
        </>
      )}
      {editor && (
        <Dialog
          title={
            editor.mode === "create"
              ? "เพิ่ม" + title
              : editor.mode === "edit"
                ? "แก้ไข" + title
                : editor.mode === "reset"
                  ? "รีเซ็ตรหัสผ่าน"
                  : editor.mode === "archive"
                    ? editor.item?.archived_at
                      ? "นำบ้านกลับจากคลัง"
                      : "เก็บบ้านเข้าคลัง"
                    : editor.mode === "create-link"
                      ? "ออกลิงก์ให้ลูกค้า"
                      : editor.mode === "audit"
                        ? "ประวัติการเปลี่ยนแปลง"
                        : "เพิกถอนการเข้าถึง"
          }
          onClose={() => setEditor(null)}
        >
          {["create", "edit"].includes(editor.mode) ? (
            <ResourceEditor
              section={section}
              item={editor.item}
              projects={view.projects ?? []}
              onDone={done}
            />
          ) : editor.mode === "audit" ? (
            <>
              <p>
                {string(editor.item?.action_name)} ·{" "}
                {thaiTime(editor.item?.created_at)}
                <br />
                โดย {string(editor.item?.actor_name)}
                <br />
                เหตุผล {string(editor.item?.reason) || "รายการปกติ"}
              </p>
              <h3>ก่อนเปลี่ยน</h3>
              <Changes value={editor.item?.before_values} />
              <h3>หลังเปลี่ยน</h3>
              <Changes value={editor.item?.after_values} />
            </>
          ) : (
            <MutationForm
              endpoint={
                "/api/manage/" +
                (
                  {
                    reset: "employee.reset",
                    archive: "unit.archive",
                    "create-link": "link.create",
                    "revoke-link": "link.revoke",
                    "revoke-session": "session.revoke",
                  } as Record<string, string>
                )[editor.mode]
              }
              extra={
                editor.mode === "reset"
                  ? { employee_id: editor.item?.employee_id }
                  : editor.mode === "archive"
                    ? {
                        unit_id: editor.item?.unit_id,
                        updated_at: editor.item?.updated_at,
                        archived: !editor.item?.archived_at,
                      }
                    : editor.mode === "revoke-link"
                      ? { link_id: editor.item?.link_id }
                      : editor.mode === "revoke-session"
                        ? { session_ref: editor.item?.session_ref }
                        : {}
              }
              label="ยืนยันรายการ"
              primary
              onDone={done}
            >
              {editor.mode === "create-link" ? (
                <Choice
                  name="unit_id"
                  label="บ้านที่จะออกลิงก์"
                  options={(view.units ?? []).map((u) => ({
                    value: string(u.unit_id),
                    label: "บ้าน " + u.house_no + " · " + u.project_name,
                  }))}
                />
              ) : (
                <p>
                  {editor.mode === "reset"
                    ? "บัญชี " + editor.item?.full_name
                    : editor.mode === "archive"
                      ? "บ้าน " + editor.item?.house_no
                      : editor.mode === "revoke-link"
                        ? "ลิงก์บ้าน " + editor.item?.house_no
                        : editor.item?.full_name}
                </p>
              )}
              <Reason />
              <Confirm>ตรวจข้อมูลและยืนยันการทำรายการนี้</Confirm>
            </MutationForm>
          )}
        </Dialog>
      )}
      {detail && (
        <Dialog
          title={
            detail.unit
              ? "ประวัติบ้านเลขที่ " + detail.unit.house_no
              : "โอนงานที่ค้าง"
          }
          onClose={() => setDetail(null)}
        >
          <DetailPanel data={detail} onDone={done} />
        </Dialog>
      )}
    </AppFrame>
  );
}
