import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { workspace } from "@/server/workspace";
import { screenRoles, type Workspace } from "@/lib/runtime-contracts";
import { HomeHub } from "@/components/home-hub";
import { parseNext } from "@/lib/deep-link";
export const dynamic = "force-dynamic";
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; next?: string }>;
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
  // Q7 (A): a validated internal deep link is kept so that choosing a house
  // returns the user to the screen they asked for. Invalid values are ignored.
  const role = id.kind === "CUSTOMER" ? "CUSTOMER" : id.role;
  const deepLink = parseNext(p.next, screenRoles[role] ?? []);
  return (
    <HomeHub
      initial={w}
      selected={id.kind === "CUSTOMER" || Boolean(p.unit)}
      deepLink={deepLink}
    />
  );
}
