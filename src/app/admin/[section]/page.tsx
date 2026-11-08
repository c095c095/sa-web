import { notFound } from "next/navigation";
import { managementSections } from "@/lib/management-contracts";
import AdminPage from "@/server/admin-page";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/admin/[section]">) {
  const { section } = await params;
  if (section === "overview" || !Object.hasOwn(managementSections, section))
    notFound();
  return <AdminPage section={section} searchParams={searchParams} />;
}
