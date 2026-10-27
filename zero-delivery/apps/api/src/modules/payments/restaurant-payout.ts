import { EntityManager } from "typeorm";
import { PagoRestauranteEntity, PedidoEntity } from "@zero-delivery/database";

/**
 * Asegura la existencia de la liquidación al restaurante de un pedido.
 *
 * La compuerta de liberación exige el payout confirmado antes del despacho, así que
 * el registro debe nacer al aceptar el pedido; si solo se creara al final del flujo
 * el pedido jamás podría despacharse. Es idempotente vía ON CONFLICT DO NOTHING
 * porque `pagos_restaurante.pedido_id` es UNIQUE.
 */
export async function ensureRestaurantPayout(
  manager: EntityManager,
  pedido: PedidoEntity
): Promise<PagoRestauranteEntity> {
  const repo = manager.getRepository(PagoRestauranteEntity);

  // La tarifa de entrega es ingreso de la plataforma, no del restaurante.
  const mercaderia =
    BigInt(pedido.total_centavos) - BigInt(pedido.tarifa_entrega_centavos);

  await repo
    .createQueryBuilder()
    .insert()
    .into(PagoRestauranteEntity)
    .values({
      inquilino_id: pedido.inquilino_id,
      pedido_id: pedido.id,
      monto_centavos: (mercaderia > 0n ? mercaderia : 0n).toString(),
      estado: "PENDIENTE",
    })
    .orIgnore()
    .execute();

  return (await repo.findOne({ where: { pedido_id: pedido.id } }))!;
}
