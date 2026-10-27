import { AppHeader } from "@/components/AppHeader";
import { VoceroBotControlCenter } from "@/components/bot/VoceroBotControlCenter";

export const metadata = { title: "Bot & Vocero CRM · Zero Delivery" };

export default function BotControlCenterPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Bot & Conector Vocero CRM (Hito 4)" />
      <main>
        <VoceroBotControlCenter />
      </main>
    </div>
  );
}
