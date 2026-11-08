"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { House, LogIn } from "lucide-react";
export function LoginForm({
  access = false,
  initialToken = "",
  setupAvailable = false,
}: {
  access?: boolean;
  initialToken?: string;
  setupAvailable?: boolean;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  const [capturedToken] = useState(initialToken);
  const tokenInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!access) return;
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get(
      "token",
    );
    if (fragment && tokenInput.current) tokenInput.current.value = fragment;
    if (window.location.hash || window.location.search)
      window.history.replaceState(null, "", "/access");
  }, [access]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setPending(true);
    try {
      let token = String(form.get("token") ?? initialToken);
      try {
        const url = new URL(token);
        token =
          url.searchParams.get("token") ??
          new URLSearchParams(url.hash.slice(1)).get("token") ??
          token;
      } catch {}
      const response = await fetch(
        access ? "/api/auth/access" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            access
              ? { token }
              : {
                  employee_id: form.get("employee_id"),
                  password: form.get("password"),
                },
          ),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "เข้าสู่ระบบไม่ได้ กรุณาลองใหม่",
        );
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
          : e instanceof Error
            ? e.message
            : "เชื่อมต่อไม่ได้ กรุณาลองใหม่",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="page-container flex min-h-dvh w-full items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-field bg-neutral text-neutral-content">
            <House size={24} aria-hidden="true" />
          </span>
          <p className="font-semibold">ระบบตรวจและส่งมอบบ้าน</p>
        </div>
        <section className="rounded-box bg-base-100 p-6 sm:p-8">
          <h1 className="text-2xl">
            {access ? "เข้าดูบ้านของคุณ" : "เข้าสู่ระบบพนักงาน"}
          </h1>
          {setupAvailable && (
            <p className="alert alert-info mt-5">
              เริ่มใช้ระบบครั้งแรก{" "}
              <Link className="underline underline-offset-4" href="/setup">
                ตั้งบัญชีแอดมิน
              </Link>
            </p>
          )}
          <p className="mt-2 text-muted">
            {access
              ? "ใช้ลิงก์ที่ได้รับจากฝ่ายขายเพื่อแจ้งจุดและติดตามการซ่อม"
              : "ใช้รหัสบัญชีและรหัสผ่านของคุณ"}
          </p>
          {error && (
            <p role="alert" className="alert alert-error mt-5">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="mt-7 space-y-5">
            {access ? (
              <div>
                <label htmlFor="token" className="field-label">
                  ลิงก์เข้าสู่ระบบ
                </label>
                <input
                  id="token"
                  ref={tokenInput}
                  type="password"
                  name="token"
                  autoComplete="off"
                  defaultValue={capturedToken}
                  required
                  className="input w-full"
                  aria-describedby="link-help"
                />
                <p id="link-help" className="helper mt-2">
                  ลิงก์ใช้ได้ 30 วัน หากหมดอายุหรือใช้ไม่ได้
                  ให้ติดต่อฝ่ายขายพร้อมเลขที่บ้านและชื่อโครงการเพื่อขอลิงก์ใหม่
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="employee_id" className="field-label">
                    รหัสพนักงาน
                  </label>
                  <input
                    id="employee_id"
                    aria-describedby="employee-help"
                    name="employee_id"
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={12}
                    className="input w-full"
                  />
                  <p id="employee-help" className="helper mt-1">
                    พนักงานใช้รหัสที่ได้รับ ผู้ดูแลระบบใช้ ADMIN
                    หากจำรหัสผ่านไม่ได้ ให้ติดต่อผู้ดูแลระบบ
                  </p>
                </div>
                <div>
                  <label htmlFor="password" className="field-label">
                    รหัสผ่าน
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    className="input w-full"
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={pending}
            >
              {pending ? (
                <span
                  className="loading loading-spinner loading-sm"
                  aria-hidden="true"
                />
              ) : (
                <LogIn size={18} aria-hidden="true" />
              )}
              {pending
                ? "กำลังตรวจสอบ"
                : access
                  ? "เปิดข้อมูลบ้าน"
                  : "เข้าสู่ระบบ"}
            </button>
          </form>
        </section>
        <p className="mt-6 text-center text-muted">
          {access ? (
            <Link href="/login" className="underline underline-offset-4">
              สำหรับพนักงาน
            </Link>
          ) : (
            <Link href="/access" className="underline underline-offset-4">
              ลูกค้า/บริษัทตรวจนอก เข้าทางลิงก์
            </Link>
          )}
        </p>
        <p className="mt-8 text-sm text-muted">
          ชุดข้อมูลสำหรับโครงงานเป็นข้อมูลสมมติ ระบบบันทึกการเปลี่ยนแปลงได้จริง
        </p>
      </div>
    </main>
  );
}
