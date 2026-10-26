import { AppHeader } from "@/components/AppHeader";
import { NewOrderForm } from "@/components/support/NewOrderForm";

export const metadata = { title: "Nuevo pedido · Zero Delivery" };

export default function NewOrderPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Nuevo Pedido Manual" />
      <main className="mx-auto max-w-[1200px] px-4 py-4">
        <NewOrderForm />
      </main>
    </div>
  );
}
