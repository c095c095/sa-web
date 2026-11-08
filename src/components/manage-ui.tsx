"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { House, LogOut, Menu, ArrowLeft, UserRound } from "lucide-react";
import { type SessionView, roleLabels } from "@/lib/runtime-contracts";
export const string = (v: unknown) => String(v ?? "");
export const thaiTime = (v: unknown) =>
  v
    ? new Date(
        string(v).replace(" ", "T") + (string(v).endsWith("Z") ? "" : "Z"),
      ).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
    : "ยังไม่ระบุ";
export function AppFrame({
  identity,
  children,
  active = "home",
  title,
  nav,
}: {
  identity: SessionView;
  children: ReactNode;
  active?: string;
  title?: string;
  nav?: { href: string; label: string; key: string }[];
}) {
  const router = useRouter(),
    [error, setError] = useState("");
  const admin = identity.kind === "EMPLOYEE" && identity.role === "ADMIN";
  const items = nav ?? [
    {
      key: "home",
      href: admin ? "/admin" : "/home",
      label: admin ? "ภาพรวม" : "งานของฉัน",
    },
  ];
  const initial = identity.fullName.trim().slice(0, 2) || "ผ";
  const links = (
    <ul className="menu w-full gap-1">
      {items.map((x) => (
        <li key={x.key}>
          <Link
            href={x.href}
            aria-current={active === x.key ? "page" : undefined}
            className={
              active === x.key
                ? "bg-base-300 text-base-content font-medium"
                : ""
            }
          >
            {x.label}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <a className="skip-link" href="#main-content">
        ข้ามไปเนื้อหา
      </a>
      <header className="border-b border-base-300 bg-base-100">
        <div className="page-container flex flex-wrap items-center gap-4 py-5">
          <Link
            href={admin ? "/admin" : "/home"}
            className="flex items-center gap-3 font-semibold"
          >
            <House size={24} aria-hidden="true" />
            ระบบตรวจและส่งมอบบ้าน
          </Link>
          <details className="dropdown dropdown-end ml-auto">
            <summary className="btn btn-ghost list-none gap-2" aria-label="เมนูบัญชี">
              <div className="avatar avatar-placeholder">
                <div className="size-9 rounded-full bg-neutral text-sm text-neutral-content">
                  <span>{initial}</span>
                </div>
              </div>
              <span className="hidden text-left sm:block">
                <span className="block text-sm">{identity.fullName}</span>
                <span className="block text-xs text-muted">
                  {identity.kind === "CUSTOMER"
                    ? "ลูกค้า / บริษัทตรวจนอก"
                    : roleLabels[identity.role]}
                </span>
              </span>
            </summary>
            <ul className="menu dropdown-content z-10 mt-3 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow">
              <li className="menu-title pointer-events-none">
                <span className="flex items-center gap-3 normal-case">
                  <UserRound size={18} aria-hidden="true" />
                  <span>
                    <span className="block">{identity.fullName}</span>
                    <span className="block text-xs font-normal text-muted">
                      {identity.kind === "CUSTOMER"
                        ? "ลูกค้า / บริษัทตรวจนอก"
                        : roleLabels[identity.role]}
                    </span>
                  </span>
                </span>
              </li>
              <li>
                <Link href="/account">บัญชีของฉัน</Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/auth/logout", { method: "POST" });
                      if (!r.ok) throw Error();
                      router.replace("/login");
                      router.refresh();
                    } catch {
                      setError("ออกจากระบบไม่ได้ กรุณาลองใหม่");
                    }
                  }}
                >
                  <LogOut size={18} aria-hidden="true" />
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          </details>
        </div>
      </header>
      <div className="page-container grid w-full flex-1 gap-6 py-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside>
          <nav aria-label="เมนูหลัก">
            <details className="lg:hidden">
              <summary className="flex min-h-12 cursor-pointer items-center gap-2">
                <Menu size={18} aria-hidden="true" />
                เมนู
              </summary>
              {links}
            </details>
            <div className="hidden lg:block">{links}</div>
          </nav>
        </aside>
        <main id="main-content" className="min-w-0 space-y-6">
          {title && <h1 className="page-heading">{title}</h1>}
          {error && (
            <p className="alert alert-error" role="alert">
              {error}
            </p>
          )}
          {children}
        </main>
      </div>
      <footer className="page-container w-full border-t border-base-300 py-5 text-sm text-muted">
        กรณีศึกษา โครงการ ANNA Townhome ราชพฤกษ์-แจ้งวัฒนะ ·
        ข้อมูลตั้งต้นสมมติสำหรับโครงงาน
      </footer>
    </>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-5 sm:p-7">
      <h2 className="mb-5 text-xl">{title}</h2>
      {children}
    </section>
  );
}
export function Field({
  name,
  label,
  value,
  type = "text",
  required = true,
  max = 100,
  readOnly = false,
  autoComplete,
}: {
  name: string;
  label: string;
  value?: unknown;
  type?: string;
  required?: boolean;
  max?: number;
  readOnly?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {!required && " (ไม่บังคับ)"}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={string(value)}
        type={type}
        required={required}
        maxLength={max}
        readOnly={readOnly}
        autoComplete={autoComplete ?? "off"}
        className="input w-full"
      />
    </div>
  );
}
export function Choice({
  name,
  label,
  options,
  value,
  required = true,
  onChange,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  value?: unknown;
  required?: boolean;
  onChange?: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={string(value)}
        required={required}
        onChange={(e) => onChange?.(e.target.value)}
        className="select w-full"
      >
        <option value="" disabled={required}>
          {required ? "เลือกรายการ" : "ไม่ระบุ"}
        </option>
        {options.map((x) => (
          <option key={x.value} value={x.value}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function Confirm({ children }: { children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <input type="checkbox" required className="checkbox mt-1 shrink-0" />
      <span>{children}</span>
    </label>
  );
}
export async function sendAction(
  endpoint: string,
  data: Record<string, unknown>,
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await response.json();
  if (!response.ok)
    throw new Error(
      (json.error?.message ?? "บันทึกไม่ได้") +
        " " +
        Object.values(json.error?.fields ?? {})
          .flat()
          .join(" "),
    );
  return json.data as Record<string, unknown>;
}
export function MutationForm({
  endpoint,
  extra = {},
  children,
  label = "บันทึก",
  primary = false,
  onDone,
  reset = false,
}: {
  endpoint: string;
  extra?: Record<string, unknown>;
  children: ReactNode;
  label?: string;
  primary?: boolean;
  onDone?: (result: Record<string, unknown>) => void;
  reset?: boolean;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      fd = new FormData(form);
    const data: Record<string, unknown> = {
      ...Object.fromEntries(fd),
      ...extra,
    };
    for (const key of ["is_active", "archived"])
      if (fd.has(key)) data[key] = fd.get(key) === "true";
    if (fd.has("defect_ids")) data.defect_ids = fd.getAll("defect_ids");
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await sendAction(endpoint, data);
      if (result.signedOut) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setMessage(string(result.message));
      if (reset) form.reset();
      onDone?.(result);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่"
          : e instanceof Error
            ? e.message
            : "บันทึกไม่ได้ กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={busy} className="space-y-5">
        {children}
        {error && (
          <p role="alert" className="alert alert-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="alert alert-success">
            {message}
          </p>
        )}
        <button type="submit" className={`btn ${primary ? "btn-primary" : ""}`}>
          {busy ? (
            <>
              <span
                className="loading loading-spinner loading-sm"
                aria-hidden="true"
              />
              กำลังบันทึก
            </>
          ) : (
            label
          )}
        </button>
      </fieldset>
    </form>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={id} onClose={onClose}>
      <div className="modal-box max-h-[90dvh] w-full max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={id} className="text-xl">
            {title}
          </h2>
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={() => ref.current?.close()}
          >
            ปิด
          </button>
        </div>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button aria-label="ปิดหน้าต่าง">ปิด</button>
      </form>
    </dialog>
  );
}
export function Back({
  href = "/home",
  children = "กลับไปงานของฉัน",
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 underline underline-offset-4"
    >
      <ArrowLeft size={18} aria-hidden="true" />
      {children}
    </Link>
  );
}
