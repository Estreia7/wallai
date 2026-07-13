import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileCard } from "@/components/wallai/settings/profile-card";
import { CurrencyCard } from "@/components/wallai/settings/currency-card";
import { ApiKeyCard } from "@/components/wallai/api-key-card";
import { UsageCard } from "@/components/wallai/settings/usage-card";
import { CategoriesCard } from "@/components/wallai/settings/categories-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, primaryCurrency: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <h2 className="mb-6 section-title">Settings</h2>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:max-w-2xl">
          <ProfileCard initialName={user.name || ""} email={user.email} />
          <CurrencyCard initialCurrency={user.primaryCurrency} />
          <ApiKeyCard />
        </div>
        <CategoriesCard />
        <div>
          <UsageCard />
        </div>
      </div>
    </div>
  );
}
