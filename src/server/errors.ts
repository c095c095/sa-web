import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export function requireThat(
  value: unknown,
  message: string,
  status = 409,
): asserts value {
  if (!value)
    throw new AppError(
      status,
      status === 404
        ? "NOT_FOUND"
        : status === 403
          ? "FORBIDDEN"
          : "STATE_CONFLICT",
      message,
    );
}
export function errorResponse(error: unknown) {
  const requestId = randomUUID();
  if (error instanceof AppError)
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
          requestId,
        },
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues)
      fields[issue.path.join(".")] = issue.message;
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "กรุณาตรวจข้อมูลที่กรอก",
          fields,
          requestId,
        },
      },
      { status: 422 },
    );
  }
  const errno =
    typeof error === "object" && error && "errno" in error
      ? Number(error.errno)
      : 0;
  if ([1062, 1213, 1205].includes(errno))
    return Response.json(
      {
        error: {
          code: "CONFLICT",
          message: "ข้อมูลถูกใช้หรือเปลี่ยนไปแล้ว กรุณาโหลดรายการใหม่",
          requestId,
        },
      },
      { status: 409 },
    );
  if ([1451, 1452, 4025, 1265, 3819].includes(errno))
    return Response.json(
      {
        error: {
          code: "INVALID_STATE",
          message: "ข้อมูลไม่ตรงเงื่อนไข กรุณาตรวจสถานะและข้อมูลที่กรอก",
          requestId,
        },
      },
      { status: 422 },
    );
  console.error("Request failed", {
    requestId,
    errno,
    code:
      typeof error === "object" && error && "code" in error ? error.code : null,
    syscall:
      typeof error === "object" && error && "syscall" in error
        ? error.syscall
        : null,
  });
  return Response.json(
    {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message:
          "ยังดำเนินการไม่ได้ กรุณาลองใหม่ หากยังเกิดปัญหาให้แจ้งรหัสอ้างอิง",
        requestId,
      },
    },
    { status: 503 },
  );
}
