"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  type DataRow,
  type SessionView,
  roleLabels,
} from "@/lib/runtime-contracts";
import {
  AppFrame,
  Panel,
  Field,
  MutationForm,
  string,
  thaiTime,
} from "./manage-ui";
export function AccountPanel({
  identity,
  profile,
  sessions,
}: {
  identity: SessionView;
  profile: DataRow;
  sessions: DataRow[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const employee = identity.kind === "EMPLOYEE",
    forced = employee && identity.mustChangePassword;
  return (
    <AppFrame identity={identity} active="account" title="บัญชีของฉัน">
      {notice && (
        <p role="status" className="alert alert-success">
          {notice}
        </p>
      )}
      {forced && (
        <p role="status" className="alert alert-warning">
          บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสใหม่ก่อนเริ่มทำงาน
        </p>
      )}
      {!forced && (
        <Panel title="ข้อมูลส่วนตัว">
          <MutationForm
            key={string(profile.updated_at)}
            endpoint="/api/account/profile"
            onDone={(r) => setNotice(string(r.message))}
            extra={{ updated_at: profile.updated_at }}
            label="บันทึกข้อมูลส่วนตัว"
            primary
          >
            {employee ? (
              <>
                <p className="text-sm text-muted">
                  บัญชี {string(profile.employee_id)} ·{" "}
                  {roleLabels[identity.role]}
                </p>
                <Field
                  name="full_name"
                  label="ชื่อที่แสดง"
                  value={profile.full_name}
                />
              </>
            ) : (
              <p>
                {string(profile.full_name)} · เลขประจำตัว{" "}
                {string(profile.id_card_mask)}
              </p>
            )}
            <Field
              name="phone_number"
              label="เบอร์โทรศัพท์"
              type="tel"
              value={profile.phone_number}
              required={!(employee && identity.role === "ADMIN")}
              max={10}
            />
            <Field
              name="email"
              label="อีเมล"
              type="email"
              value={profile.email}
              required={false}
            />
          </MutationForm>
        </Panel>
      )}
      {employee && (
        <Panel title={forced ? "ตั้งรหัสผ่านใหม่" : "เปลี่ยนรหัสผ่าน"}>
          <MutationForm
            endpoint="/api/account/password"
            label="บันทึกรหัสผ่านใหม่"
            onDone={forced ? () => router.replace("/home") : undefined}
            primary={forced}
          >
            <Field
              name="current_password"
              label={forced ? "รหัสผ่านชั่วคราว" : "รหัสผ่านปัจจุบัน"}
              type="password"
              max={128}
              autoComplete="current-password"
            />
            <Field
              name="new_password"
              label="รหัสผ่านใหม่"
              type="password"
              max={72}
              autoComplete="new-password"
            />
            <p className="helper">
              ใช้คำหรือประโยคที่จำได้ อย่างน้อย 12 ตัวอักษร
            </p>
            <Field
              name="confirm_password"
              label="ยืนยันรหัสผ่านใหม่"
              type="password"
              max={72}
              autoComplete="new-password"
            />
          </MutationForm>
        </Panel>
      )}
      {!forced && (
        <Panel title="การเข้าสู่ระบบที่ยังเปิดอยู่">
          <p className="mb-4 text-muted">
            ออกจากระบบรายการที่ไม่ต้องการใช้ต่อได้
          </p>
          <ul className="divide-y divide-base-300">
            {sessions.map((s) => (
              <li
                key={string(s.session_ref)}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-medium">
                    {s.current_session
                      ? "การเข้าสู่ระบบครั้งนี้"
                      : "การเข้าสู่ระบบอีกครั้ง"}
                  </p>
                  <p className="text-sm text-muted">
                    เริ่ม {thaiTime(s.created_at)} · หมดอายุ{" "}
                    {thaiTime(s.expires_at)}
                  </p>
                </div>
                <MutationForm
                  endpoint="/api/account/revoke-session"
                  onDone={(r) => setNotice(string(r.message))}
                  extra={{ session_ref: s.session_ref }}
                  label={
                    s.current_session ? "ออกจากระบบนี้" : "ออกจากระบบรายการนี้"
                  }
                >
                  {null}
                </MutationForm>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AppFrame>
  );
}
