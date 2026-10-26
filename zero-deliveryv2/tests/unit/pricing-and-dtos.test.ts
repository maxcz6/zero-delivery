import { describe, expect, it } from "vitest";
import { ProvisionalPricingPolicy } from "@/modules/catalog";
import {
  toBranchManagerOrderDTO,
  toCustomerOrderDTO,
  type OrderDomainRecord,
} from "@/modules/orders";
import { CsvExporter } from "@/modules/reporting";
import { formatPenCents, solesToCents } from "@/shared/money";
import { normalizePePhoneE164 } from "@/shared/phone";

describe("Política de Precios Provisional, Privacidad de DTOs y Utilidades es-PE (CA-12, CA-14)", () => {
  it("calcula el snapshot de ítem con margen FIXED y PERCENT en céntimos enteros", () => {
    const policy = new ProvisionalPricingPolicy();

    const fixedSnap = policy.priceItem({
      productId: "prod-1",
      name: "Pollo a la Brasa",
      qty: 2,
      basePriceCents: 5000,
      packagingCents: 200,
      marginType: "FIXED",
      marginValue: 500,
      modifiers: [{ name: "Papas extra", priceDeltaCents: 400 }],
    });

    // unit = 5000 + 200 + 500 + 400 = 6100; lineTotal = 2 * 6100 = 12200
    expect(fixedSnap.unitPriceCents).toBe(6100);
    expect(fixedSnap.lineTotalCents).toBe(12200);
    expect(fixedSnap.isProvisionalMargin).toBe(true);

    const percentSnap = policy.priceItem({
      productId: "prod-2",
      name: "Torta de Chocolate",
      qty: 1,
      basePriceCents: 4000,
      packagingCents: 300,
      marginType: "PERCENT",
      marginValue: 15, // 15% de 4000 = 600
      modifiers: [],
    });
    expect(percentSnap.marginCents).toBe(600);
    expect(percentSnap.unitPriceCents).toBe(4900);
  });

  it("garantiza que CustomerOrderDTO y BranchManagerOrderDTO NO filtren costos internos ni coordenadas GPS del repartidor (CA-12)", () => {
    const internalOrder: OrderDomainRecord = {
      id: "ord-100",
      tenantId: "tenant-1",
      number: 1042,
      branchId: "branch-1",
      branchName: "Miraflores",
      customerId: "cust-1",
      customerName: "Juan Pérez",
      customerPhoneE164: "+51987654321",
      addressText: "Calle Los Pinos 123",
      operationalStatus: "ON_THE_WAY",
      paymentStatus: "PAID",
      paymentMethod: "YAPE",
      restaurantPayoutStatus: "CONFIRMED",
      itemsSubtotalCents: 6100,
      discountCents: 0,
      deliveryFeeCents: 800,
      taxCents: 0,
      totalCents: 6900,
      cashToCollectCents: 0,
      handoffAt: "2026-10-26T13:00:00Z",
      releasedAt: "2026-10-26T13:02:00Z",
      riderId: "rider-1",
      riderName: "Carlos",
      riderLastPing: {
        lat: -12.1191,
        lng: -77.0349,
        createdAt: "2026-10-26T13:05:00Z",
      },
      items: [
        {
          id: "item-1",
          nameSnapshot: "Pollo a la Brasa",
          qty: 1,
          basePriceCents: 5000,
          packagingCents: 200,
          marginCents: 500,
          unitPriceCents: 6100,
          lineTotalCents: 6100,
          isFragile: false,
          status: "ACTIVE",
        },
      ],
      createdAt: "2026-10-26T12:40:00Z",
    };

    const publicDto = toCustomerOrderDTO(internalOrder);
    const serializedPublic = JSON.stringify(publicDto);

    expect(serializedPublic).not.toContain("basePriceCents");
    expect(serializedPublic).not.toContain("packagingCents");
    expect(serializedPublic).not.toContain("marginCents");
    expect(serializedPublic).not.toContain("riderLastPing");
    expect(serializedPublic).not.toContain("-12.1191");
    expect(serializedPublic).not.toContain("restaurantPayoutStatus");

    const managerDto = toBranchManagerOrderDTO(internalOrder);
    const serializedManager = JSON.stringify(managerDto);
    // Nota A: En ON_THE_WAY el encargado solo ve que salió del local, nunca el GPS ni el margen
    expect(managerDto.visibleOperationalStatus).toBe("DISPATCHED_IN_TRANSIT");
    expect(serializedManager).not.toContain("marginCents");
    expect(serializedManager).not.toContain("riderLastPing");
  });

  it("normaliza teléfonos peruanos a E.164, formatea moneda en Soles y exporta CSV con BOM UTF-8", () => {
    expect(normalizePePhoneE164("987 654 321")).toBe("+51987654321");
    expect(normalizePePhoneE164("+51 912-345-678")).toBe("+51912345678");
    expect(() => normalizePePhoneE164("123456789")).toThrow();

    expect(solesToCents("150.75")).toBe(15075);
    expect(formatPenCents(15075)).toBe("S/ 150.75");

    const exporter = new CsvExporter();
    const buf = exporter.exportToBuffer({
      columns: [
        { key: "number", header: "Pedido", type: "number" },
        { key: "total", header: "Total (S/)", type: "cents" },
      ],
      rows: [{ number: 1042, total: 6900 }],
      meta: {
        reportName: "ventas",
        generatedAtIso: "2026-10-26T13:00:00Z",
        tenantId: "tenant-1",
      },
    });

    const csvText = buf.toString("utf-8");
    expect(csvText.startsWith("\uFEFFPedido,Total (S/)\r\n1042,69.00\r\n")).toBe(true);
  });
});
