import { RepairIndex, type WorkflowQuery } from "@/server/workflow-pages";

export default async function Page({
  searchParams,
}: {
  searchParams: WorkflowQuery;
}) {
  return <RepairIndex screen="SCR-03" query={await searchParams} />;
}
