import { publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { pageIdentity } from "@/server/workflow-pages";
import { type Workspace } from "@/lib/runtime-contracts";
import { HomeHub } from "@/components/home-hub";
import AdminPage from "@/server/admin-page";

export default async function Page({ searchParams }: PageProps<"/">) {
  const id = await pageIdentity();
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN")
    return <AdminPage section="overview" searchParams={searchParams} />;
  const initial = {
    identity: publicIdentity(id),
    ...(await workspace(id)),
  } as Workspace;
  return <HomeHub initial={initial} selected={id.kind === "CUSTOMER"} />;
}
