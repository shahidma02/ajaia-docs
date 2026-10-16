import { requireUser } from "@/lib/auth";
import { createDoc, listDocs } from "@/lib/docs";
import { handle, readJson } from "@/lib/http";

export const GET = handle(async () => {
  const user = await requireUser();
  return Response.json(await listDocs(user.id));
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { title } = await readJson(req);
  return Response.json(await createDoc(user.id, title ?? "Untitled document"), { status: 201 });
});
