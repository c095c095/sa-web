import { LoginForm } from "@/components/login-form";
export const metadata = { title: "เข้าดูบ้านของคุณ", referrer: "no-referrer" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  return (
    <LoginForm
      access
      initialToken={typeof p.token === "string" ? p.token : ""}
    />
  );
}
