"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="page-container flex min-h-dvh w-full items-center justify-center">
      <section className="max-w-lg space-y-5 rounded-box bg-base-100 p-8">
        <h1 className="text-2xl">ยังเปิดข้อมูลไม่ได้</h1>
        <p>
          กรุณาตรวจว่า MySQL ใน XAMPP ยังเปิดอยู่ แล้วลองอีกครั้ง
          ข้อมูลที่ยังไม่ยืนยันบันทึกจะไม่ถูกส่งซ้ำอัตโนมัติ
        </p>
        <button className="btn btn-primary" onClick={retry}>
          ลองเปิดข้อมูลอีกครั้ง
        </button>
      </section>
    </main>
  );
}
