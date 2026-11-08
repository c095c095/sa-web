"use client";
import Link from "next/link";
import { workflowPath } from "@/lib/routes";
import {
  Action,
  Check,
  Defects,
  Description,
  Empty,
  Field,
  Files,
  Panel,
  Photos,
  Signature,
  str,
  when,
} from "./controls";
import { type WorkflowState } from "../workflow-frame";

export function SetInspectionPreference({
  unit,
  unitId,
  actionBase,
}: WorkflowState) {
  return (
    <Panel title="ความต้องการตรวจก่อนรับมอบ">
      {unit?.status === "CONTRACTED" ? (
        <>
          <p className="mb-5">
            หากต้องการตรวจบ้าน ให้เลือกวันที่สะดวกในแบบยื่นคำขอ
          </p>
          <Link
            href={workflowPath("SCR-11", unitId)}
            className="btn btn-primary"
          >
            ต้องการตรวจบ้าน · เลือกวัน
          </Link>
          <div className="mt-8 border-t border-base-300 pt-5">
            <Action
              {...actionBase}
              uc="UC-10"
              extra={{ wants_inspection: false }}
              title="ยืนยันไม่ต้องการตรวจบ้าน"
            >
              <Check
                required
                title="ฉันไม่ต้องการตรวจก่อนรับมอบ และต้องการไปขั้นเซ็นรับมอบ"
              />
            </Action>
          </div>
        </>
      ) : (
        <Empty>
          บ้านนี้ตอบความต้องการตรวจแล้ว
          ดูสถานะบ้านด้านบนและเลือกขั้นตอนถัดไปจากเมนู
        </Empty>
      )}
    </Panel>
  );
}

export function RequestInspection({
  unit,
  unitExtra,
  actionBase,
}: WorkflowState) {
  return (
    <Panel title={"วันที่สะดวกเข้าตรวจ"}>
      <Action
        {...actionBase}
        uc={"UC-11"}
        extra={unitExtra}
        title="ยื่นคำขอตรวจบ้าน"
        primary
        disabled={unit?.status !== "CONTRACTED"}
      >
        <Field name="preferred_date" title="วันที่ต้องการตรวจ" type="date" />
        <p className="text-muted">ฝ่ายขายจะกำหนดเวลานัดในคำขอนี้อีกครั้ง</p>
      </Action>
      {unit?.status !== "CONTRACTED" && (
        <Empty>ยื่นได้เฉพาะบ้านที่ทำสัญญาแล้วและยังไม่ยื่นคำขอ</Empty>
      )}
    </Panel>
  );
}

export function RequestAssistedInspection({
  unit,
  unitExtra,
  actionBase,
}: WorkflowState) {
  return (
    <Panel title={"ยื่นคำขอแทนลูกค้า"}>
      <Action
        {...actionBase}
        uc={"UC-12"}
        extra={unitExtra}
        title="ยื่นคำขอตรวจบ้าน"
        primary
        disabled={unit?.status !== "CONTRACTED"}
      >
        <Field name="preferred_date" title="วันที่ต้องการตรวจ" type="date" />
        <p className="text-muted">ฝ่ายขายจะกำหนดเวลานัดในคำขอนี้อีกครั้ง</p>
      </Action>
      {unit?.status !== "CONTRACTED" && (
        <Empty>ยื่นได้เฉพาะบ้านที่ทำสัญญาแล้วและยังไม่ยื่นคำขอ</Empty>
      )}
    </Panel>
  );
}

export function ManageAppointment({ w, request, actionBase }: WorkflowState) {
  return (
    <>
      <Panel title="นัดและเปิดรอบตรวจ">
        {request ? (
          <>
            <p className="mb-5">
              คำขอ {str(request.request_id)} · วันที่ลูกค้าสะดวก{" "}
              {str(request.preferred_date).slice(0, 10)}
              <br />
              นัดปัจจุบัน {when(request.appointment)}
            </p>
            <Action
              {...actionBase}
              uc="UC-13"
              extra={{
                request_id: request.request_id,
                mode: "appointment",
              }}
              title="บันทึกหรือเลื่อนนัด"
              primary
            >
              <Field
                name="appointment"
                title="วันและเวลานัด (เวลาไทย)"
                type="datetime-local"
              />
            </Action>
            <div className="mt-8 border-t border-base-300 pt-5">
              <Action
                {...actionBase}
                uc="UC-13"
                extra={{ request_id: request.request_id, mode: "arrival" }}
                title="บันทึกมาถึงและเปิดรอบตรวจ"
                disabled={!request.appointment}
              >
                <Check required title="ลูกค้ามาถึงบ้านแล้ว" />
              </Action>
            </div>
          </>
        ) : (
          <Empty>
            ไม่มีคำขอที่รอเข้าตรวจ หากเปิดรอบแล้ว
            ลูกค้าสามารถแจ้งจุดที่ต้องแก้ผ่านลิงก์ของตนได้
          </Empty>
        )}
      </Panel>
      <Panel title="ประวัติคำขอตรวจ">
        <ul className="divide-y divide-base-300">
          {w.requests.map((r) => (
            <li key={str(r.request_id)} className="py-3">
              {str(r.request_id)} · {str(r.status)}
              <p className="text-sm text-muted">
                นัด {when(r.appointment)} · มาถึง {when(r.arrival)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

export function RecordHandoverDefect({
  w,
  handoverDefs,
  canCustomer,
  actionBase,
}: WorkflowState) {
  return (
    <>
      <Panel title="แจ้งจุดใหม่">
        <Action
          {...actionBase}
          uc="UC-14"
          title="บันทึกจุดที่ต้องแก้ไข"
          primary
          disabled={!canCustomer}
        >
          <fieldset>
            <legend className="field-label">ผู้แจ้ง</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["CUSTOMER", "ลูกค้า"],
                ["EXTERNAL", "บริษัทตรวจนอก"],
              ].map(([value, title]) => (
                <label key={value} className="btn reporter-choice">
                  <input
                    type="radio"
                    name="reported_by_type"
                    value={value}
                    defaultChecked={value === "CUSTOMER"}
                    className="radio radio-sm"
                  />
                  {title}
                </label>
              ))}
            </div>
          </fieldset>
          <Field name="location_pin" title="ตำแหน่งที่ต้องแก้" />
          <Description />
          <Photos required />
        </Action>
        {!canCustomer && (
          <Empty>แจ้งจุดได้เมื่อฝ่ายขายบันทึกมาถึงและเปิดรอบตรวจแล้ว</Empty>
        )}
      </Panel>
      <Panel title="จุดที่แจ้งในรอบนี้">
        <Defects files={w.files} items={handoverDefs} />
      </Panel>
    </>
  );
}

export function SignHandover({ w, unit, run, actionBase }: WorkflowState) {
  return (
    <>
      <Panel title="ลงลายเซ็นรับมอบ">
        {unit?.status === "HANDED_OVER" ? (
          <>
            <p role="status">
              เซ็นรับมอบแล้ว เมื่อ {when(unit.handed_over_at)}
            </p>
            <Files files={w.files} />
          </>
        ) : (
          <>
            <Signature run={run} disabled={unit?.status !== "READY_HANDOVER"} />
            {unit?.status !== "READY_HANDOVER" && (
              <Empty>บ้านยังไม่พร้อมรับมอบ กรุณาตรวจขั้นตอนก่อนหน้า</Empty>
            )}
          </>
        )}
      </Panel>
      {unit?.status === "READY_HANDOVER" && (
        <Panel title="แนบลายเซ็นแทนการเขียนบนหน้าจอ">
          <Action {...actionBase} uc="UC-18" title="แนบลายเซ็นและยืนยันรับมอบ">
            <Field
              name="signature"
              title="รูปลายเซ็น (1 รูป ไม่เกิน 5 MB)"
              type="file"
            />
            <Check
              required
              title="ฉันยืนยันว่าลายเซ็นนี้เป็นของฉันและยืนยันรับมอบบ้านหลังนี้"
            />
          </Action>
        </Panel>
      )}
    </>
  );
}
