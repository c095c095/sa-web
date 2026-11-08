import { SignHandover } from "@/components/workflows/handover";
import { WorkflowDetail, type WorkflowQuery } from "@/server/workflow-pages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: WorkflowQuery;
}) {
  const { unitId } = await params;
  return (
    <WorkflowDetail
      screen="SCR-18"
      Operation={SignHandover}
      query={await searchParams}
      unitId={unitId}
    />
  );
}
