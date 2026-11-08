import { RegisterIndex, type WorkflowQuery } from "@/server/workflow-pages";

export default async function Page({
  searchParams,
}: {
  searchParams: WorkflowQuery;
}) {
  return <RegisterIndex screen="SCR-01" query={await searchParams} />;
}
