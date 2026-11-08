import { redirect } from "next/navigation";
import { currentIdentity, publicIdentity } from "@/server/auth";
import { accountView } from "@/server/management";
import { AccountPanel } from "@/components/account-panel";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const id = await currentIdentity();
  if (!id) redirect("/login");
  const data = await accountView(id);
  return <AccountPanel identity={publicIdentity(id)} {...data} />;
}
