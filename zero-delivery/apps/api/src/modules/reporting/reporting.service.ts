import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ActorContext, DecisionBotRegistro, formatPen } from "@zero-delivery/shared-types";

@Injectable()
export class ReportingService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Convierte cabeceras y filas en un archivo CSV compatible con Microsoft Excel en español,
   * anteponiendo el Byte Order Mark UTF-8 (`\uFEFF`, bytes `EF BB BF`) y escapando según RFC 4180.
   */
  toCsvWithBom(
    headers: string[],
    rows: Array<Array<string | number | boolean | null | undefined>>
  ): string {
    const escapeCell = (val: string | number | boolean | null | undefined): string => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCell).join(",");
    const dataLines = rows.map((row) => row.map(escapeCell).join(","));
    return "\uFEFF" + [headerLine, ...dataLines].join("\r\n") + "\r\n";
  }

  /**
   * 1. Reporte Administrativo de Ventas Globales y por Sucursal Independiente (CSV con UTF-8 BOM).
   */
  async generateSalesCsv(
    actor: ActorContext,
    filters?: { sucursal_id?: string; desde?: string; hasta?: string }
  ): Promise<string> {
    const params: unknown[] = [actor.tenantId];
    const whereClauses = ["p.inquilino_id = $1"];

    if (filters?.sucursal_id) {
      params.push(filters.sucursal_id);
      whereClauses.push(`p.sucursal_id = $${params.length}`);
    }
    if (filters?.desde) {
      params.push(filters.desde);
      whereClauses.push(`p.creado_en >= $${params.length}::timestamptz`);
    }
    if (filters?.hasta) {
      params.push(filters.hasta);
      whereClauses.push(`p.creado_en <= $${params.length}::timestamptz`);
    }

    const rows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT p.id, p.numero, p.canal, p.estado_operativo, p.estado_pago, p.metodo_pago,
              p.subtotal_items_centavos, p.descuento_centavos, p.tarifa_entrega_centavos,
              p.impuesto_centavos, p.total_centavos, p.efectivo_por_cobrar_centavos,
              p.creado_en,
              s.nombre AS sucursal_nombre, s.slug AS sucursal_slug,
              c.nombre AS cliente_nombre, c.telefono_e164 AS cliente_telefono,
              r.nombre_completo AS repartidor_nombre, r.tipo_vehiculo AS repartidor_vehiculo
         FROM pedidos p
         JOIN sucursales s ON s.id = p.sucursal_id
         JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN repartidores r ON r.id = p.repartidor_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY p.creado_en DESC
        LIMIT 1000`,
      params
    );

    const headers = [
      "Nro Pedido",
      "Fecha y Hora",
      "Sucursal Independiente",
      "Canal",
      "Cliente",
      "Telefono Cliente",
      "Estado Operativo",
      "Metodo de Pago",
      "Estado de Pago",
      "Repartidor Asignado",
      "Vehiculo",
      "Subtotal Platos (S/)",
      "Descuento (S/)",
      "Tarifa Delivery (S/)",
      "Total Pedido (S/)",
      "Efectivo por Cobrar (S/)",
      "Total Centavos (Entero)",
    ];

    const csvRows = rows.map((r) => [
      `#${r.numero}`,
      new Date(r.creado_en).toISOString(),
      r.sucursal_nombre,
      r.canal,
      r.cliente_nombre,
      r.cliente_telefono,
      r.estado_operativo,
      r.metodo_pago,
      r.estado_pago,
      r.repartidor_nombre ?? "Sin asignar",
      r.repartidor_vehiculo ?? "-",
      formatPen(BigInt(r.subtotal_items_centavos ?? "0")),
      formatPen(BigInt(r.descuento_centavos ?? "0")),
      formatPen(BigInt(r.tarifa_entrega_centavos ?? "0")),
      formatPen(BigInt(r.total_centavos ?? "0")),
      formatPen(BigInt(r.efectivo_por_cobrar_centavos ?? "0")),
      String(r.total_centavos ?? "0"),
    ]);

    return this.toCsvWithBom(headers, csvRows);
  }

  /**
   * 2. Reporte de Liquidaciones, Garantías de Billetera y Comisiones de Repartidores (CSV con UTF-8 BOM).
   */
  async generateSettlementsCsv(actor: ActorContext): Promise<string> {
    const ridersRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT r.id, r.nombre_completo, r.telefono, r.tipo_vehiculo, r.estado, r.alta_confianza,
              COALESCE((SELECT avg(estrellas)::numeric(3,2) FROM calificaciones WHERE tipo_sujeto = 'REPARTIDOR' AND sujeto_id = r.id), 5.0) AS estrellas,
              COALESCE((SELECT sum(monto_centavos) FROM movimientos_billetera WHERE repartidor_id = r.id AND inquilino_id = $1), 0)::text AS saldo_garantia_centavos,
              COALESCE((SELECT count(*) FROM pedidos p WHERE p.repartidor_id = r.id AND p.inquilino_id = $1 AND p.estado_operativo = 'ENTREGADO'), 0)::int AS pedidos_entregados,
              COALESCE((SELECT sum(p.tarifa_entrega_centavos) FROM pedidos p WHERE p.repartidor_id = r.id AND p.inquilino_id = $1 AND p.estado_operativo = 'ENTREGADO'), 0)::text AS comisiones_acumuladas_centavos,
              COALESCE((SELECT sum(p.efectivo_por_cobrar_centavos) FROM pedidos p WHERE p.repartidor_id = r.id AND p.inquilino_id = $1 AND p.metodo_pago = 'EFECTIVO' AND p.estado_operativo IN ('REPARTIDOR_ASIGNADO','REPARTIDOR_EN_RECOJO','EN_CAMINO','ENTREGADO')), 0)::text AS efectivo_recaudado_centavos
         FROM repartidores r
        WHERE r.inquilino_id = $1
        ORDER BY r.nombre_completo ASC`,
      [actor.tenantId]
    );

    const headers = [
      "ID Repartidor",
      "Nombre Completo",
      "Telefono",
      "Vehiculo",
      "Estado Actual",
      "Estrellas Promedio",
      "Saldo Garantia Billetera (S/)",
      "Elegible Contra Entrega (>= S/ 50.00)",
      "Pedidos Entregados",
      "Comisiones Delivery Acumuladas (S/)",
      "Efectivo Recaudado en Ruta (S/)",
      "Saldo Garantia Centavos (Entero)",
    ];

    const csvRows = ridersRows.map((r) => {
      const garantiaCents = BigInt(r.saldo_garantia_centavos ?? "0");
      const comisionesCents = BigInt(r.comisiones_acumuladas_centavos ?? "0");
      const efectivoCents = BigInt(r.efectivo_recaudado_centavos ?? "0");
      const elegible = garantiaCents >= 5000n || Boolean(r.alta_confianza);

      return [
        r.id,
        r.nombre_completo,
        r.telefono,
        r.tipo_vehiculo,
        r.estado,
        Number(r.estrellas ?? 5).toFixed(2),
        formatPen(garantiaCents),
        elegible ? "SI" : "NO",
        r.pedidos_entregados,
        formatPen(comisionesCents),
        formatPen(efectivoCents),
        garantiaCents.toString(),
      ];
    });

    return this.toCsvWithBom(headers, csvRows);
  }

  /**
   * 3. Reporte de Bitácora de Auditoría Inmutable (`registro_auditoria`, CSV con UTF-8 BOM).
   */
  async generateAuditCsv(actor: ActorContext): Promise<string> {
    const auditRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT a.id, a.creado_en, a.rol_actor, a.accion, a.tipo_objeto, a.objeto_id,
              a.razon, a.id_solicitud, a.ip,
              u.nombre_completo AS usuario_nombre, u.correo AS usuario_correo
         FROM registro_auditoria a
         LEFT JOIN usuarios u ON u.id = a.actor_id
        WHERE a.inquilino_id = $1
        ORDER BY a.creado_en DESC
        LIMIT 1000`,
      [actor.tenantId]
    );

    const headers = [
      "ID Evento Auditoria",
      "Fecha y Hora (ISO)",
      "Actor / Usuario",
      "Correo Actor",
      "Rol Actor",
      "Accion Ejecutada",
      "Tipo de Objeto",
      "ID Objeto",
      "Razon / Motivo",
      "ID Solicitud",
    ];

    const csvRows = auditRows.map((a) => [
      a.id,
      new Date(a.creado_en).toISOString(),
      a.usuario_nombre ?? (a.rol_actor === "BOT_VOCERO" ? "Bot Vocero CRM" : "Sistema"),
      a.usuario_correo ?? "-",
      a.rol_actor ?? "SISTEMA",
      a.accion,
      a.tipo_objeto,
      a.objeto_id,
      a.razon ?? "-",
      a.id_solicitud ?? "-",
    ]);

    return this.toCsvWithBom(headers, csvRows);
  }

  /**
   * 4. Reporte de Historial de Decisiones del Bot de Vocero CRM (`eventos_entrada`, CSV con UTF-8 BOM).
   */
  async generateBotDecisionsCsv(_actor: ActorContext): Promise<string> {
    const inboundRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT id, proveedor, id_evento_externo, datos, estado, intentos, error, recibido_en, procesado_en
         FROM eventos_entrada
        WHERE proveedor = 'vocero'
        ORDER BY recibido_en DESC
        LIMIT 1000`
    );

    const headers = [
      "ID Despacho",
      "Fecha Recepcion",
      "Canal",
      "Cliente",
      "Telefono Cliente",
      "Mensaje del Cliente",
      "Tipo de Decision",
      "Resuelto por Bot",
      "Escalado a Coordinador/Admin",
      "Pedido Generado",
      "Repartidor Asignado",
      "Detalle de Decision en Sistema",
      "Tiempo Respuesta (ms)",
    ];

    const csvRows = inboundRows.map((row) => {
      let dec: Partial<DecisionBotRegistro> = {};
      if (row.error) {
        try {
          dec = JSON.parse(row.error);
        } catch {
          dec = { motivo_decision: row.error };
        }
      }
      const ev = (row.datos ?? {}) as Record<string, any>;
      const contact = (ev.contact ?? {}) as Record<string, any>;
      const conv = (ev.conversation ?? {}) as Record<string, any>;
      const messages = Array.isArray(ev.messages) ? ev.messages : [];
      const rawText = messages
        .map((m: any) => m?.text || m?.caption || `[${m?.type ?? "msg"}]`)
        .join(" | ");

      return [
        row.id_evento_externo,
        new Date(row.recibido_en).toISOString(),
        dec.canal ?? conv.channel ?? "whatsapp",
        dec.cliente_nombre ?? contact.displayName ?? "Cliente",
        dec.cliente_telefono ?? contact.identity ?? "",
        dec.mensaje_entrante ?? rawText,
        dec.tipo_decision ?? row.estado,
        dec.resuelto_por_bot ? "SI" : "NO",
        dec.escalado_a_humano ? "SI" : "NO",
        dec.pedido_numero ?? "-",
        dec.repartidor_nombre ?? "-",
        dec.motivo_decision ?? "-",
        dec.duracion_ms ?? 0,
      ];
    });

    return this.toCsvWithBom(headers, csvRows);
  }

  /**
   * 5. Resumen ejecutivo JSON de ventas por sucursal independiente y métricas de Hito 5.
   */
  async getReportsSummary(actor: ActorContext) {
    const branchRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT s.id, s.nombre, s.slug, s.direccion, s.apertura_manual,
              COUNT(p.id)::int AS total_pedidos,
              COUNT(p.id) FILTER (WHERE p.estado_operativo = 'ENTREGADO')::int AS pedidos_entregados,
              COALESCE(SUM(p.total_centavos) FILTER (WHERE p.estado_operativo != 'CANCELADO'), 0)::text AS ventas_centavos
         FROM sucursales s
         LEFT JOIN pedidos p ON p.sucursal_id = s.id AND p.inquilino_id = $1
        WHERE s.inquilino_id = $1 AND s.esta_activo = true
        GROUP BY s.id, s.nombre, s.slug, s.direccion, s.apertura_manual
        ORDER BY s.nombre ASC`,
      [actor.tenantId]
    );

    const auditCountRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM registro_auditoria WHERE inquilino_id = $1`,
      [actor.tenantId]
    );

    const botCountRows: Array<{ total: number }> = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM eventos_entrada WHERE proveedor = 'vocero'`
    );

    return {
      sucursales: branchRows.map((b) => {
        const ventasCents = BigInt(b.ventas_centavos ?? "0");
        return {
          id: b.id,
          nombre: b.nombre,
          slug: b.slug,
          direccion: b.direccion,
          abierta: Boolean(b.apertura_manual),
          total_pedidos: b.total_pedidos,
          pedidos_entregados: b.pedidos_entregados,
          ventas_centavos: ventasCents.toString(),
          ventas_soles: formatPen(ventasCents),
        };
      }),
      totales: {
        registros_auditoria: auditCountRows[0]?.total ?? 0,
        decisiones_bot: botCountRows[0]?.total ?? 0,
      },
    };
  }
}
