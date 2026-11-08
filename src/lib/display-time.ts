export const string = (value: unknown) => String(value ?? "");

export function thaiTime(value: unknown) {
  if (!value) return "ยังไม่ระบุ";
  const raw = string(value);
  const iso = raw.replace(" ", "T");
  const date =
    value instanceof Date
      ? value
      : new Date(
          iso.length === 10 || /(?:Z|[+-]\d\d:\d\d)$/.test(iso)
            ? iso
            : iso + "Z",
        );
  if (Number.isNaN(date.getTime())) return "ยังไม่ระบุ";
  return iso.length === 10
    ? date.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })
    : date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}
