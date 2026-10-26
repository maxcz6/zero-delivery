import { RepartidorEntity } from "@zero-delivery/database";
import { ElegibilidadRiderResult } from "@zero-delivery/shared-types";

export interface RiderEligibilityInput {
  rider: RepartidorEntity;
  saldoCentavos: bigint;
  esPedidoEfectivo: boolean;
  tieneItemsFragiles: boolean;
  minimoGarantiaCentavos?: bigint;
}

/**
 * Función pura de evaluación de elegibilidad de repartidor para asignación.
 * Fuente: docs/LOGICA_DE_NEGOCIO_Y_PERMISOS.md sección 5.
 */
export function evaluateRiderEligibility(
  input: RiderEligibilityInput
): ElegibilidadRiderResult {
  const motivos: string[] = [];
  let bloqueadoPorDeuda = false;

  // 1. Repartidor activo
  if (!input.rider.esta_activo) {
    motivos.push("El repartidor no está activo en el sistema");
  }

  // 2. Estado operativo
  if (input.rider.estado !== "DISPONIBLE" && input.rider.estado !== "OCUPADO") {
    motivos.push(
      `El repartidor no está disponible para despacho (estado: ${input.rider.estado})`
    );
  }

  // 3. Manejo de productos frágiles
  if (input.tieneItemsFragiles && input.rider.tipo_vehiculo !== "AUTO") {
    motivos.push(
      "El pedido contiene artículos frágiles; se requiere transporte tipo AUTO"
    );
  }

  // 4. Saldo y garantía para pedidos en EFECTIVO
  if (input.esPedidoEfectivo) {
    // Si tiene deuda acumulada (saldo negativo)
    if (input.saldoCentavos < BigInt(0)) {
      motivos.push(
        `El repartidor tiene deuda de liquidación pendiente (saldo: ${Number(input.saldoCentavos)})`
      );
      bloqueadoPorDeuda = true;
    }

    const minGarantia = input.minimoGarantiaCentavos ?? BigInt(5000); // S/ 50.00
    // Si no tiene alta confianza y su saldo es menor que la garantía mínima
    if (!input.rider.alta_confianza && input.saldoCentavos < minGarantia) {
      motivos.push(
        `Saldo insuficiente para garantizar cobro en efectivo (requerido: ${Number(minGarantia)}, actual: ${Number(input.saldoCentavos)})`
      );
    }
  }

  return {
    elegible: motivos.length === 0,
    motivos,
    bloqueadoPorDeuda,
    saldoGarantiaCentavos: Number(input.saldoCentavos),
  };
}
