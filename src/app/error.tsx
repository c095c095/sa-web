"use client";

import Link from "next/link";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-6">
      <h1 className="page-heading">เปิดข้อมูลหน้านี้ไม่ได้</h1>
      <p className="alert alert-error" role="alert">
        กรุณาลองโหลดข้อมูลอีกครั้ง
      </p>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" type="button" onClick={retry}>
          ลองอีกครั้ง
        </button>
        <Link className="btn" href="/">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}
