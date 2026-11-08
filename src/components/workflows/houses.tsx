"use client";
import { Action, Field, Panel, Select, str } from "./controls";
import { type WorkflowState } from "../workflow-frame";

export function RegisterHouse({ w, actionBase }: WorkflowState) {
  return (
    <Panel title="ข้อมูลบ้านใหม่">
      <p className="mb-5 text-muted">
        เตรียมชื่อโครงการและเลขที่บ้าน เมื่อบันทึกแล้วบ้านจะเข้าคิวตรวจ QC
      </p>
      {!w.projects.length && (
        <p className="alert alert-warning mb-5">
          ยังไม่มีโครงการที่รับบ้านใหม่ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      )}
      <Action
        {...actionBase}
        uc="UC-01"
        title="ลงทะเบียนบ้าน"
        primary
        disabled={!w.projects.length}
      >
        <Select
          name="project_id"
          title="โครงการ"
          items={w.projects.map((p) => ({
            value: str(p.project_id),
            title: str(p.project_name),
          }))}
        />
        <Field name="house_no" title="เลขที่บ้าน" max={20} />
        <Field name="unit_type" title="แบบบ้าน" required={false} max={50} />
      </Action>
    </Panel>
  );
}
