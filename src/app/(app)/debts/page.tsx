import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DebtList } from "@/components/wallai/debt-list";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return (
    <div>
      <DebtList />
    </div>
  );
}
