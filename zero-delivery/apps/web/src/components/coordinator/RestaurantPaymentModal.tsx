"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Landmark } from "lucide-react";
import { api, ApiError, money } from "@/lib/api";
import type { ApiResponse, PagoRestaurante } from "@/lib/types";
import { ErrorNote, Modal, Spinner } from "@/components/ui";

/** Confirmación del pago de la plataforma al restaurante (liquidación del pedido). */
export function RestaurantPaymentModal({
  pedidoId,
  onClose,
}: {
  pedidoId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [referencia, setReferencia] = useState("");

  const restaurantQuery = useQuery({
    queryKey: ["restaurant-payment", pedidoId],
    queryFn: () =>
      api.get<ApiResponse<PagoRestaurante | null>>(
        `/payments/restaurant/order/${pedidoId}`
      ),
  });

  const confirmMutation = useMutation({
    mutationFn: (pagoRestauranteId: string) =>
      api.post<ApiResponse<PagoRestaurante>>(
        `/payments/restaurant/${pagoRestauranteId}/confirm`,
        { metodo, referencia: referencia.trim() || undefined }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["restaurant-payment", pedidoId] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
  });

  const pago = restaurantQuery.data?.data ?? null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pago) confirmMutation.mutate(pago.id);
  }

  return (
    <Modal title="Pago al restaurante" onClose={onClose}>
      {restaurantQuery.isLoading ? (
        <div className="flex justify-center py-6 text-primary">
          <Spinner />
        </div>
      ) : !pago ? (
        <p className="text-sm text-muted-foreground">
          Este pedido aún no tiene liquidación generada hacia el restaurante. Se crea al
          completar el flujo operativo.
        </p>
      ) : pago.estado === "CONFIRMADO" ? (
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Pago al restaurante confirmado
          </p>
          <p className="text-muted-foreground">
            Monto: {money(pago.monto_centavos)}
            {pago.metodo ? ` · Método: ${pago.metodo}` : ""}
            {pago.referencia ? ` · Ref: ${pago.referencia}` : ""}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Landmark className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Monto a pagar al restaurante</p>
              <p className="text-lg font-bold text-foreground">{money(pago.monto_centavos)}</p>
            </div>
          </div>
          <div>
            <label htmlFor="metodo-pago-restaurante" className="input-label">
              Método de pago
            </label>
            <select
              id="metodo-pago-restaurante"
              className="input cursor-pointer"
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="YAPE">Yape</option>
              <option value="TRANSFERENCIA_BANCARIA">Transferencia bancaria</option>
            </select>
          </div>
          <div>
            <label htmlFor="referencia-pago-restaurante" className="input-label">
              Referencia (opcional)
            </label>
            <input
              id="referencia-pago-restaurante"
              type="text"
              className="input"
              placeholder="Número de operación o nota"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
            />
          </div>
          {confirmMutation.isError ? (
            <ErrorNote
              message={
                confirmMutation.error instanceof ApiError
                  ? confirmMutation.error.message
                  : "No se pudo confirmar el pago"
              }
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Confirmar pago
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
