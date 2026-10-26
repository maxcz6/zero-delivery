import { AppHeader } from "@/components/AppHeader";
import { CatalogManager } from "@/components/admin/CatalogManager";

export const metadata = { title: "Catálogo · Zero Delivery" };

export default function AdminCatalogPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Catálogo y Sucursales" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <CatalogManager />
      </main>
    </div>
  );
}
