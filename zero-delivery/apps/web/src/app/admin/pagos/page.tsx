import { AppHeader } from "@/components/AppHeader";
import { PaymentsBoard } from "@/components/staff/PaymentsBoard";

export const metadata = { title: "Pagos · Zero Delivery" };

export default function AdminPaymentsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Pagos y Liquidaciones" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <PaymentsBoard compact />
      </main>
    </div>
  );
}
