import "server-only";
import { notFound, redirect } from "next/navigation";
import { type ComponentType } from "react";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { AppError } from "@/server/errors";
import { taskLanding } from "@/server/tasks";
import { workspace } from "@/server/workspace";
import { screenRoles, type Workspace } from "@/lib/runtime-contracts";
import { HomeHub } from "@/components/home-hub";
import { RegisterLanding, TaskLanding } from "@/components/task-landing";
import { RepairQueue } from "@/components/repair-queue";
import { WorkflowFrame, type WorkflowState } from "@/components/workflow-frame";
import { type ListFilters } from "@/lib/routes";
import { taskContext } from "@/lib/task-landing";

export type WorkflowQuery = Promise<
  Partial<Record<keyof ListFilters, string | string[]>>
>;
type Query = Awaited<WorkflowQuery>;

export async function pageIdentity() {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  if (id.kind === "EMPLOYEE" && id.mustChangePassword) redirect("/account");
  return id;
}

async function workflowIdentity(screen: string) {
  const id = await pageIdentity();
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN") redirect("/");
  const role = id.kind === "CUSTOMER" ? "CUSTOMER" : id.role;
  if (!screenRoles[role].includes(screen)) notFound();
  return id;
}

async function pageWorkspace(
  id: Awaited<ReturnType<typeof pageIdentity>>,
  unitId?: string,
): Promise<Workspace> {
  try {
    const w = {
      identity: publicIdentity(id),
      ...(await workspace(id, unitId)),
    } as Workspace;
    if (unitId && !w.unit) notFound();
    return w;
  } catch (e) {
    if (e instanceof AppError && (e.status === 403 || e.status === 404))
      notFound();
    throw e;
  }
}

function listFilters(query: Query): ListFilters {
  const value = (key: keyof ListFilters) =>
    typeof query[key] === "string" ? query[key] : undefined;
  return {
    q: value("q"),
    project: value("project"),
    status: value("status"),
    category: value("category"),
  };
}

export async function HouseOverview({
  unitId,
  fromRegister,
}: {
  unitId: string;
  fromRegister: boolean;
}) {
  const id = await pageIdentity();
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN") redirect("/");
  const backPath =
    fromRegister && id.kind === "EMPLOYEE" && id.role === "SALES"
      ? "/houses"
      : "/";
  return (
    <HomeHub
      initial={await pageWorkspace(id, unitId)}
      selected
      backPath={backPath}
    />
  );
}

export async function RegisterIndex({
  screen,
  query,
}: {
  screen: string;
  query: Query;
}) {
  const id = await workflowIdentity(screen);
  const w = await pageWorkspace(id);
  return (
    <RegisterLanding
      identity={w.identity}
      screen={screen}
      units={w.units}
      filters={listFilters(query)}
    />
  );
}

export async function RepairIndex({
  screen,
  query,
}: {
  screen: string;
  query: Query;
}) {
  const id = await workflowIdentity(screen);
  return (
    <RepairQueue
      initial={await pageWorkspace(id)}
      screen={screen}
      filters={listFilters(query)}
    />
  );
}

export async function HouseWorkflowIndex({
  screen,
  query,
}: {
  screen: string;
  query: Query;
}) {
  const id = await workflowIdentity(screen);
  const items =
    id.kind === "CUSTOMER"
      ? await customerItems(id, screen)
      : await taskLanding(id, screen);
  return (
    <TaskLanding
      identity={publicIdentity(id)}
      screen={screen}
      items={items}
      filters={listFilters(query)}
    />
  );
}

async function customerItems(
  id: Awaited<ReturnType<typeof pageIdentity>>,
  screen: string,
) {
  const w = await pageWorkspace(id);
  const { unit } = w;
  return unit
    ? [
        {
          unit,
          task: { screen, title: "เปิดรายละเอียด", hint: "" },
          primary: true,
          context: taskContext(w, screen),
        },
      ]
    : [];
}

export async function WorkflowDetail({
  screen,
  Operation,
  query,
  unitId,
  defectId,
}: {
  screen: string;
  Operation: ComponentType<WorkflowState>;
  query: Query;
  unitId?: string;
  defectId?: string;
}) {
  const id = await workflowIdentity(screen);
  const w = await pageWorkspace(id, unitId);
  if (defectId && !w.defects.some((d) => String(d.defect_id) === defectId))
    notFound();
  return (
    <WorkflowFrame
      key={JSON.stringify([screen, unitId, defectId])}
      initial={w}
      screen={screen}
      Operation={Operation}
      selectedDefect={defectId}
      listQuery={listFilters(query)}
    />
  );
}
