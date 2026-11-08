# ปรับตามการตรวจรูปแบบ 8 พฤศจิกายน 2569

- ช่องค้นหาเดิมเกิด outline สองชุด: generic focus-visible บน input ด้านใน และ focus-within ของ daisyUI บนกลุ่ม ย้ายสีและกรอบที่เห็นไปกรอบกลุ่ม ส่วน input ด้านในกำหนด outline 0 โดยยังมี focus indication ที่ครอบทั้งไอคอนและช่องพิมพ์
- ตรวจแยก `outline: none` ซึ่งเบราว์เซอร์ยังคำนวณความกว้าง 3px แม้ไม่วาดเส้น กับ `outline: 0` ซึ่งคำนวณเป็น 0px; ใช้แบบหลังเพื่อให้แน่นอนทั้ง pointer/keyboard
- ผู้แจ้งเปลี่ยนจาก select เป็นสองปุ่มที่ใช้ native radio เลือกได้ทีละตัว รองรับ Tab/ลูกศร และส่งค่า reported_by_type เดิม
- input/select/textarea/file-input ใช้ token พื้นขาวแยกจาก base surface ของธีม ไม่เปลี่ยนสี canvas ทั้งระบบ
- ปรับตามข้อเสนอสีรอบถัดมา: ปุ่มหลักเป็นพื้นเข้มกับตัวอักษรขาว; checkbox ที่เลือกเป็นพื้นเข้ม/เครื่องหมายขาว และกรอบที่ยังไม่เลือกเข้มขึ้น; ปุ่ม disabled ใช้สีเทาที่อ่านข้อความได้ ผลวัดสีปลายทาง contrast ปุ่ม/checkbox 14.61:1 และปุ่ม disabled 5.42:1 พร้อม axe 0 violations ใน 3 หน้า × 2 ขนาดที่ตรวจ เก็บผลใน evidence/control-colors.json

ผลตรวจล่าสุดอยู่ใน evidence/pilot-browser.json, evidence/hallmark-render.json และ screenshots/ ไม่มีการเปลี่ยน schema, query, สิทธิ์ หรือเปิดการบันทึกจริงนอกขอบเขต P1
