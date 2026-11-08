"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { landingKind, landingPath } from "@/lib/task-landing";
import {
  House,
  LogOut,
  Menu,
  ArrowLeft,
  UserRound,
  X,
  ClipboardCheck,
  LayoutDashboard,
  FolderOpen,
  Building2,
  Users,
  UserCog,
  Link2,
  History,
  ShieldCheck,
  Hammer,
  CheckSquare,
  FileText,
  ClipboardList,
  SendHorizontal,
  Calendar,
  PackageCheck,
  UserPlus,
  FileBadge,
  Wrench,
  ListChecks,
  ScanLine,
  ListPlus,
} from "lucide-react";
import {
  type SessionView,
  roleLabels,
  screens,
  screenRoles,
} from "@/lib/runtime-contracts";
import { managementSections } from "@/lib/management-contracts";

export const string = (v: unknown) => String(v ?? "");
export const thaiTime = (v: unknown) =>
  v
    ? new Date(
        string(v).replace(" ", "T") + (string(v).endsWith("Z") ? "" : "Z"),
      ).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
    : "ยังไม่ระบุ";

/* ── Icon map ── */
const sectionIcons: Record<string, React.ReactNode> = {
  overview: <LayoutDashboard size={16} aria-hidden="true" />,
  projects: <FolderOpen size={16} aria-hidden="true" />,
  units: <Building2 size={16} aria-hidden="true" />,
  customers: <Users size={16} aria-hidden="true" />,
  employees: <UserCog size={16} aria-hidden="true" />,
  links: <Link2 size={16} aria-hidden="true" />,
  sessions: <ShieldCheck size={16} aria-hidden="true" />,
  audit: <History size={16} aria-hidden="true" />,
};
const screenIcons: Record<string, React.ReactNode> = {
  home: <ClipboardCheck size={16} aria-hidden="true" />,
  "SCR-01": <ListPlus size={16} aria-hidden="true" />,
  "SCR-02": <ScanLine size={16} aria-hidden="true" />,
  "SCR-03": <Wrench size={16} aria-hidden="true" />,
  "SCR-04": <Hammer size={16} aria-hidden="true" />,
  "SCR-05": <CheckSquare size={16} aria-hidden="true" />,
  "SCR-06": <Calendar size={16} aria-hidden="true" />,
  "SCR-07": <PackageCheck size={16} aria-hidden="true" />,
  "SCR-08": <SendHorizontal size={16} aria-hidden="true" />,
  "SCR-09": <UserPlus size={16} aria-hidden="true" />,
  "SCR-10": <ClipboardList size={16} aria-hidden="true" />,
  "SCR-11": <FileBadge size={16} aria-hidden="true" />,
  "SCR-12": <FileText size={16} aria-hidden="true" />,
  "SCR-13": <Building2 size={16} aria-hidden="true" />,
  "SCR-14": <ListChecks size={16} aria-hidden="true" />,
  "SCR-15": <ListPlus size={16} aria-hidden="true" />,
  "SCR-16": <FileText size={16} aria-hidden="true" />,
  "SCR-17": <ListChecks size={16} aria-hidden="true" />,
  "SCR-18": <CheckSquare size={16} aria-hidden="true" />,
};

export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span className="loading loading-spinner loading-xs" role="status" aria-label="กำลังเปิดข้อมูล" /> : null;
}

function SidebarNav({
  items,
  active,
  admin,
  onClick,
}: {
  items: { key: string; label: string; href: string }[];
  active: string;
  admin: boolean;
  onClick?: () => void;
}) {
  return (
    <nav aria-label="เมนูหลัก">
      <ul className="flex flex-col gap-0.5">
        {items.map((x) => (
          <li key={x.key}>
            <Link
              href={x.href}
              aria-current={active === x.key ? "page" : undefined}
              className="sidebar-link"
              onClick={onClick}
            >
              {admin
                ? (sectionIcons[x.key] ?? (
                    <FolderOpen size={16} aria-hidden="true" />
                  ))
                : (screenIcons[x.key] ?? (
                    <ClipboardCheck size={16} aria-hidden="true" />
                  ))}
              <span className="min-w-0 truncate">{x.label}</span>
              <LinkPending />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Phase 1C (F2): the one place that builds the employee/customer menu, so
// The same menu opens the overview and task indexes from every work screen.
export function buildNav(identity: SessionView) {
  const role = identity.kind === "CUSTOMER" ? "CUSTOMER" : identity.role;
  return [
    { key: "home", href: "/home", label: "ภาพรวม" },
    ...(screenRoles[role] ?? []).map((key) => ({
      key,
      label: screens[key],
      // Phase 2A: a menu item with a landing page opens it and carries no house.
      href: role === "CUSTOMER" || landingKind(role, key)
        ? landingPath(key)
        : "/app?screen=" + key,
    })),
  ];
}

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
  const router = useRouter();
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prevActive, setPrevActive] = useState(active);
  const drawerId = useId();
  const menuId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  if (active !== prevActive) {
    setPrevActive(active);
    setDrawerOpen(false);
  }

  // Phase 1D (F7): the menu panel comes after the content in the DOM, so on open
  // move focus into it; on close return focus to the button that opened it.
  useEffect(() => {
    if (drawerOpen) {
      wasOpen.current = true;
      // The panel is still visibility:hidden while it slides in, and hidden
      // elements cannot take focus, so retry until focus lands inside it.
      let tries = 0;
      const t = window.setInterval(() => {
        const panel = menuPanel.current;
        panel?.querySelector<HTMLElement>("a")?.focus();
        if (panel?.contains(document.activeElement) || ++tries > 15)
          window.clearInterval(t);
      }, 50);
      return () => window.clearInterval(t);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      menuButton.current?.focus();
    }
  }, [drawerOpen]);

  const admin = identity.kind === "EMPLOYEE" && identity.role === "ADMIN";
  const items =
    nav ??
    (admin
      ? Object.entries(managementSections).map(([key, label]) => ({
          key,
          label,
          href: "/admin?section=" + key,
        }))
      : buildNav(identity));
  const initial = identity.fullName.trim().slice(0, 2) || "ผ";
  const roleName =
    identity.kind === "CUSTOMER"
      ? "ลูกค้า / บริษัทตรวจนอก"
      : roleLabels[identity.role];

  return (
    <>
      <a className="skip-link" href="#main-content">
        ข้ามไปเนื้อหา
      </a>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-base-300 bg-base-100">
        <div className="page-container flex items-center gap-3 py-3.5">
          {/* Mobile hamburger */}
          <button
            ref={menuButton}
            type="button"
            className="btn btn-ghost btn-sm lg:hidden"
            aria-label="เปิดเมนู"
            aria-expanded={drawerOpen}
            aria-controls={menuId}
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>

          <Link
            href={admin ? "/admin" : "/home"}
            className="flex items-center gap-2.5 font-semibold text-base-content"
          >
            <House size={22} aria-hidden="true" />
            <span className="hidden sm:block">ระบบตรวจและส่งมอบบ้าน</span>
            <span className="sm:hidden">ตรวจบ้าน</span>
          </Link>

          {/* User menu */}
          <details className="dropdown dropdown-end ml-auto">
            <summary
              className="btn btn-ghost list-none gap-2 pl-2 pr-1"
              aria-label="เมนูบัญชี"
            >
              <div className="avatar avatar-placeholder">
                <div className="size-9 rounded-full bg-neutral text-sm text-neutral-content">
                  <span>{initial}</span>
                </div>
              </div>
              <span className="hidden flex-col text-left sm:flex">
                <span className="text-sm font-medium leading-tight">
                  {identity.fullName}
                </span>
                <span className="text-xs text-muted">{roleName}</span>
              </span>
            </summary>
            <ul className="menu dropdown-content z-50 mt-2 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
              {/* Identity block */}
              <li className="pointer-events-none mb-1">
                <div className="flex items-center gap-3 rounded-field bg-base-200 px-3 py-2.5">
                  <div className="avatar avatar-placeholder shrink-0">
                    <div className="size-9 rounded-full bg-neutral text-sm text-neutral-content">
                      <span>{initial}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-base-content">
                      {identity.fullName}
                    </p>
                    <p className="text-xs text-muted">{roleName}</p>
                  </div>
                </div>
              </li>
              <li>
                <Link href="/account">
                  <UserRound size={16} aria-hidden="true" />
                  บัญชีของฉัน
                </Link>
              </li>
              <li className="mt-1 border-t border-base-300 pt-1">
                <button
                  type="button"
                  className="text-error"
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/auth/logout", {
                        method: "POST",
                      });
                      if (!r.ok) throw Error();
                      router.replace("/login");
                      router.refresh();
                    } catch {
                      setError("ออกจากระบบไม่ได้ กรุณาลองใหม่");
                    }
                  }}
                >
                  <LogOut size={16} aria-hidden="true" />
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          </details>
        </div>
      </header>

      {/* ── Layout: one menu (drawer-side). Off-canvas below lg, fixed at the left from lg up ── */}
      <div
        className="drawer lg:drawer-open"
        onKeyDown={(e) => {
          if (e.key === "Escape" && drawerOpen) setDrawerOpen(false);
        }}
      >
        <input
          id={drawerId}
          type="checkbox"
          className="drawer-toggle"
          tabIndex={-1}
          aria-hidden="true"
          checked={drawerOpen}
          onChange={(e) => setDrawerOpen(e.target.checked)}
        />

        {/* Main content */}
        <div className="drawer-content">
          <div className="page-container w-full flex-1 py-6">
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
        </div>

        {/* Mobile drawer sidebar */}
        <div className="drawer-side z-40">
          <button
            type="button"
            tabIndex={-1}
            aria-label="ปิดเมนู"
            className="drawer-overlay lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id={menuId}
            ref={menuPanel}
            className="sidebar-menu w-72 border-r border-base-300"
          >
            {/* Drawer header */}
            <div className="mb-3 flex items-center justify-between pb-3 border-b border-base-300">
              <span className="font-semibold text-base-content">เมนูหลัก</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle lg:hidden"
                aria-label="ปิดเมนู"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <SidebarNav
              items={items}
              active={active}
              admin={admin}
              onClick={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel-surface p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
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
    [toast, setToast] = useState("");

  /* Auto-dismiss toast */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
    setToast("");
    setBusy(true);
    try {
      const result = await sendAction(endpoint, data);
      if (result.signedOut) {
        router.replace("/login");
        router.refresh();
        return;
      }
      setToast(string(result.message));
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
    <>
      {/* Toast notification */}
      {toast && (
        <div
          className="toast toast-end toast-top toast-notice z-50"
          role="status"
          aria-live="polite"
        >
          <div className="alert alert-success shadow-lg">
            <span>{toast}</span>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy} className="space-y-5">
          {children}
          {error && (
            <p role="alert" className="alert alert-error">
              {error}
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
    </>
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
  children = "กลับไปภาพรวม",
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
