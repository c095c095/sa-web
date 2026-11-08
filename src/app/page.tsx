import { publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { pageIdentity } from "@/server/workflow-pages";
import { type Workspace } from "@/lib/runtime-contracts";
import { HomeHub } from "@/components/home-hub";
import AdminPage from "@/server/admin-page";
import { taskLanding } from "@/server/tasks";

export default async function Page({ searchParams }: PageProps<"/">) {
  const id = await pageIdentity();
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN")
    return <AdminPage section="overview" searchParams={searchParams} />;
  const [data, tasks] = await Promise.all([
    workspace(id),
    id.kind === "EMPLOYEE" && (id.role === "SALES" || id.role === "INSPECTOR")
      ? taskLanding(id)
      : [],
  ]);
  const initial = {
    identity: publicIdentity(id),
    ...data,
  } as Workspace;
  const work = new Map<string, number>();
  for (const { task } of tasks)
    work.set(task.screen, (work.get(task.screen) ?? 0) + 1);
  return (
    <HomeHub
      initial={initial}
      selected={id.kind === "CUSTOMER"}
      workCounts={Object.fromEntries(work)}
    />
  );
}
