import Link from "next/link";
import { House, Wrench, ClipboardList, ListChecks, Info } from "lucide-react";
const nav=[{key:"technician",href:"/pilot/technician",label:"คิวงานช่าง",icon:Wrench},{key:"report",href:"/pilot/report",label:"แจ้งจุดที่ต้องแก้",icon:ClipboardList},{key:"status",href:"/pilot/status",label:"ติดตามการซ่อม",icon:ListChecks}];
export function PilotShell({active,children}:{active:string;children:React.ReactNode}){
  return <>
    <a className="skip-link" href="#main-content">ข้ามไปเนื้อหา</a>
    <header className="bg-base-100"><div className="page-container">
      <div className="navbar min-h-20 gap-4 px-0"><Link href="/" aria-label="หน้าแรก ระบบตรวจและส่งมอบบ้าน" className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-field bg-neutral text-neutral-content"><House size={22} strokeWidth={1.5} aria-hidden="true"/></span><span className="text-base font-semibold sm:text-lg">ระบบตรวจและส่งมอบบ้าน</span></Link><span className="ml-auto hidden text-sm text-muted sm:block">สำหรับตรวจรับรูปแบบ</span></div>
      <nav aria-label="หน้าทดลอง" className="hidden gap-8 border-t border-base-300 sm:flex">{nav.map(({key,href,label,icon:Icon})=><Link key={key} href={href} className="nav-link" aria-current={active===key?"page":undefined}><Icon size={18} aria-hidden="true"/>{label}</Link>)}</nav>
      <nav aria-label="หน้าทดลองบนมือถือ" className="flex border-t border-base-300 overflow-x-auto sm:hidden">
        {nav.map(({ key, href, label, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={`flex flex-1 min-w-[6.5rem] flex-col items-center justify-center gap-1 py-2.5 text-xs ${
              active === key
                ? "border-b-2 border-base-content font-semibold text-base-content"
                : "text-muted hover:text-base-content"
            }`}
            aria-current={active === key ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div></header>
    <div className="border-y border-base-300 bg-base-100"><div className="page-container flex items-start gap-2 py-3 text-sm text-muted"><Info size={17} className="mt-0.5 shrink-0" aria-hidden="true"/><p>หน้าทดลองด้วยข้อมูลสมมติ ใช้ตรวจรูปแบบและวิธีใช้งาน ยังไม่บันทึกหรือส่งงานจริง</p></div></div>
    <main id="main-content" className="page-container w-full flex-1 py-8 sm:py-10">{children}</main>
    <footer className="page-container w-full border-t border-base-300 py-5 text-sm text-muted"><p>กรณีศึกษา โครงการ ANNA Townhome ราชพฤกษ์-แจ้งวัฒนะ</p><p>ข้อมูลบ้านและรายการงานในหน้าทดลองเป็นข้อมูลสมมติสำหรับโครงงาน</p></footer>
  </>;
}
