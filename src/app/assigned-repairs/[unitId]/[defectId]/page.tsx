import { CompleteRepair } from "@/components/workflows/repairs";
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
      screen="SCR-04"
      Operation={CompleteRepair}
      query={await searchParams}
      unitId={unitId}
      defectId={defectId}
    />
  );
}
