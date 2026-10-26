"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError, toCents } from "@/lib/api";
import type { ApiResponse, Pago } from "@/lib/types";
import { money } from "@/lib/api";
import { Modal, Spinner, ErrorNote } from "@/components/ui";

const METODO_LABEL: Record<string, string> = {
  YAPE: "Yape",
  TRANSFERENCIA_BANCARIA: "Transferencia bancaria",
  EFECTIVO: "Efectivo",
};

/** Validación humana del comprobante digital: el staff confirma el número de operación. */
export function YapeModal({ pedidoId, onClose }: { pedidoId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [referencia, setReferencia] = useState("");

  const pagosQuery = useQuery({
    queryKey: ["payments", pedidoId],
    queryFn: () => api.get<ApiResponse<Pago[]>>(`/payments/order/${pedidoId}`),
  });

  const pagos = pagosQuery.data?.data ?? [];
  const pending = pagos.find(
    (p) => p.metodo !== "EFECTIVO" && p.estado === "PENDIENTE"
  );

  const validateMutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Pago>>(`/payments/${pending?.id}/validate`, {
        referencia: referencia.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payments", pedidoId] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) validateMutation.mutate();
  }

  return (
    <Modal title="Validación de pago digital" onClose={onClose}>
      {pagosQuery.isLoading ? (
        <div className="flex justify-center py-6 text-primary">
          <Spinner />
        </div>
      ) : pagos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este pedido aún no tiene pagos registrados.
        </p>
      ) : !pending ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            No hay pagos digitales pendientes para este pedido.
          </p>
          <PagoList pagos={pagos} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            <p className="font-semibold text-foreground">
              Monto declarado: {money(pending.monto_centavos)}
            </p>
            <p className="text-xs text-muted-foreground">
              Verifica el comprobante en la app del banco antes de validar.
            </p>
          </div>
          <div>
            <label htmlFor="referencia-yape" className="input-label">
              Número de operación (comprobante del cliente)
            </label>
            <input
              id="referencia-yape"
              type="text"
              inputMode="numeric"
              className="input"
              placeholder="Ej. 1029384756"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              required
              minLength={4}
            />
            <span className="input-helper text-xs text-muted-foreground">
              Debe coincidir con la operación visible en la app del banco.
            </span>
          </div>
          {validateMutation.isError ? (
            <ErrorNote
              message={
                validateMutation.error instanceof ApiError
                  ? validateMutation.error.message
                  : "No se pudo validar el pago"
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
              disabled={validateMutation.isPending || toCents(pending.monto_centavos) <= 0}
            >
              {validateMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
              Validar Pago
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function PagoList({ pagos }: { pagos: Pago[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {pagos.map((p) => (
        <li key={p.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
          <span className="font-medium text-foreground">
            {METODO_LABEL[p.metodo] ?? p.metodo}
          </span>
          <span className="text-muted-foreground">
            {money(p.monto_centavos)} · {p.estado}
            {p.referencia ? ` · Ref. ${p.referencia}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
