# ผลการตรวจ build ใน P1

Next.js 16.4.5 ที่สร้างจาก create-next-app ใส่ตัวโหลด `@tailwindcss/turbopack` มาใน next.config.ts ซึ่งเปิด dev server ได้ แต่ `next build` บนเครื่องนี้ล้มเหลวที่ globals.css โดยรายงานว่า child process จบก่อนเชื่อมต่อ ทั้งการรันปกติและแบบอนุญาตให้เปิด process เพิ่ม

เปลี่ยนเฉพาะการประมวลผล CSS เป็น **@tailwindcss/postcss 4.3.5** ผ่าน postcss.config.mjs ตามคู่มือ CSS ที่ติดตั้งมากับ Next.js นำกฎ custom loader และ dependency ที่ไม่ใช้ออก จากนั้น build ผ่านบน Next.js/Turbopack เดิม ไม่เปลี่ยน framework/theme/เนื้อหาหน้าจอ

หลักฐาน: evidence/build.log การทดสอบ browser และ Hallmark ต้องอิง build หลังแก้ตัวนี้ ผลนี้ชี้ว่าปัญหาอยู่ที่เส้นทาง integration ของตัวโหลดเดิมใน production build บนสภาพแวดล้อมนี้ ยังไม่ได้พิสูจน์ root cause ภายในของแพ็กเกจ จึงไม่อ้างว่าแก้แพ็กเกจต้นทางแล้ว

การติดตั้งเริ่มต้นยังมี advisory ระดับ moderate จาก minimatch ในเครื่องมือตรวจโค้ด จึง override เฉพาะ dependency ของ @typescript-eslint/typescript-estree เป็น minimatch 11.0.5 แล้วตรวจ lint/typecheck/build และ npm audit ใหม่ ไม่มีการ force downgrade Next.js ผลล่าสุดอยู่ใน evidence/dependency-audit.json
