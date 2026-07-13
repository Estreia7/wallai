import { auth } from "@/lib/auth";

/**
 * Returns the admin session, or null if the caller isn't an admin.
 * Use in API routes to gate admin-only endpoints.
 */
export async function getAdminSession() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") return null;
  return session;
}

/** True if the current request is from an admin. */
export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "admin";
}
