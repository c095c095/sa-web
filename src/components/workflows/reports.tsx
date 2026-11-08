"use client";
import { defectStatuses } from "@/lib/domain";
import {
  Action,
  Check,
  Defects,
  Empty,
  Field,
  Panel,
  RepairDocuments,
  str,
  when,
} from "./controls";
import { type WorkflowState } from "../workflow-frame";

export function IssueRepairReport({
  w,
  hand,
  handoverDefs,
  actionBase,
}: WorkflowState) {
  return (
    <>
      <RepairDocuments reports={w.reports} files={w.files} />
      <Panel title="สร้างเอกสารสรุปการซ่อม">
        <Action
          {...actionBase}
          uc="UC-16"
          extra={{ round_id: str(hand?.round_id) }}
          title="สร้างเอกสาร PDF"
          primary
          disabled={
            !hand ||
            !handoverDefs.length ||
            handoverDefs.some(
              (d) => !["FIXED", "VERIFIED"].includes(str(d.status)),
            )
          }
        >
          <p className="text-muted">
            สร้างได้เมื่อทุกจุดในรอบตรวจก่อนรับมอบซ่อมเสร็จแล้ว เอกสาร A4
            แนวตั้งรวมรูปที่อัปโหลดไว้จริง
          </p>
          <Field
            name="title"
            title="ชื่อเอกสาร"
            value="เอกสารสรุปการซ่อมก่อนรับมอบ"
          />
        </Action>
      </Panel>
    </>
  );
}

export function ReviewHandoverRepairs({
  w,
  hand,
  handoverDefs,
  canCustomer,
  actionBase,
}: WorkflowState) {
  return (
    <>
      <Panel title="ภาพรวมการซ่อมรอบตรวจก่อนรับมอบ">
        {hand ? (
          <>
            <p className="mb-3">
              เริ่มรอบตรวจ {when(hand.started_at)} · {handoverDefs.length} จุด
            </p>
            <dl className="flex flex-wrap gap-x-6 gap-y-3">
              {Object.entries(defectStatuses).map(([status, title]) => (
                <div key={status}>
                  <dt className="text-sm text-muted">{title}</dt>
                  <dd className="text-xl font-semibold tabular-nums">
                    {
                      handoverDefs.filter((defect) => defect.status === status)
                        .length
                    }
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <Empty>ยังไม่มีรอบตรวจก่อนรับมอบสำหรับบ้านหลังนี้</Empty>
        )}
      </Panel>
      <Panel title="รายการจุดและหลักฐานการซ่อม">
        <Defects files={w.files} items={handoverDefs} />
        {w.rounds
          .filter(
            (round) =>
              round.round_type === "CUSTOMER_HANDOVER" &&
              round.round_id !== hand?.round_id,
          )
          .map((round) => (
            <details
              key={str(round.round_id)}
              className="mt-4 border-t border-base-300 pt-4"
            >
              <summary className="cursor-pointer">
                รอบก่อนหน้า เริ่ม {when(round.started_at)}
              </summary>
              <Defects
                files={w.files}
                items={w.defects.filter(
                  (defect) => defect.round_id === round.round_id,
                )}
              />
            </details>
          ))}
      </Panel>
      <RepairDocuments reports={w.reports} files={w.files} />
      {canCustomer && (
        <Panel title="เลือกจุดที่ต้องการให้แก้ไขอีกครั้ง">
          <p className="mb-3 text-muted">
            ตรวจสถานะและรูปก่อนและหลังซ่อมด้านล่าง
            เลือกเฉพาะจุดซ่อมเสร็จที่ต้องการให้แก้อีกครั้ง
          </p>
          <Action
            {...actionBase}
            uc="UC-17"
            extra={{ accept: false }}
            title="ยืนยันไม่ผ่านและส่งกลับแก้"
            reset={false}
          >
            <Defects files={w.files} items={handoverDefs} select />
            <Field
              name="accept_reason"
              title="เหตุผลที่ไม่ยอมรับ"
              max={10000}
            />
          </Action>
        </Panel>
      )}
      {canCustomer && (
        <Panel title="ยอมรับสภาพบ้าน">
          <Action
            {...actionBase}
            uc="UC-17"
            extra={{ accept: true }}
            title="ยืนยันยอมรับสภาพ"
            primary
            disabled={handoverDefs.some(
              (d) => !["FIXED", "VERIFIED"].includes(str(d.status)),
            )}
          >
            <Check
              required
              title="ตรวจครบทุกจุดแล้ว ยอมรับสภาพบ้านเพื่อเข้าสู่ขั้นเซ็นรับมอบ"
            />
          </Action>
        </Panel>
      )}
    </>
  );
}
