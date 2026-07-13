import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ApiKeyCard } from "@/components/wallai/api-key-card";
import { AdminUsersTable } from "@/components/wallai/admin/admin-users-table";
import { AdminUsageSummary } from "@/components/wallai/admin/admin-usage-summary";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">Admin</h2>
        <p className="mt-0.5 text-xs text-white/70 sm:text-sm">
          Manage users, plans, the shared AI key, and app-wide usage.
        </p>
      </div>

      <div className="space-y-6">
        <AdminUsageSummary />

        <div className="lg:max-w-2xl">
          <ApiKeyCard />
        </div>

        <AdminUsersTable />
      </div>
    </div>
  );
}
