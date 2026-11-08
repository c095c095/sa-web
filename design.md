# ระบบออกแบบที่รับสำหรับ P1

ผู้ใช้อนุมัติ 8 พฤศจิกายน 2569: Hallmark Furrow แบบ app screen พื้นสว่างและสีเฉพาะ action/status ตาม website-plan/approval-g0.json

- Thai-first: IBM Plex Sans Thai 400/500/600 จากแพ็กเกจ local ไม่ดาวน์โหลด font ระหว่าง build
- daisyUI custom theme `sa-furrow` เป็นแหล่งค่าสีเดียว: warm white/manila base, near-black ink, restrained semantic states; ตามการตรวจรับล่าสุดใช้ปุ่มหลักและ checkbox ที่เลือกเป็นสีเข้มกับตัวอักษร/เครื่องหมายสีขาว
- ใช้ Tailwind CSS 4 จัด layout และ daisyUI 5 สำหรับ controls; ไม่เพิ่ม component library คู่ขนาน
- เนื้อหา 16px ขึ้นไป labels ลดได้ตามบริบท; หัวข้อภาษาไทย line-height 1.5 ไม่ใช้ display typography ภาษาอังกฤษ
- หน้าทำงานเริ่มจาก ruled list/table พร้อม detail pane ไม่เพิ่ม hero, marketing page, สถิติที่ไม่วัด, stock evidence, แผนที่ตกแต่ง หรือการ์ดซ้อนการ์ด
- Container สูงสุด 80rem; desktop จัดข้อมูลสองคอลัมน์เมื่อพื้นที่พอ; มือถือเรียงรายการและเปลี่ยนเมนูเป็น disclosure
- Focus ทันที, touch target อย่างน้อย 44px, coarse pointer 48px, reduced motion; รายการมี loading/empty/error/full
- ช่องกรอกใช้พื้นขาวแยกจากพื้นกระดาษ; ช่องที่มีไอคอนและ input ร่วมกันใช้ focus ring ที่กรอบกลุ่มชั้นเดียว; ผู้แจ้งสองตัวเลือกใช้ native radio ที่แสดงเป็นปุ่ม
- ป้ายสถานะเป็นไทย (CODE) ตาม CONTRACT v0.3.3; สีไม่ใช่ตัวบอกความหมายเพียงอย่างเดียว
- P1 เป็น read-only review surface จาก fixture สมมติ หน้าทดลองทบทวนได้แต่ไม่แสดงว่าได้บันทึกจริง
- G1 รับก่อนนำระบบออกแบบและ technical amendments ไปขยาย P2–P5
