import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PropertyList } from "@/components/wallai/property-list";

export const dynamic = "force-dynamic";

export default async function PropertyPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  return (
    <div>
      <PropertyList />
    </div>
  );
}
