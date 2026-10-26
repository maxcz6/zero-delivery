import { assertIntegerCents, assertNonNegativeCents, type Cents } from "@/shared/money";

export type MarginType = "FIXED" | "PERCENT";

export type PricingItemInput = {
  productId: string;
  name: string;
  qty: number;
  basePriceCents: Cents;
  packagingCents: Cents;
  marginType: MarginType;
  marginValue: number; // Si FIXED => céntimos enteros; si PERCENT => porcentaje (ej. 12.5)
  modifiers: {
    name: string;
    priceDeltaCents: Cents;
  }[];
};

export type PricingContext = {
  discountsCents?: Cents[]; // Extensión futura para promociones (vacío en MVP)
};

export type PricedItemSnapshot = {
  productId: string;
  nameSnapshot: string;
  qty: number;
  basePriceCents: Cents;
  packagingCents: Cents;
  marginCents: Cents;
  modifiersTotalDeltaCents: Cents;
  unitPriceCents: Cents;
  lineTotalCents: Cents;
  isProvisionalMargin: true;
};

export interface PricingPolicy {
  priceItem(item: PricingItemInput, ctx?: PricingContext): PricedItemSnapshot;
}

/**
 * PROVISIONAL — TODO(DECISION-01):
 * La fórmula definitiva del margen comercial aún NO está aprobada (tratamiento de descuentos,
 * envases, impuestos y excepciones por acuerdo de restaurante).
 *
 * Implementación aislada según Sección 7.8 de ZERO_DELIVERY_MVP_BUILD_SPEC.md:
 *   margin = FIXED ? round(marginValue) : round(base * marginValue / 100)
 *   unit_price = base + packaging + margin + sum(modifiers)
 *   line_total = qty * unit_price
 *
 * NO usar este cálculo como reporte financiero definitivo de rentabilidad de agencia hasta aprobar DECISION-01.
 */
export class ProvisionalPricingPolicy implements PricingPolicy {
  public priceItem(item: PricingItemInput, _ctx?: PricingContext): PricedItemSnapshot {
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error(`Cantidad de ítem inválida: ${item.qty}`);
    }
    assertNonNegativeCents(item.basePriceCents, "basePriceCents");
    assertNonNegativeCents(item.packagingCents, "packagingCents");
    if (item.marginValue < 0) {
      throw new Error(`marginValue no puede ser negativo: ${item.marginValue}`);
    }

    // TODO(DECISION-01): Confirmar si el porcentaje aplica solo sobre basePriceCents o incluye modificadores/empaque
    const marginCents: Cents =
      item.marginType === "FIXED"
        ? Math.round(item.marginValue)
        : Math.round((item.basePriceCents * item.marginValue) / 100);

    const modifiersTotalDeltaCents = item.modifiers.reduce((acc, mod) => {
      assertIntegerCents(mod.priceDeltaCents, "priceDeltaCents");
      return acc + mod.priceDeltaCents;
    }, 0);

    const unitPriceCents =
      item.basePriceCents + item.packagingCents + marginCents + modifiersTotalDeltaCents;
    assertNonNegativeCents(unitPriceCents, "unitPriceCents");

    const lineTotalCents = item.qty * unitPriceCents;

    return {
      productId: item.productId,
      nameSnapshot: item.name,
      qty: item.qty,
      basePriceCents: item.basePriceCents,
      packagingCents: item.packagingCents,
      marginCents,
      modifiersTotalDeltaCents,
      unitPriceCents,
      lineTotalCents,
      isProvisionalMargin: true,
    };
  }
}

/**
 * Regla de archivado de productos (Sección 9 y Hito 1):
 * Nunca eliminar físicamente un producto con historial de pedidos; solo archivarlo.
 */
export function decideProductDeletionStrategy(hasOrderHistory: boolean): "DELETE_PHYSICAL" | "ARCHIVE_SOFT" {
  return hasOrderHistory ? "ARCHIVE_SOFT" : "DELETE_PHYSICAL";
}
