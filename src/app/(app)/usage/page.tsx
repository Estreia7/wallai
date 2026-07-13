import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UsageClient } from "@/components/wallai/usage/usage-client";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // AI usage is admin-only now (AI is centrally funded via the shared key).
  if (session.user.role !== "admin") redirect("/dashboard");
  return <UsageClient />;
}
