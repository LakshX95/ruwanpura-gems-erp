import "server-only";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { destroySession, getSession, type SessionUser } from "@/lib/session";

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await db.appUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  // Compare regardless of whether the user exists, so a missing account and a
  // wrong password take the same time and cannot be told apart.
  const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.isActive || !ok) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Use in every protected page and server action.
 *
 * The session is a signed JWT, so it keeps asserting whatever it was issued
 * with — including a user id that has since been deleted, or a role that has
 * since been downgraded. Trusting it blindly meant a deactivated account kept
 * working until the token expired, and a stale id produced a foreign-key crash
 * on the first write. So the user is re-read on each request.
 */
export async function requireUser(): Promise<SessionUser> {
  const claims = await getSession();
  if (!claims) redirect("/login");

  const user = await db.appUser.findUnique({
    where: { id: claims.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    // Cookies cannot be mutated during a render, so this may throw here; the
    // redirect is what matters, and signing in again overwrites the cookie.
    try {
      await destroySession();
    } catch {
      // ignore — not in a server action or route handler
    }
    redirect("/login");
  }

  // Returned from the database rather than the token, so a role change takes
  // effect on the next request instead of at token expiry.
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
