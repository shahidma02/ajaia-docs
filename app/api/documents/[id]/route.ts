import { requireUser } from "@/lib/auth";
import { deleteDoc, getDoc, updateDoc } from "@/lib/docs";
import { handle, readJson } from "@/lib/http";

type Ctx = RouteContext<"/api/documents/[id]">;

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  return Response.json(await getDoc((await ctx.params).id, user.id));
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { title, content, version } = await readJson(req);
  return Response.json(await updateDoc((await ctx.params).id, user.id, { title, content, version }));
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  await deleteDoc((await ctx.params).id, user.id);
  return Response.json({ ok: true });
});
