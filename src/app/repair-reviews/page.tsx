import {
  HouseWorkflowIndex,
  type WorkflowQuery,
} from "@/server/workflow-pages";

export default async function Page({
  searchParams,
}: {
  searchParams: WorkflowQuery;
}) {
  return <HouseWorkflowIndex screen="SCR-05" query={await searchParams} />;
}
