import Link from "next/link";
import { MapPin, Wallet, CheckCircle2, LogOut } from "lucide-react";
import { ES_PE } from "@/shared/i18n/es-PE";

export default function RiderDeliveriesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h1 className="text-lg font-bold text-white">App Repartidor (PWA)</h1>
          <p className="text-xs text-slate-400">Carlos Motorizado · Flota Propia (Moto)</p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Salir
        </Link>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-800/80 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Mi Garantía Disponible
          </p>
          <Wallet className="h-4 w-4 text-blue-400" aria-hidden="true" />
        </div>
        <p className="mt-1 font-mono text-2xl font-bold text-white">S/ 150.00</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Habilitado para pedidos en efectivo y prepago
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-5">
        <h2 className="font-semibold text-white">Mis entregas asignadas</h2>
        <p className="mt-1 text-sm text-slate-300">
          {ES_PE.riderLabels.alreadyPaidNoCollection} / {ES_PE.riderLabels.collectCashPrefix}
        </p>
        <button
          type="button"
          className="mt-4 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {ES_PE.riderLabels.shareLocationButton}
        </button>
      </div>
    </div>
  );
}
