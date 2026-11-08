"use client";
import { Action, Check, Empty, Field, Panel, str } from "./controls";
import { type WorkflowState } from "../workflow-frame";

export function MarkReadyForSale({
  w,
  unit,
  unitId,
  unitExtra,
  actionBase,
}: WorkflowState) {
  return (
    <Panel title="พร้อมขาย">
      <p className="mb-5 text-muted">
        เมื่อรอบ QC ปิดแล้วจึงแจ้งฝ่ายขายให้ทำสัญญาและผูกลูกค้าได้
      </p>
      <Action
        {...actionBase}
        uc="UC-08"
        extra={unitExtra}
        title="แจ้งบ้านพร้อมขาย"
        primary
        disabled={
          !unitId ||
          unit?.status !== "IN_QC" ||
          !w.rounds.some(
            (r) => r.round_type === "QC_INTERNAL" && r.status === "CLOSED",
          )
        }
      >
        <Check required title="ตรวจข้อมูลบ้านและการปิดรอบ QC แล้ว" />
      </Action>
    </Panel>
  );
}

export function IssueCustomerAccess({
  unit,
  unitExtra,
  actionBase,
}: WorkflowState) {
  return (
    <Panel title="ผูกลูกค้าและออกลิงก์">
      {unit?.status === "READY_TO_SELL" ? (
        <Action
          {...actionBase}
          uc="UC-09"
          extra={unitExtra}
          title="ผูกลูกค้าและสร้างลิงก์"
          primary
        >
          <Field name="id_card_no" title="เลขประจำตัวลูกค้า 13 หลัก" max={13} />
          <Field name="full_name" title="ชื่อ–นามสกุลลูกค้า" />
          <Field
            name="phone_number"
            title="เบอร์โทรศัพท์"
            type="tel"
            max={10}
          />
          <Field name="email" title="อีเมล" type="email" required={false} />
        </Action>
      ) : unit?.customer_id && unit.status !== "HANDED_OVER" ? (
        <>
          <p className="mb-5">
            ลูกค้า {str(unit.customer_name)} · ลิงก์ใหม่มีอายุ 30 วัน
          </p>
          <Action
            {...actionBase}
            uc="UC-09"
            extra={unitExtra}
            title="สร้างลิงก์ใหม่ให้ลูกค้าเดิม"
            primary
          />
        </>
      ) : (
        <Empty>เลือกบ้านที่พร้อมขายหรือผูกลูกค้าแล้วและยังไม่ส่งมอบ</Empty>
      )}
    </Panel>
  );
}
