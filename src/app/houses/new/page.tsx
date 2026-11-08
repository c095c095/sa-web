import { RegisterHouse } from "@/components/workflows/houses";
import { WorkflowDetail, type WorkflowQuery } from "@/server/workflow-pages";

export default async function Page({
  searchParams,
}: {
  searchParams: WorkflowQuery;
}) {
  return (
    <WorkflowDetail
      screen="SCR-01"
      Operation={RegisterHouse}
      query={await searchParams}
    />
  );
}
