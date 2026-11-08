"use client";
import { Search } from "lucide-react";
import { categories } from "@/lib/domain";
import {
  Action,
  Category,
  Check,
  Defects,
  Empty,
  Field,
  Files,
  Panel,
  Photos,
  Select,
  str,
  label,
} from "./controls";
import { type WorkflowState } from "../workflow-frame";

export function ClaimRepair({
  w,
  unitId,
  search,
  setSearch,
  selectedDefect,
  prefer,
  actionBase,
}: WorkflowState) {
  const items = prefer(w.queue.filter((d) => d.unit_id === unitId)).filter(
    (d) =>
      (str(d.house_no) + str(d.location_pin) + str(d.project_name)).includes(
        search,
      ),
  );
  return (
    <Panel title="งานที่รอช่างรับ">
      {!selectedDefect && (
        <>
          <label htmlFor="queue-search" className="field-label">
            ค้นหางาน
          </label>
          <div className="input mb-6 flex w-full items-center gap-3">
            <Search size={19} aria-hidden="true" />
            <input
              id="queue-search"
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="เลขที่บ้านหรือตำแหน่งที่ต้องแก้"
              className="min-w-0 grow"
            />
          </div>
        </>
      )}
      {items.length ? (
        <Action
          {...actionBase}
          uc="UC-03"
          extra={selectedDefect ? { defect_ids: [selectedDefect] } : {}}
          title={items.length === 1 ? "รับงานนี้" : "รับงานที่เลือก"}
          primary
        >
          <ul className="divide-y divide-base-300">
            {items.map((d) => (
              <li key={str(d.defect_id)}>
                {selectedDefect ? (
                  <div className="py-3">
                    <h3>{str(d.location_pin)}</h3>
                    <p className="text-sm text-muted">
                      {label(categories, d.category)}
                    </p>
                  </div>
                ) : (
                  <Check
                    name="defect_ids"
                    defaultChecked={
                      items.length === 1 || d.defect_id === selectedDefect
                    }
                    value={str(d.defect_id)}
                    title={`บ้าน ${d.house_no} · ${d.location_pin} · ${label(categories, d.category)} · ${d.defect_id}`}
                  />
                )}
                <details className={selectedDefect ? "mb-4" : "mb-4 pl-9"}>
                  <summary className="cursor-pointer py-2 underline underline-offset-4">
                    รายละเอียดและรูปก่อนซ่อม
                  </summary>
                  <p className="whitespace-pre-wrap break-words">
                    {str(d.description) || "ไม่มีรายละเอียดเพิ่มเติม"}
                  </p>
                  <p className="text-sm text-muted">
                    รหัสงาน {str(d.defect_id)}
                  </p>
                  <Files files={w.files} defectId={str(d.defect_id)} />
                </details>
              </li>
            ))}
          </ul>
        </Action>
      ) : (
        <Empty>
          {selectedDefect
            ? "ไม่พบงานนี้ในคิวที่รับได้ เปิดรายการงานล่าสุดจากภาพรวมบ้าน"
            : "ไม่มีงานที่ตรงกับการค้นหาหรือประเภทช่างของคุณ"}
        </Empty>
      )}
    </Panel>
  );
}

export function CompleteRepair({
  w,
  localJobs,
  opts,
  actionBase,
}: WorkflowState) {
  return (
    <>
      <Panel title="บันทึกผลซ่อม">
        {localJobs.length ? (
          <Action {...actionBase} uc="UC-04" title="บันทึกซ่อมเสร็จ" primary>
            <Select
              name="defect_id"
              title="งานที่คุณรับไว้"
              items={opts(localJobs)}
            />
            <Photos required />
          </Action>
        ) : (
          <Empty>ไม่มีงานที่คุณรับไว้และรอซ่อม</Empty>
        )}
      </Panel>
      <Panel title="งานซ่อมของคุณ">
        <Defects files={w.files} items={localJobs} />
      </Panel>
    </>
  );
}

export function TriageRepair({ w, localNew, opts, actionBase }: WorkflowState) {
  return (
    <>
      <Panel title="จุดใหม่ที่รอแยกประเภท">
        {localNew.length ? (
          <Action {...actionBase} uc="UC-15" title="ส่งเข้าคิวช่าง" primary>
            <Select name="defect_id" title="จุดใหม่" items={opts(localNew)} />
            <Category />
            <Field
              name="target_date"
              title="เป้าหมายซ่อมเสร็จ"
              type="date"
              required={false}
            />
          </Action>
        ) : (
          <Empty />
        )}
      </Panel>
      <Panel title="รายละเอียดจุดใหม่">
        <Defects files={w.files} items={localNew} />
      </Panel>
    </>
  );
}
