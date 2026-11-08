import { ReviewHandoverRepairs } from "@/components/workflows/reports";
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
      screen="SCR-17"
      Operation={ReviewHandoverRepairs}
      query={await searchParams}
      unitId={unitId}
    />
  );
}
