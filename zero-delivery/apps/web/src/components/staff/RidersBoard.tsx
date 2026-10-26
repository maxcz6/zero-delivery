"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bike,
  Car,
  Check,
  Phone,
  Search,
  ShieldPlus,
  Wallet,
} from "lucide-react";
import { solesToCents } from "@zero-delivery/shared-types";
import { api, ApiError, money } from "@/lib/api";
import type { ApiResponse, Repartidor, WalletInfo } from "@/lib/types";
import { Badge, EmptyState, ErrorNote, Modal, PageLoader, Spinner } from "@/components/ui";

const ESTADO_REPARTIDOR: Record<Repartidor["estado"], string> = {
  DISPONIBLE: "bg-[#059669] text-white",
  OCUPADO: "bg-[#D97706] text-white",
  EN_CAMINO: "bg-[#2563EB] text-white",
  DESCONECTADO: "bg-muted text-muted-foreground",
};

const ESTADO_LABEL: Record<Repartidor["estado"], string> = {
  DISPONIBLE: "Disponible",
  OCUPADO: "Ocupado",
  EN_CAMINO: "En camino",
  DESCONECTADO: "Desconectado",
};

export function RidersBoard() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [depositFor, setDepositFor] = useState<Repartidor | null>(null);

  const ridersQuery = useQuery({
    queryKey: ["riders"],
    queryFn: () => api.get<ApiResponse<Repartidor[]>>("/logistics/riders"),
    refetchInterval: 30_000,
  });

  const riders = ridersQuery.data?.data ?? [];

  const wallets = useQueries({
    queries: riders.map((rider) => ({
      queryKey: ["wallet", rider.id],
      queryFn: () =>
        api.get<ApiResponse<WalletInfo>>(`/logistics/riders/${rider.id}/wallet`),
      staleTime: 30_000,
    })),
  });

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        r.nombre_completo.toLowerCase().includes(q) ||
        r.telefono.includes(q) ||
        ESTADO_LABEL[r.estado].toLowerCase().includes(q)
    );
  }, [riders, query]);

  if (ridersQuery.isLoading) return <PageLoader label="Cargando repartidores…" />;
  if (ridersQuery.isError) {
    return (
      <ErrorNote
        message={
          ridersQuery.error instanceof ApiError
            ? ridersQuery.error.message
            : "No se pudo conectar con la API"
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label htmlFor="rider-search" className="input-label">
          Buscar repartidor
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="rider-search"
            type="search"
            className="input pl-9"
            placeholder="Nombre, teléfono o estado"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState title="Sin repartidores que coincidan" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((rider) => {
            const index = riders.findIndex((r) => r.id === rider.id);
            const wallet = wallets[index]?.data?.data;
            return (
              <article key={rider.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                    {rider.tipo_vehiculo === "MOTO" ? (
                      <Bike className="h-5 w-5" aria-hidden />
                    ) : (
                      <Car className="h-5 w-5" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-foreground">
                      {rider.nombre_completo}
                    </p>
                    <a
                      href={`tel:${rider.telefono}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {rider.telefono}
                    </a>
                  </div>
                  <Badge className={ESTADO_REPARTIDOR[rider.estado]}>
                    {ESTADO_LABEL[rider.estado]}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className="bg-muted text-muted-foreground">
                    {rider.tipo_vehiculo === "MOTO" ? "Moto" : "Auto"}
                  </Badge>
                  {rider.alta_confianza ? (
                    <Badge className="border border-primary/30 bg-primary/10 text-primary">
                      <Check className="h-3 w-3" aria-hidden />
                      Alta confianza
                    </Badge>
                  ) : null}
                  {!rider.esta_activo ? (
                    <Badge className="border border-destructive/30 bg-destructive/10 text-destructive">
                      Inactivo
                    </Badge>
                  ) : null}
                  {wallet?.tiene_deuda ? (
                    <Badge className="border border-destructive/40 bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      Deuda activa
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Wallet className="h-4 w-4" aria-hidden />
                    Saldo de garantía
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      wallet?.tiene_deuda ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {wallet ? money(wallet.saldo_centavos) : "—"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDepositFor(rider)}
                  className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <ShieldPlus className="h-4 w-4" aria-hidden />
                  Registrar depósito de garantía
                </button>
              </article>
            );
          })}
        </div>
      )}

      {depositFor ? (
        <DepositModal
          rider={depositFor}
          onClose={() => setDepositFor(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["wallet", depositFor.id] });
            void queryClient.invalidateQueries({ queryKey: ["riders"] });
            setDepositFor(null);
          }}
        />
      ) : null}
    </div>
  );
}

function DepositModal({
  rider,
  onClose,
  onSuccess,
}: {
  rider: Repartidor;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { monto_centavos: string; motivo?: string }) =>
      api.post(`/logistics/riders/${rider.id}/deposit-guarantee`, input),
    onSuccess,
  });

  const montoCentavos = (() => {
    const parsed = Number(monto);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return solesToCents(parsed);
  })();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (montoCentavos > 0) {
      mutation.mutate({
        monto_centavos: String(montoCentavos),
        motivo: motivo.trim() || undefined,
      });
    }
  }

  return (
    <Modal title={`Depósito de garantía · ${rider.nombre_completo}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="garantia-monto" className="input-label">
            Monto recibido (S/)
          </label>
          <input
            id="garantia-monto"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            className="input"
            placeholder="50.00"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
          />
          <span className="text-xs text-muted-foreground">
            Se registra como movimiento de libro mayor, sin edición posterior.
          </span>
        </div>
        <div>
          <label htmlFor="garantia-motivo" className="input-label">
            Motivo (opcional)
          </label>
          <input
            id="garantia-motivo"
            type="text"
            className="input"
            placeholder="Ej. Garantía inicial de ingreso"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>
        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo registrar el depósito"
            }
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending || montoCentavos <= 0}
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Registrar depósito
          </button>
        </div>
      </form>
    </Modal>
  );
}
