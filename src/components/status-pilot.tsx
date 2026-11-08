"use client";
import {useState} from "react";
import Link from "next/link";
import {Plus,Check,ClipboardList} from "lucide-react";
import {categories,defectStatuses,type RepairItem} from "@/lib/domain";
export function StatusPilot({items,failed=false}:{items:RepairItem[];failed?:boolean}){
  const [selected,setSelected]=useState<string[]>([]),[review,setReview]=useState(false);
  const fixed=items.filter(x=>x.status==='FIXED').length;
  function toggle(id:string){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);setReview(false);}
  function badge(x:RepairItem){return <span className={`badge ${x.status==='VERIFIED'?'badge-success':x.status==='REWORK'?'badge-error':x.status==='FIXED'?'badge-info':'badge-ghost'}`}>{defectStatuses[x.status]} ({x.status})</span>;}
  return <>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h1 className="page-heading">ติดตามการซ่อมบ้าน</h1><p className="mt-2 text-muted">บ้านเลขที่ 19/7 ชลธาร ทาวน์โฮม <span className="ml-1 text-sm">(ข้อมูลสมมติ)</span></p></div><Link href="/pilot/report" className="btn"><Plus size={18} aria-hidden="true"/>แจ้งจุดเพิ่มเติม</Link></div>
    {failed?<div role="alert" className="alert alert-error">โหลดรายการซ่อมไม่ได้ กรุณาลองเปิดหน้านี้ใหม่</div>:<div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="min-w-0" aria-label="รายการซ่อม"><div className="flex items-center justify-between border-b border-base-content pb-4"><h2 className="text-xl">จุดที่แจ้งทั้งหมด</h2><p className="text-sm text-muted">{items.length} รายการ</p></div><p className="my-4 text-sm text-muted">เลือกได้เฉพาะรายการซ่อมเสร็จ (FIXED) ที่ต้องการแจ้งว่าไม่ผ่าน</p>
        <div className="hidden md:block"><table className="table"><caption className="sr-only">รายงานติดตามสถานะการซ่อม RPT-02 ข้อมูลสมมติ</caption><thead><tr><th scope="col">ไม่ผ่าน</th><th scope="col">ตำแหน่งและประเภท</th><th scope="col">สถานะ</th></tr></thead><tbody>{items.map(x=><tr key={x.defect_id}><td><label className="flex min-h-11 min-w-11 items-center"><input type="checkbox" className="checkbox checkbox-sm" disabled={x.status!=='FIXED'} checked={selected.includes(x.defect_id)} aria-label={`เลือกจุดที่ไม่ผ่าน ${x.defect_id}`} onChange={()=>toggle(x.defect_id)}/></label></td><td><p>{x.location_pin}</p><p className="mt-1 text-sm text-muted">{x.category?`${categories[x.category]} (${x.category})`:"ยังไม่แยกประเภท"}</p><p className="mt-1 text-sm tabular-nums text-muted">{x.defect_id}</p></td><td>{badge(x)}</td></tr>)}</tbody></table></div>
        <ul className="list md:hidden">{items.map(x=><li className="border-b border-base-300 py-5" key={x.defect_id}><div className="flex gap-3"><label className="flex min-h-11 min-w-11 items-start justify-center pt-1"><input type="checkbox" className="checkbox" disabled={x.status!=='FIXED'} aria-label={`เลือกจุดที่ไม่ผ่าน ${x.defect_id}`} checked={selected.includes(x.defect_id)} onChange={()=>toggle(x.defect_id)}/></label><div className="min-w-0"><p>{x.location_pin}</p><p className="mb-2 text-sm text-muted">{x.category?`${categories[x.category]} (${x.category})`:"ยังไม่แยกประเภท"}</p>{badge(x)}</div></div></li>)}</ul>
        {!items.length&&<p className="py-10 text-muted">ยังไม่มีจุดที่ต้องแก้ในรอบนี้ แจ้งจุดเพิ่มเติมได้จากปุ่มด้านบน</p>}
      </section>
      <aside className="rounded-box bg-base-100 p-6"><h2 className="flex items-center gap-2 text-xl"><ClipboardList size={21} aria-hidden="true"/>ตรวจผลก่อนยอมรับ</h2><p className="mt-4 text-muted">มีรายการซ่อมเสร็จที่ตรวจผลได้ {fixed} รายการ</p><div className="my-5 border-y border-base-300 py-4"><p>เลือกจุดที่ไม่ผ่าน <span className="font-semibold tabular-nums">{selected.length}</span> รายการ</p><p className="mt-2 text-sm text-muted">รายการที่ยังซ่อมไม่เสร็จเลือกไม่ได้ และยังยืนยันยอมรับสภาพไม่ได้</p></div><button type="button" className="btn btn-primary w-full" onClick={()=>setReview(true)}><Check size={18} aria-hidden="true"/>ทบทวนผลการตรวจ</button>{review&&<p role="status" className="mt-5 text-muted">เลือกไว้ {selected.length} จุด ยังไม่ได้บันทึกผลยอมรับหรือไม่ผ่าน การดำเนินการจริงจะเปิดหลังตรวจรับ</p>}<p className="mt-5 text-sm text-muted">หน้านี้ใช้ตรวจการแสดงสถานะและวิธีเลือกจุด การยืนยันสภาพและเซ็นรับมอบยังไม่เปิดใช้งาน</p></aside>
    </div>}
  </>;
}
