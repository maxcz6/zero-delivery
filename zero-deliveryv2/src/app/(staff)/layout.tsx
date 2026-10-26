import Link from "next/link";
import { ES_PE } from "@/shared/i18n/es-PE";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-lg font-bold text-slate-900">
              {ES_PE.app.name}
            </Link>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              Panel Staff / Sucursal
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-slate-900">
              Dashboard & Kanban
            </Link>
            <Link href="/" className="hover:text-slate-900">
              Inicio
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
