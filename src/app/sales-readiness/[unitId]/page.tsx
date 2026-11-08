import { MarkReadyForSale } from "@/components/workflows/sales";
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
      screen="SCR-08"
      Operation={MarkReadyForSale}
      query={await searchParams}
      unitId={unitId}
    />
  );
}
