import { cookies } from "next/headers";
import { getUser, type User } from "./docs";
import { HttpError } from "./http";

// ponytail: mock auth — a cookie holding a seeded user id, no passwords. Swap for real auth
// (e.g. Auth.js / Clerk) before this leaves a demo; every route already goes through requireUser().
export const SESSION_COOKIE = "ajaia_uid";

export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? getUser(id) : null;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}
