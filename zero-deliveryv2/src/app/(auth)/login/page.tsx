"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Bike,
  Store,
  Headphones,
  SlidersHorizontal,
  ArrowRight,
  Lock,
  User,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ES_PE } from "@/shared/i18n/es-PE";

const DEMO_USERS = [
  {
    role: "ADMIN",
    label: ES_PE.roles.ADMIN,
    username: "admin",
    target: "/dashboard",
    icon: SlidersHorizontal,
    color: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  },
  {
    role: "COORDINATOR",
    label: ES_PE.roles.COORDINATOR,
    username: "coord.lima",
    target: "/dashboard?view=kanban",
    icon: ShieldCheck,
    color: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  },
  {
    role: "BRANCH_MANAGER",
    label: ES_PE.roles.BRANCH_MANAGER,
    username: "encargado.miraflores",
    target: "/dashboard?view=branch",
    icon: Store,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  },
  {
    role: "SUPPORT_AGENT",
    label: ES_PE.roles.SUPPORT_AGENT,
    username: "soporte.1",
    target: "/dashboard?view=support",
    icon: Headphones,
    color: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
  },
  {
    role: "RIDER",
    label: ES_PE.roles.RIDER,
    username: "rider.carlos",
    target: "/deliveries",
    icon: Bike,
    color: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("ZeroDelivery2026!");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleQuickSelect = (demoUsername: string) => {
    setUsername(demoUsername);
    setPassword("ZeroDelivery2026!");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: "zero-delivery",
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.error?.message ?? "Error al autenticar. Revise sus credenciales.",
        );
        setLoading(false);
        return;
      }

      // Redirección inteligente de acuerdo al rol devuelto por el servidor
      const targetUrl = data.redirectUrl ?? "/dashboard";
      router.push(targetUrl);
    } catch {
      setErrorMessage("Error de conexión con el servidor. Intente nuevamente.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Cabecera */}
        <div className="mb-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
          >
            ← Volver a Inicio
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
            {ES_PE.app.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acceso unificado por rol y redirección automática
          </p>
        </div>

        {/* Formulario */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Usuario / Identificador
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, rider.carlos, coord.lima..."
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Demo por defecto: <code className="font-mono text-slate-700">ZeroDelivery2026!</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Validando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Accesos rápidos de prueba por Rol */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Probar credenciales por rol (1-clic):
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_USERS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.username}
                    type="button"
                    onClick={() => handleQuickSelect(item.username)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs font-medium transition cursor-pointer ${item.color} ${
                      username === item.username ? "ring-2 ring-blue-600 font-bold" : ""
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <div className="truncate">
                      <p className="font-semibold leading-tight">{item.label}</p>
                      <p className="text-[10px] opacity-80">{item.username}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Resumen de Redirección */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Matriz de Redirección según Credenciales:</p>
          <ul className="mt-1.5 space-y-1 text-slate-600">
            <li>• <strong>Rider:</strong> Redirige a <code className="text-orange-700">/deliveries</code> (App móvil PWA).</li>
            <li>• <strong>Encargado:</strong> Redirige a <code className="text-emerald-700">/dashboard?view=branch</code> (Sucursal).</li>
            <li>• <strong>Coordinador:</strong> Redirige a <code className="text-blue-700">/dashboard?view=kanban</code> (Despacho).</li>
            <li>• <strong>Soporte:</strong> Redirige a <code className="text-amber-800">/dashboard?view=support</code> (Atención).</li>
            <li>• <strong>Admin:</strong> Redirige a <code className="text-purple-700">/dashboard</code> (Panel General).</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
