import { HouseOverview } from "@/server/workflow-pages";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/houses/[unitId]">) {
  return (
    <HouseOverview
      unitId={(await params).unitId}
      fromRegister={(await searchParams).from === "register"}
    />
  );
}
