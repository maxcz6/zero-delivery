import Link from "next/link";
import { ShieldAlert, Wallet, Webhook, FileLock2, LogOut } from "lucide-react";
import { ES_PE } from "@/shared/i18n/es-PE";

export default function StaffDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tablero Operativo y Control de Despacho</h1>
          <p className="text-sm text-slate-600">
            Roles de gestión: {ES_PE.roles.ADMIN}, {ES_PE.roles.COORDINATOR}, {ES_PE.roles.BRANCH_MANAGER} y{" "}
            {ES_PE.roles.SUPPORT_AGENT}.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Cambiar de Usuario / Salir
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Regla de Liberación
            </p>
            <ShieldAlert className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-lg font-bold text-emerald-700">Activa (Doble Barrera)</p>
          <p className="mt-1 text-xs text-slate-600">
            Exige Rider elegible + Pago validado + Pago a local confirmado + Handoff.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Libro Mayor de Garantía
            </p>
            <Wallet className="h-4 w-4 text-blue-700" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-lg font-bold text-slate-900">Append-Only (Céntimos)</p>
          <p className="mt-1 text-xs text-slate-600">Corte diario configurado: 23:00 America/Lima</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Integración Vocero CRM
            </p>
            <Webhook className="h-4 w-4 text-orange-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-lg font-bold text-orange-700">Lista (Feature Flag OFF)</p>
          <p className="mt-1 text-xs text-slate-600">
            Contrato HMAC X-Vocero-Signature + /api/bot/* preparado.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Auditoría Inmutable
            </p>
            <FileLock2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">Protegida por Trigger SQL</p>
          <p className="mt-1 text-xs text-slate-600">UPDATE/DELETE/TRUNCATE bloqueados en BD.</p>
        </div>
      </div>
    </div>
  );
}
