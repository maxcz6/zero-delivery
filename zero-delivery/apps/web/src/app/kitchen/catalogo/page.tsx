import { AppHeader } from "@/components/AppHeader";
import { CatalogManager } from "@/components/admin/CatalogManager";

export const metadata = { title: "Catálogo · Zero Delivery" };

export default function KitchenCatalogPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Disponibilidad de Productos" />
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <CatalogManager title="Catálogo de la sucursal" />
      </main>
    </div>
  );
}
