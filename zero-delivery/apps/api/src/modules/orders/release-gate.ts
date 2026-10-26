import {
  EstadoOperativoPedidoDb,
  EstadoPagoDb,
  MetodoPagoDb,
} from "@zero-delivery/shared-types";

export interface ReleaseGateOrderInput {
  estado_operativo: EstadoOperativoPedidoDb;
  repartidor_id: string | null;
  metodo_pago: MetodoPagoDb;
  estado_pago: EstadoPagoDb;
  estado_pago_restaurante: "PENDIENTE" | "CONFIRMADO";
  traspaso_en: Date | null;
}

export interface ReleaseGateSettings {
  requiereConfirmacionPagoRestaurante?: boolean;
}

export interface ReleaseGateResult {
  canRelease: boolean;
  reasons: string[];
}

/**
 * Función pura que evalúa la compuerta de liberación (Release Gate)
 * requerida para despachar un pedido al estado operativo EN_CAMINO.
 *
 * Cuatro condiciones estrictas:
 * 1. Repartidor asignado y apto.
 * 2. Cobro al cliente asegurado (prepagos Yape/Transferencia validados por humano; Efectivo permitido contra entrega).
 * 3. Pago a restaurante confirmado (si la política lo exige).
 * 4. Traspaso físico registrado por el encargado de sucursal.
 */
export function evaluateReleaseGate(
  order: ReleaseGateOrderInput,
  settings: ReleaseGateSettings = {}
): ReleaseGateResult {
  const reasons: string[] = [];

  // Condición 1: Repartidor asignado
  if (!order.repartidor_id) {
    reasons.push("RELEASE_GATE_NO_RIDER: No hay ningún repartidor asignado al pedido");
  }

  // Condición 2: Cobro al cliente
  if (
    order.metodo_pago === "YAPE" ||
    order.metodo_pago === "TRANSFERENCIA_BANCARIA"
  ) {
    if (order.estado_pago !== "PAGADO") {
      reasons.push(
        "RELEASE_GATE_PAYMENT_UNVERIFIED: Los comprobantes de Yape y Transferencia requieren validación humana antes del despacho"
      );
    }
  }

  // Condición 3: Pago a restaurante (configurable)
  const requiereConfirmacionRestaurante =
    settings.requiereConfirmacionPagoRestaurante ?? true;
  if (
    requiereConfirmacionRestaurante &&
    order.estado_pago_restaurante !== "CONFIRMADO"
  ) {
    reasons.push(
      "RELEASE_GATE_RESTAURANT_PAYOUT_PENDING: El pago o liquidación a la sucursal de restaurante no ha sido confirmado"
    );
  }

  // Condición 4: Traspaso físico registrado
  if (!order.traspaso_en) {
    reasons.push(
      "RELEASE_GATE_NO_HANDOFF: No se ha registrado la entrega física de la cocina/sucursal al repartidor (traspaso_en)"
    );
  }

  return {
    canRelease: reasons.length === 0,
    reasons,
  };
}
