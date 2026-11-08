import type {Metadata} from "next";
import {PilotShell} from "@/components/pilot-shell";
import {StatusPilot} from "@/components/status-pilot";
import {getRepairItems} from "@/lib/pilot-data";
export const metadata:Metadata={title:"ติดตามการซ่อมบ้าน"};
export const dynamic="force-dynamic";
export default async function Page(){let items:Awaited<ReturnType<typeof getRepairItems>>=[];let failed=false;try{items=await getRepairItems();}catch{failed=true;}return <PilotShell active="status"><StatusPilot items={items} failed={failed}/></PilotShell>;}
