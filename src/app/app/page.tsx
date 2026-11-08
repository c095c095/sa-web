import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { screenRoles, type Workspace } from "@/lib/runtime-contracts";
import { Workbench } from "@/components/workbench";
import { journey } from "@/lib/journey";
import { buildAppPath, requiresHouse } from "@/lib/deep-link";
import { landingPath, redirectsToLanding } from "@/lib/task-landing";
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
  // Phase 1A (F12, Q7): a house-scoped screen opened without a house must not
  // pick one silently. Send the employee to the house picker and keep the target.
  if (id.kind === "EMPLOYEE" && !p.unit) {
    const requested = allowed.includes(p.screen ?? "") ? p.screen! : null;
    // Decision 4: a legacy link to a screen that has a landing page goes there
    // (only an allowed screen; a link with a defect keeps the picker so the
    // defect is not dropped).
    if (requested && !p.defect && redirectsToLanding(id.role, requested))
      redirect(landingPath(requested));
    const wanted = requested ?? allowed[0];
    if (wanted && requiresHouse(wanted))
      redirect(
        "/home?next=" +
          encodeURIComponent(buildAppPath({ screen: wanted, defect: p.defect })),
      );
  }
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
