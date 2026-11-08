import type {Metadata} from "next";
import {PilotShell} from "@/components/pilot-shell";
import {ReportPilot} from "@/components/report-pilot";
export const metadata:Metadata={title:"แจ้งจุดที่ต้องแก้ในบ้าน"};
export default function Page(){return <PilotShell active="report"><ReportPilot/></PilotShell>;}
