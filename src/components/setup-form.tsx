"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Field, sendAction } from "./manage-ui";
export function SetupForm() {
  const form = useRef<HTMLFormElement>(null),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(location.hash.slice(1)).get("code");
    const input = form.current?.elements.namedItem(
      "setup_code",
    ) as HTMLInputElement | null;
    if (code && input) input.value = code;
    if (location.hash) history.replaceState(null, "", "/setup");
  }, []);
  return (
    <main className="page-container flex min-h-dvh w-full items-center justify-center py-10">
      <section className="w-full max-w-lg space-y-6 rounded-box border border-base-300 bg-base-100 p-6">
        <h1 className="text-2xl">ตั้งแอดมินครั้งแรก</h1>
        <p>
          บัญชีเข้าใช้คือ <strong>ADMIN</strong>{" "}
          ตั้งชื่อที่แสดงและรหัสผ่านของคุณ รหัสตั้งค่าอยู่ในไฟล์ ADMIN-SETUP.md
          ที่เครื่องนี้
        </p>
        <p className="text-sm text-muted">
          หลังสร้างบัญชีแล้ว
          ระบบจะเปิดหน้าภาพรวมสำหรับจัดการโครงการและเพิ่มพนักงาน
        </p>
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        <form
          ref={form}
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            try {
              await sendAction(
                "/api/setup",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              router.replace("/");
              router.refresh();
            } catch (err) {
              setError(
                err instanceof TypeError
                  ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
                  : err instanceof Error
                    ? err.message
                    : "ตั้งค่าไม่ได้",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-5">
            <Field
              name="setup_code"
              label="รหัสตั้งค่าเฉพาะเครื่อง"
              type="password"
              max={128}
            />
            <Field name="full_name" label="ชื่อที่แสดง" />
            <Field
              name="phone_number"
              label="เบอร์โทรศัพท์"
              type="tel"
              required={false}
              max={10}
            />
            <Field name="email" label="อีเมล" type="email" required={false} />
            <Field
              name="password"
              label="รหัสผ่าน (อย่างน้อย 12 ตัวอักษร)"
              type="password"
              max={72}
              autoComplete="new-password"
            />
            <Field
              name="confirm_password"
              label="ยืนยันรหัสผ่าน"
              type="password"
              max={72}
              autoComplete="new-password"
            />
            <button type="submit" className="btn btn-primary w-full">
              {busy ? "กำลังตั้งค่า" : "สร้างบัญชีแอดมิน"}
            </button>
          </fieldset>
        </form>
        <Link href="/login" className="underline underline-offset-4">
          กลับหน้าเข้าสู่ระบบ
        </Link>
      </section>
    </main>
  );
}
