import { cookies } from "next/headers";
import { currentUser, SESSION_COOKIE } from "@/lib/auth";
import { getUser, listUsers } from "@/lib/docs";
import { handle, HttpError, readJson } from "@/lib/http";

// Who am I + the seeded users to pick from.
export const GET = handle(async () => {
  return Response.json({ user: await currentUser(), users: await listUsers() });
});

// "Sign in" as a seeded user.
export const POST = handle(async (req: Request) => {
  const { userId } = await readJson(req);
  const user = typeof userId === "string" ? await getUser(userId) : null;
  if (!user) throw new HttpError(400, "Unknown user.");
  (await cookies()).set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ user });
});

export const DELETE = handle(async () => {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
});
