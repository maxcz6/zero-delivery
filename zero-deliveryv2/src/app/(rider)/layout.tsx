import { ES_PE } from "@/shared/i18n/es-PE";

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-900 text-white">
      <header className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-tight">{ES_PE.app.name} · Rider</span>
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            PWA Móvil
          </span>
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
