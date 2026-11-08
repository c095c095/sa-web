import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { type Workspace } from "@/lib/runtime-contracts";
import { HomeHub } from "@/components/home-hub";
export const dynamic = "force-dynamic";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  if (id.kind === "EMPLOYEE" && id.mustChangePassword) redirect("/account");
  if (id.kind === "EMPLOYEE" && id.role === "ADMIN") redirect("/admin");
  const p = await searchParams;
  const w = {
    identity: publicIdentity(id),
    ...(await workspace(id, p.unit || undefined)),
  } as Workspace;
  return (
    <HomeHub initial={w} selected={id.kind === "CUSTOMER" || Boolean(p.unit)} />
  );
}
