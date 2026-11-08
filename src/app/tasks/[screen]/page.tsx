import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { taskLanding } from "@/server/tasks";
import { screenRoles, screens, type Workspace } from "@/lib/runtime-contracts";
import { landingKind, jobTab } from "@/lib/task-landing";
import { HomeHub } from "@/components/home-hub";
import { RegisterLanding, TaskLanding } from "@/components/task-landing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 2A (Q10 = B): the landing page of a menu item. Authorization is checked
// on every request: login, password change, role, and the role's allowed screens.
export default async function TasksPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  if (id.kind === "EMPLOYEE" && id.mustChangePassword) redirect("/account");
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN") redirect("/admin");
  // Customers keep their existing pages (Q12).
  if (id.kind === "CUSTOMER") redirect("/home");
  const { screen } = await params;
  if (!(screenRoles[id.role] ?? []).includes(screen)) redirect("/home");
  const kind = landingKind(id.role, screen);
  // A screen without a landing page keeps the Phase 1A behavior.
  if (!kind) redirect("/app?screen=" + encodeURIComponent(screen));
  if (kind === "register")
    return <RegisterLanding identity={publicIdentity(id)} screen={screen} />;
  if (kind === "jobs") {
    const w = {
      identity: publicIdentity(id),
      ...(await workspace(id)),
    } as Workspace;
    return (
      <HomeHub
        initial={w}
        active={screen}
        title={screens[screen]}
        initialTab={jobTab(screen)}
      />
    );
  }
  return (
    <TaskLanding
      identity={publicIdentity(id)}
      screen={screen}
      items={await taskLanding(id, screen)}
    />
  );
}
