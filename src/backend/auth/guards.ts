import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "./session";

export async function requireUser(next = "/account") {
  const user = await getCurrentUser();
  if (!user) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Admin pages: non-admins get a 404 so the admin area is not even advertised. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login?next=/admin");
  if (user.role !== "ADMIN") notFound();
  return user;
}
