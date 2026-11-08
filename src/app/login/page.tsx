import { redirect } from "next/navigation";
import { currentIdentity } from "@/server/auth";
import { LoginForm } from "@/components/login-form";
import { setupAvailable } from "@/server/management";
export const metadata = { title: "เข้าสู่ระบบพนักงาน" };
export default async function Page() {
  if (await currentIdentity()) redirect("/");
  return <LoginForm setupAvailable={await setupAvailable()} />;
}
