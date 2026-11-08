import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { screenRoles, type Workspace } from "@/lib/runtime-contracts";
import { Workbench } from "@/components/workbench";
import { journey } from "@/lib/journey";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; unit?: string; defect?: string }>;
}) {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  if (id.kind === "EMPLOYEE" && id.mustChangePassword) redirect("/account");
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN") redirect("/admin");
  const p = await searchParams;
  if (!p.screen && !p.unit && id.kind === "EMPLOYEE") redirect("/home");
  const role = id.kind === "CUSTOMER" ? "CUSTOMER" : id.role;
  const allowed = screenRoles[role];
  const w = {
    identity: publicIdentity(id),
    ...(await workspace(id, p.unit || undefined)),
  } as Workspace;
  const preferred =
    journey(w).actions[0]?.screen ??
    (role === "CUSTOMER" ? "SCR-17" : allowed[0]);
  const screen = allowed.includes(p.screen ?? "") ? p.screen! : preferred;
  return (
    <Workbench
      key={screen + str(w.unit?.unit_id) + str(p.defect)}
      initial={w}
      screen={screen}
      selectedDefect={p.defect}
    />
  );
}
const str = (v: unknown) => String(v ?? "");
