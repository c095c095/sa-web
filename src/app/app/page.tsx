import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { screenRoles, type Workspace } from "@/lib/runtime-contracts";
import { Workbench } from "@/components/workbench";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ screen?: string; unit?: string }>;
}) {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  const p = await searchParams;
  const role = id.kind === "CUSTOMER" ? "CUSTOMER" : id.role;
  const allowed = screenRoles[role];
  const w = {
    identity: publicIdentity(id),
    ...(await workspace(id, p.unit || undefined)),
  } as Workspace;
  const preferred =
    role === "CUSTOMER"
      ? w.unit?.status === "CONTRACTED"
        ? "SCR-10"
        : ["READY_HANDOVER", "HANDED_OVER"].includes(str(w.unit?.status))
          ? "SCR-18"
          : "SCR-17"
      : allowed[0];
  const screen = allowed.includes(p.screen ?? "") ? p.screen! : preferred;
  return (
    <Workbench
      key={screen + str(w.unit?.unit_id)}
      initial={w}
      screen={screen}
    />
  );
}
const str = (v: unknown) => String(v ?? "");
