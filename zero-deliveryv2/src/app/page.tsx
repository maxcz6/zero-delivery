import Link from "next/link";
import { ShieldCheck, Bike, LayoutDashboard, ArrowRight, Radio } from "lucide-react";
import { ES_PE } from "@/shared/i18n/es-PE";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            MVP 1.0 · {ES_PE.app.timezone} · Moneda {ES_PE.app.currencySymbol}
          </span>
          <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
            Vocero CRM Contract Ready
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          {ES_PE.app.name}
        </h1>
        <p className="mt-2 max-w-[68ch] text-slate-600">{ES_PE.app.tagline}</p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <Link
            href="/login"
            className="group flex min-h-[48px] cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 transition duration-200 hover:border-blue-600 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-slate-900">Acceso Personal y Sucursales</h2>
              <p className="mt-1 text-sm text-slate-600">
                Administrador, Coordinador, Encargado de Sucursal y Atención al Cliente.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 group-hover:translate-x-0.5 transition-transform">
              Iniciar sesión <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>

          <Link
            href="/deliveries"
            className="group flex min-h-[48px] cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 transition duration-200 hover:border-orange-600 hover:bg-orange-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                <Bike className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-slate-900">App Móvil Repartidor (PWA)</h2>
              <p className="mt-1 text-sm text-slate-600">
                Mis entregas asignadas, cobros en efectivo, ubicación manual y billetera de garantía.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700 group-hover:translate-x-0.5 transition-transform">
              Abrir vista Rider <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="group flex min-h-[48px] cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 transition duration-200 hover:border-blue-600 hover:bg-blue-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <div>
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-semibold text-slate-900">Panel Operativo & Kanban</h2>
              <p className="mt-1 text-sm text-slate-600">
                Control de pedidos, Regla de Liberación, pagos al restaurante y liquidación 23:00.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 group-hover:translate-x-0.5 transition-transform">
              Ir al panel <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
