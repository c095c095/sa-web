import type {Metadata} from "next";
import {PilotShell} from "@/components/pilot-shell";
import {QueuePilot} from "@/components/queue-pilot";
import {getQueue} from "@/lib/pilot-data";
export const metadata:Metadata={title:"งานที่รอช่างรับ"};
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const p=await searchParams;let state=typeof p.state==="string"?p.state:"full";let items:Awaited<ReturnType<typeof getQueue>>=[];
  try{items=await getQueue();}catch{state="error";}
  return <PilotShell active="technician"><QueuePilot items={items} initialCategory={typeof p.category==="string"?p.category:""} initialSearch={typeof p.q==="string"?p.q:""} state={state}/></PilotShell>;
}
