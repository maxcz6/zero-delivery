import { AppHeader } from "@/components/AppHeader";
import { WalletsBoard } from "@/components/staff/WalletsBoard";

export const metadata = { title: "Billeteras · Zero Delivery" };

export default function CoordinatorWalletsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Billeteras de Repartidores" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <WalletsBoard />
      </main>
    </div>
  );
}
