import { randomUUID } from "node:crypto";
import {
  currentIdentity,
  needIdentity,
  publicIdentity,
  enforceOrigin,
  login,
  exchangeLink,
  logout,
} from "@/server/auth";
import { errorResponse, AppError } from "@/server/errors";
import { payload } from "@/server/payload";
import { workspace } from "@/server/workspace";
import { executeUc } from "@/server/workflows";
import { privateFile } from "@/server/media";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const ok = (data: unknown, cookie?: string) => {
  const res = Response.json(
    { data },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
  if (cookie) res.headers.set("Set-Cookie", cookie);
  return res;
};
export async function GET(req: Request, ctx: Context) {
  try {
    const { path } = await ctx.params;
    if (path.join("/") === "auth/session") {
      const id = await currentIdentity(req);
      return ok({ identity: id ? publicIdentity(id) : null });
    }
    const id = await needIdentity(req);
    if (path[0] === "files" && path.length === 2)
      return await privateFile(id, path[1]);
    if (path.join("/") === "workspace")
      return ok({
        identity: publicIdentity(id),
        ...(await workspace(
          id,
          new URL(req.url).searchParams.get("unit") ?? undefined,
        )),
      });
    throw new AppError(404, "NOT_FOUND", "ไม่พบข้อมูลที่ต้องการ");
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    enforceOrigin(req);
    const { path } = await ctx.params;
    const key = path.join("/");
    if (key === "auth/logout")
      return ok({ message: "ออกจากระบบแล้ว" }, await logout(req));
    const input = await payload(req);
    if (key === "auth/login") {
      const r = await login(input.data, req);
      return ok({ identity: r.identity }, r.cookie);
    }
    if (key === "auth/access") {
      const r = await exchangeLink(input.data, req);
      return ok({ identity: r.identity }, r.cookie);
    }
    const id = await needIdentity(req);
    if (path[0] === "actions" && path.length === 2)
      return ok({
        requestId: randomUUID(),
        ...(await executeUc(path[1], input.data, input.files, id)),
      });
    throw new AppError(404, "NOT_FOUND", "ไม่พบการทำงานที่ต้องการ");
  } catch (e) {
    return errorResponse(e);
  }
}
