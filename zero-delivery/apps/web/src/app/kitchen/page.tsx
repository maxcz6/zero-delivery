import { AppHeader } from "@/components/AppHeader";
import { KitchenBoard } from "@/components/kitchen/KitchenBoard";

export const metadata = { title: "Cocina · Zero Delivery" };

export default function KitchenPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Cocina y Empaque" />
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <KitchenBoard />
      </main>
    </div>
  );
}
