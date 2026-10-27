import { AppHeader } from "@/components/AppHeader";
import { CatalogManager } from "@/components/admin/CatalogManager";

export const metadata = { title: "Mi Sucursal y Carta · Zero Delivery" };

export default function KitchenCatalogPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Administración de Sucursal y Carta" />
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <CatalogManager title="Administración de Mi Sucursal, Carta y Precios" />
      </main>
    </div>
  );
}
