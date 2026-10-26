import { AppHeader } from "@/components/AppHeader";
import { RidersBoard } from "@/components/staff/RidersBoard";

export const metadata = { title: "Repartidores · Zero Delivery" };

export default function CoordinatorRidersPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Repartidores" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <RidersBoard />
      </main>
    </div>
  );
}
