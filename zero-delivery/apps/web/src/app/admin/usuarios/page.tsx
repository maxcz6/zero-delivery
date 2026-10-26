import { AppHeader } from "@/components/AppHeader";
import { UsersBoard } from "@/components/admin/UsersBoard";

export const metadata = { title: "Usuarios · Zero Delivery" };

export default function AdminUsersPage() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader title="Usuarios y Roles" />
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <UsersBoard />
      </main>
    </div>
  );
}
