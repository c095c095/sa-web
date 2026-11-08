"use client";
import {
  Action,
  Category,
  Check,
  Defects,
  Description,
  Empty,
  Field,
  Panel,
  Photos,
  Select,
  str,
} from "./controls";
import { type WorkflowState } from "../workflow-frame";

export function RecordQc({
  w,
  qc,
  unitExtra,
  qcDefs,
  openQc,
  editable,
  opts,
  actionBase,
}: WorkflowState) {
  return (
    <>
      <Panel title="บันทึกการตรวจ QC">
        {openQc && !qc?.inspection_finished_at ? (
          <>
            <Action
              {...actionBase}
              uc="UC-02"
              extra={{ ...unitExtra, mode: "add" }}
              title="บันทึกจุดที่ต้องแก้ไข"
              primary
            >
              <Category />
              <Field name="location_pin" title="ตำแหน่งที่ต้องแก้" />
              <Description />
              <Photos />
            </Action>
            <div className="mt-8 border-t border-base-300 pt-5">
              <Action
                {...actionBase}
                uc="UC-02"
                extra={{ ...unitExtra, mode: "finish" }}
                title="เสร็จสิ้นการตรวจ"
              >
                <Check
                  required
                  title="ตรวจครบแล้ว เมื่อยืนยันจะเพิ่ม แก้ หรือลบรายการเดิมไม่ได้"
                />
              </Action>
            </div>
          </>
        ) : (
          <Empty>
            {qc?.inspection_finished_at
              ? "บันทึกเสร็จสิ้นการตรวจแล้ว รายการเดิมถูกล็อก"
              : "เลือกบ้านที่อยู่ระหว่างตรวจ QC"}
          </Empty>
        )}
      </Panel>
      <Panel title="รายการในรอบตรวจ">
        <Defects files={w.files} items={qcDefs} />
      </Panel>
      {editable.length > 0 && (
        <Panel title="แก้ไขหรือลบก่อนเสร็จสิ้นการตรวจ">
          <Action
            {...actionBase}
            uc="UC-02"
            extra={{ mode: "edit" }}
            title="บันทึกการแก้ไข"
          >
            <Select
              name="defect_id"
              title="จุดที่ต้องการแก้"
              items={opts(editable)}
            />
            <Category />
            <Field name="location_pin" title="ตำแหน่งที่แก้ไขแล้ว" />
            <Description />
            <Photos />
          </Action>
          <div className="mt-8 border-t border-base-300 pt-5">
            <Action
              {...actionBase}
              uc="UC-02"
              extra={{ mode: "delete" }}
              title="ลบจุดที่เลือก"
            >
              <Select
                name="defect_id"
                title="จุดที่จะลบ"
                items={opts(editable)}
              />
              <Check
                required
                title="ยืนยันลบจุดและรูปประกอบ รายการนี้จะถูกลบออกจากรอบตรวจ"
              />
            </Action>
          </div>
          {w.files.some((f) =>
            editable.some((d) => d.defect_id === f.defect_id),
          ) && (
            <div className="mt-8 border-t border-base-300 pt-5">
              <Action
                {...actionBase}
                uc="UC-02"
                extra={{ mode: "remove-photo" }}
                title="ลบรูปที่เลือก"
              >
                <Select
                  name="defect_id"
                  title="จุดเจ้าของรูป"
                  items={opts(editable)}
                />
                <Select
                  name="file_id"
                  title="รูปที่จะลบ"
                  items={w.files
                    .filter((f) =>
                      editable.some((d) => d.defect_id === f.defect_id),
                    )
                    .map((f) => ({
                      value: str(f.file_id),
                      title: `${f.file_id} · ${f.defect_id}`,
                    }))}
                />
                <Check required title="ยืนยันลบรูปนี้" />
              </Action>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

export function ReviewRepair({ w, fixed, opts, actionBase }: WorkflowState) {
  return (
    <>
      <Panel title="งานรอตรวจอนุมัติ">
        <Defects files={w.files} items={fixed} />
      </Panel>
      {fixed.length > 0 && (
        <Panel title="ผลตรวจงานซ่อม">
          <Action
            {...actionBase}
            uc="UC-05"
            extra={{ approve: true }}
            title="อนุมัติงานซ่อม"
            primary
          >
            <Select
              name="defect_id"
              title="งานซ่อมที่ตรวจผ่าน"
              items={opts(fixed)}
            />
          </Action>
          <div className="mt-8 border-t border-base-300 pt-5">
            <Action
              {...actionBase}
              uc="UC-05"
              extra={{ approve: false }}
              title="ส่งกลับแก้"
            >
              <Select
                name="defect_id"
                title="งานซ่อมที่ไม่ผ่าน"
                items={opts(fixed)}
              />
            </Action>
          </div>
        </Panel>
      )}
    </>
  );
}

export function RecheckQc({
  w,
  qc,
  roundExtra,
  qcDefs,
  actionBase,
}: WorkflowState) {
  return (
    <>
      <Panel title="นัดตรวจซ้ำและบันทึกผล">
        {qc?.status === "OPEN" ? (
          <Action
            {...actionBase}
            uc="UC-06"
            extra={{ ...roundExtra, mode: "schedule" }}
            title="นัดตรวจซ้ำ"
            primary
          >
            <p className="text-muted">นัดได้เมื่อทุกจุดในรอบตรวจผ่านแล้ว</p>
            <Field name="recheck_date" title="วันที่ตรวจซ้ำ" type="date" />
          </Action>
        ) : qc?.status === "RECHECK_SCHEDULED" ? (
          <>
            <p className="mb-5">
              นัดวันที่ {str(qc.recheck_date).slice(0, 10)}
            </p>
            <Action
              {...actionBase}
              uc="UC-06"
              extra={{
                ...roundExtra,
                mode: "result",
                recheck_result: "NO_DEFECT",
              }}
              title="บันทึกไม่พบจุดที่ต้องแก้"
              primary
            >
              <Check required title="ตรวจหน้างานแล้ว ไม่พบจุดที่ต้องแก้ไข" />
            </Action>
            <div className="mt-8 border-t border-base-300 pt-5">
              <Action
                {...actionBase}
                uc="UC-06"
                extra={{
                  ...roundExtra,
                  mode: "result",
                  recheck_result: "DEFECT_FOUND",
                }}
                title="บันทึกจุดใหม่และเปิดรอบซ่อมต่อ"
              >
                <Category />
                <Field name="location_pin" title="ตำแหน่งที่พบจุดใหม่" />
                <Description />
                <Photos />
              </Action>
            </div>
          </>
        ) : (
          <Empty>ไม่มีรอบ QC ที่เปิดอยู่</Empty>
        )}
      </Panel>
      <Panel title="รายการในรอบ">
        <Defects files={w.files} items={qcDefs} />
      </Panel>
    </>
  );
}

export function CloseQc({
  w,
  qc,
  qcDefs,
  roundExtra,
  actionBase,
}: WorkflowState) {
  const pending = qcDefs.filter(
    (defect) => defect.status !== "VERIFIED",
  ).length;
  return (
    <Panel title="รับรองและปิดรอบ QC">
      <ul className="mb-5 space-y-2 border-b border-base-300 pb-4">
        <li>
          ผลตรวจซ้ำ{" "}
          {qc?.recheck_result === "NO_DEFECT"
            ? "ไม่พบจุดที่ต้องแก้"
            : "ยังไม่ผ่านเงื่อนไขปิดรอบ"}
        </li>
        <li>
          จุดที่ยังตรวจไม่ผ่าน {pending} จาก {qcDefs.length} จุด
        </li>
        <li>เลือกผู้ตรวจร่วม หรือยืนยันรับรองคนเดียว</li>
      </ul>
      {qc?.status === "RECHECK_SCHEDULED" &&
      qc.recheck_result === "NO_DEFECT" ? (
        <>
          <Action
            {...actionBase}
            uc="UC-07"
            extra={{ ...roundExtra, is_single_certify: false }}
            title="ปิดรอบด้วยผู้ตรวจร่วม"
            disabled={pending > 0}
            primary
          >
            <Select
              name="co_inspector_id"
              title="ผู้ตรวจร่วม"
              items={w.inspectors
                .filter((e) => e.employee_id !== qc.inspector_id)
                .map((e) => ({
                  value: str(e.employee_id),
                  title: str(e.full_name),
                }))}
            />
            <Check required title="ยืนยันผลตรวจร่วมก่อนปิดรอบ" />
          </Action>
          <div className="mt-8 border-t border-base-300 pt-5">
            <Action
              {...actionBase}
              uc="UC-07"
              extra={{ ...roundExtra, is_single_certify: true }}
              title="ปิดรอบแบบรับรองคนเดียว"
              disabled={pending > 0}
            >
              <Check required title="ยืนยันรับรองผลการตรวจคนเดียว" />
            </Action>
          </div>
        </>
      ) : (
        <Empty>ต้องตรวจซ้ำและบันทึกว่าไม่พบจุดที่ต้องแก้ไขก่อนปิดรอบ</Empty>
      )}
    </Panel>
  );
}
