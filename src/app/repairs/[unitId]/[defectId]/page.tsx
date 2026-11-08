import { ClaimRepair } from "@/components/workflows/repairs";
import { WorkflowDetail, type WorkflowQuery } from "@/server/workflow-pages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string; defectId: string }>;
  searchParams: WorkflowQuery;
}) {
  const { unitId, defectId } = await params;
  return (
    <WorkflowDetail
      screen="SCR-03"
      Operation={ClaimRepair}
      query={await searchParams}
      unitId={unitId}
      defectId={defectId}
    />
  );
}
