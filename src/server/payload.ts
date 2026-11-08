import { AppError, requireThat } from "./errors";
export interface Payload {
  data: Record<string, unknown>;
  files: File[];
}
export async function payload(req: Request): Promise<Payload> {
  const max = 25 * 1024 * 1024;
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new AppError(413, "TOO_LARGE", "ข้อมูลรวมต้องไม่เกิน 25 MB");
      }
      chunks.push(value);
    }
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.length) return { data: {}, files: [] };
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.startsWith("multipart/form-data")) {
      const form = await new Response(bytes, {
        headers: { "content-type": type },
      }).formData();
      const d = JSON.parse(String(form.get("data") ?? "{}"));
      requireThat(
        d && typeof d === "object" && !Array.isArray(d),
        "รูปแบบข้อมูลไม่ถูกต้อง",
        422,
      );
      const files = [...form.values()].filter(
        (v): v is File => v instanceof File && v.size > 0,
      );
      return { data: d, files };
    }
    const d = JSON.parse(bytes.toString("utf8"));
    requireThat(
      d && typeof d === "object" && !Array.isArray(d),
      "รูปแบบข้อมูลไม่ถูกต้อง",
      422,
    );
    return { data: d, files: [] };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      422,
      "INVALID_BODY",
      "อ่านข้อมูลที่ส่งมาไม่ได้ กรุณาลองใหม่",
    );
  }
}
