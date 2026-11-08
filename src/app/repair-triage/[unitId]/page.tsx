import { TriageRepair } from "@/components/workflows/repairs";
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
      screen="SCR-15"
      Operation={TriageRepair}
      query={await searchParams}
      unitId={unitId}
    />
  );
}
