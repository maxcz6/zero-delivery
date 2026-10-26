import { AppHeader } from "@/components/AppHeader";
import { RiderDashboard } from "@/components/rider/RiderDashboard";

export const metadata = { title: "Mis Entregas · Zero Delivery" };

export default function RiderPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Mis Entregas" />
      <main className="mx-auto max-w-lg px-4 py-4">
        <RiderDashboard />
      </main>
    </div>
  );
}
