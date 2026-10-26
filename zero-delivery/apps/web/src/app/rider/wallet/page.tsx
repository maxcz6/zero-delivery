import { AppHeader } from "@/components/AppHeader";
import { WalletView } from "@/components/rider/WalletView";

export const metadata = { title: "Mi Billetera · Zero Delivery" };

export default function RiderWalletPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Mi Billetera" />
      <main className="mx-auto max-w-lg px-4 py-4">
        <WalletView />
      </main>
    </div>
  );
}
