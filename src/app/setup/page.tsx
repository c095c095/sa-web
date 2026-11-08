import { redirect } from "next/navigation";
import { setupAvailable } from "@/server/management";
import { SetupForm } from "@/components/setup-form";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "ตั้งแอดมินครั้งแรก",
  referrer: "no-referrer",
};
export default async function SetupPage() {
  if (!(await setupAvailable())) redirect("/login");
  return <SetupForm />;
}
