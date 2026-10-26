import { AppHeader } from "@/components/AppHeader";
import { KanbanBoard } from "@/components/coordinator/KanbanBoard";

export const metadata = { title: "Kanban · Zero Delivery" };

export default function CoordinatorPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Tablero del Coordinador" />
      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <KanbanBoard />
      </main>
    </div>
  );
}
