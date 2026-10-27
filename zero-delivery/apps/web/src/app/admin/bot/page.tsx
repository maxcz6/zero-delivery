import { AppHeader } from "@/components/AppHeader";
import { VoceroBotControlCenter } from "@/components/bot/VoceroBotControlCenter";

export const metadata = { title: "Bot & Vocero CRM · Admin · Zero Delivery" };

export default function AdminBotPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Bot & Conector Vocero CRM (Hito 4)" />
      <main>
        <VoceroBotControlCenter />
      </main>
    </div>
  );
}
