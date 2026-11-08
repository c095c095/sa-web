import { redirect } from "next/navigation";
import { currentIdentity } from "@/server/auth";
import { LoginForm } from "@/components/login-form";
import { setupAvailable } from "@/server/management";
import { demoEnabled } from "@/server/demo";
export const metadata = { title: "เข้าสู่ระบบพนักงาน" };
export default async function Page() {
  if (await currentIdentity()) redirect("/");
  const [setup, demo] = await Promise.all([setupAvailable(), demoEnabled()]);
  return <LoginForm setupAvailable={setup} demo={demo} />;
}
