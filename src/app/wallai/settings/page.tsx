import { ApiKeyCard } from "@/components/wallai/api-key-card";

export default function SettingsPage() {
  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Settings</h2>
      <div className="grid grid-cols-1 gap-4 lg:max-w-2xl">
        <ApiKeyCard />
      </div>
    </div>
  );
}
