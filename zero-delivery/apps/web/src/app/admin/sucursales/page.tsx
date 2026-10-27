import { AppHeader } from "@/components/AppHeader";
import { BranchesManager } from "@/components/admin/BranchesManager";

export const metadata = { title: "Sucursales · Zero Delivery" };

export default function AdminBranchesPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Sucursales" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <BranchesManager />
      </main>
    </div>
  );
}
