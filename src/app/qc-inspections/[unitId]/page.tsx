import { RecordQc } from "@/components/workflows/qc";
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
      screen="SCR-02"
      Operation={RecordQc}
      query={await searchParams}
      unitId={unitId}
    />
  );
}
