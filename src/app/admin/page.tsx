import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { managementView } from "@/server/management";
import { AdminPanel } from "@/components/admin-panel";
import { type ManagementView } from "@/lib/management-contracts";
export const dynamic = "force-dynamic";
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  if (id.kind !== "EMPLOYEE" || id.role !== "ADMIN") redirect("/home");
  if (id.mustChangePassword) redirect("/account");
  const p = await searchParams,
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(p))
    if (typeof value === "string") params.set(key, value);
  const view = (await managementView(id, params)) as ManagementView;
  return (
    <AdminPanel
      identity={publicIdentity(id)}
      view={view}
      query={params.get("q") ?? ""}
      status={params.get("status") ?? ""}
      sort={
        params.get("sort") ??
        (["employees", "projects", "customers"].includes(view.section)
          ? "name"
          : "newest")
      }
    />
  );
}
