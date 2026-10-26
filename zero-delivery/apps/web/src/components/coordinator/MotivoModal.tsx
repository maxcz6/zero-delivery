"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EstadoOperativoPedidoDb } from "@zero-delivery/shared-types";
import { api, ApiError } from "@/lib/api";
import type { ApiResponse, Pedido } from "@/lib/types";
import { ESTADO_LABEL } from "@/lib/orders";
import { ErrorNote, Modal, Spinner } from "@/components/ui";

/** Motivo obligatorio para transiciones sensibles (rechazos, cancelaciones, fallas). */
export function MotivoModal({
  pedidoId,
  nuevoEstado,
  onClose,
}: {
  pedido?: Pedido;
  pedidoId: string;
  nuevoEstado: EstadoOperativoPedidoDb;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post<ApiResponse<Pedido>>(`/orders/${pedidoId}/transition`, {
        nuevo_estado: nuevoEstado,
        motivo: motivo.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Modal title={`Cambiar a: ${ESTADO_LABEL[nuevoEstado]}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="motivo-transicion" className="input-label">
            Motivo (obligatorio, mínimo 3 caracteres)
          </label>
          <textarea
            id="motivo-transicion"
            className="input min-h-24 resize-y"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            minLength={3}
          />
        </div>
        {mutation.isError ? (
          <ErrorNote
            message={
              mutation.error instanceof ApiError
                ? mutation.error.message
                : "No se pudo aplicar la transición"
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
            disabled={mutation.isPending || motivo.trim().length < 3}
          >
            {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
            Confirmar
          </button>
        </div>
      </form>
    </Modal>
  );
}
