"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bike, Car, Check } from "lucide-react";
import { api, ApiError, money } from "@/lib/api";
import type { ApiResponse, Pedido, Repartidor, WalletInfo } from "@/lib/types";
import { Badge, ErrorNote, Modal, Spinner } from "@/components/ui";

const ESTADO_REPARTIDOR: Record<Repartidor["estado"], { label: string; className: string }> = {
  DISPONIBLE: { label: "Disponible", className: "bg-[#059669] text-white" },
  OCUPADO: { label: "Ocupado", className: "bg-[#D97706] text-white" },
  EN_CAMINO: { label: "En camino", className: "bg-[#2563EB] text-white" },
  DESCONECTADO: { label: "Desconectado", className: "bg-muted text-muted-foreground" },
};

/** Asignación de repartidor con estado, vehículo y alertas de elegibilidad (saldo/deuda). */
export function AssignRiderModal({
  pedidoId,
  onClose,
}: {
  pedidoId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const ridersQuery = useQuery({
    queryKey: ["riders"],
    queryFn: () => api.get<ApiResponse<Repartidor[]>>("/logistics/riders"),
  });

  const riders = ridersQuery.data?.data ?? [];

  const walletResults = useQueries({
    queries: riders.map((rider) => ({
      queryKey: ["wallet", rider.id],
      queryFn: () =>
        api.get<ApiResponse<WalletInfo>>(`/logistics/riders/${rider.id}/wallet`),
      staleTime: 30_000,
    })),
  });

  const assignMutation = useMutation({
    mutationFn: (repartidorId: string) =>
      api.post<ApiResponse<Pedido>>(`/logistics/orders/${pedidoId}/assign-rider`, {
        repartidor_id: repartidorId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["riders"] });
      onClose();
    },
  });

  return (
    <Modal title="Asignar repartidor" onClose={onClose} wide>
      {ridersQuery.isLoading ? (
        <div className="flex justify-center py-6 text-primary">
          <Spinner />
        </div>
      ) : riders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay repartidores activos registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {riders.map((rider, index) => {
            const estado = ESTADO_REPARTIDOR[rider.estado];
            const wallet = walletResults[index]?.data?.data;
            const tieneDeuda = wallet?.tiene_deuda ?? false;
            return (
              <li
                key={rider.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  {rider.tipo_vehiculo === "MOTO" ? (
                    <Bike className="h-5 w-5" aria-hidden />
                  ) : (
                    <Car className="h-5 w-5" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {rider.nombre_completo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rider.tipo_vehiculo === "MOTO" ? "Moto" : "Auto"} · {rider.telefono}
                    {wallet ? ` · Saldo ${money(wallet.saldo_centavos)}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {estado ? (
                      <Badge className={estado.className}>{estado.label}</Badge>
                    ) : null}
                    {rider.alta_confianza ? (
                      <Badge className="border border-primary/30 bg-primary/10 text-primary">
                        <Check className="h-3 w-3" aria-hidden />
                        Alta confianza
                      </Badge>
                    ) : null}
                    {tieneDeuda ? (
                      <Badge className="border border-destructive/40 bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Deuda activa — no elegible para efectivo
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary !px-4 !py-2 text-sm"
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate(rider.id)}
                >
                  Asignar
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {assignMutation.isError ? (
        <div className="mt-3">
          <ErrorNote
            message={
              assignMutation.error instanceof ApiError
                ? assignMutation.error.message
                : "No se pudo asignar al repartidor"
            }
          />
        </div>
      ) : null}
    </Modal>
  );
}
