import { AppHeader } from "@/components/AppHeader";
import { AdminOverview } from "@/components/admin/AdminOverview";

export const metadata = { title: "Panel · Zero Delivery" };

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Panel de Administración" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <AdminOverview />
      </main>
    </div>
  );
}
