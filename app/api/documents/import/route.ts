import { requireUser } from "@/lib/auth";
import { createDoc } from "@/lib/docs";
import { handle, HttpError } from "@/lib/http";
import { fileToDoc } from "@/lib/importer";

// Upload a .txt / .md / .docx file and turn it into a new editable document owned by the caller.
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a file in the 'file' field.");
  const { title, html } = await fileToDoc(file.name, Buffer.from(await file.arrayBuffer()));
  return Response.json(await createDoc(user.id, title.slice(0, 200), html), { status: 201 });
});
