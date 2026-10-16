import { requireUser } from "@/lib/auth";
import { listShares, shareDoc, unshareDoc } from "@/lib/docs";
import { handle, readJson } from "@/lib/http";

type Ctx = RouteContext<"/api/documents/[id]/shares">;

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  return Response.json(await listShares((await ctx.params).id, user.id));
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { email, role } = await readJson(req);
  return Response.json(await shareDoc((await ctx.params).id, user.id, email, role));
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { userId } = await readJson(req);
  return Response.json(await unshareDoc((await ctx.params).id, user.id, userId));
});
