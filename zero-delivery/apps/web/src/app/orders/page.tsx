import { AppHeader } from "@/components/AppHeader";
import { SupportOrders } from "@/components/support/SupportOrders";

export const metadata = { title: "Pedidos · Zero Delivery" };

export default function OrdersPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Pedidos Activos" />
      <main className="mx-auto max-w-[1200px] px-4 py-4">
        <SupportOrders />
      </main>
    </div>
  );
}
