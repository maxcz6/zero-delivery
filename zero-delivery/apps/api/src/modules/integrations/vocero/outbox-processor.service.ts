import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { formatPen } from "@zero-delivery/shared-types";
import { VoceroClientService } from "./vocero-client.service";
import {
  ESTADO_PEDIDO_ETIQUETA_ES,
  VoceroBotService,
} from "./vocero-bot.service";

const MAX_OUTBOX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 4000;

@Injectable()
export class OutboxProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly voceroClient: VoceroClientService,
    private readonly voceroBotService: VoceroBotService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processPendingBatch();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Procesa un lote de eventos pendientes en `eventos_salida` (Transactional Outbox Pattern).
   * Respeta el interruptor de conexión (`funcionalidad.integracion.vocero`).
   */
  async processPendingBatch(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const rows: Array<{
        id: string;
        inquilino_id: string;
        tipo: string;
        datos: Record<string, any>;
        intentos: number;
      }> = await this.dataSource
        .query(
          `SELECT id, inquilino_id, tipo, datos, intentos
FROM eventos_salida
WHERE estado IN ('PENDIENTE', 'FALLIDO')
AND proximo_intento_en <= now()
ORDER BY creado_en ASC
LIMIT 10`,
        )
        .catch(() => []);

      if (rows.length === 0) return 0;

      let processedCount = 0;
      for (const row of rows) {
        const enabled = await this.voceroBotService.isIntegrationEnabled(
          row.inquilino_id,
        );
        // Si la integración está apagada, no despachamos nada hacia Vocero CRM (queda en espera o no-op)
        if (!enabled) continue;

        await this.processSingleEvent(row);
        processedCount++;
      }

      return processedCount;
    } catch (err) {
      this.logger.warn(
        `Error en barrido de Outbox: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processSingleEvent(row: {
    id: string;
    inquilino_id: string;
    tipo: string;
    datos: Record<string, any>;
    intentos: number;
  }): Promise<void> {
    const datos = row.datos ?? {};
    const pedidoId =
      typeof datos.pedido_id === "string" ? datos.pedido_id : null;

    if (!pedidoId) {
      await this.markSent(row.id);
      return;
    }

    const { conversationId, order } =
      await this.voceroBotService.resolveConversationIdForOrder(
        row.inquilino_id,
        pedidoId,
      );

    // Si el pedido no tiene conversación de Vocero vinculada (ej. pedido manual o web sin WhatsApp),
    // se marca como ENVIADO (no-op limpio, regla 7.1 y 8 de 06-VOCERO_CRM.md).
    if (!conversationId || !order) {
      await this.markSent(row.id);
      return;
    }

    const appPublicUrl = (
      process.env["APP_PUBLIC_URL"] || "http://localhost:3001"
    ).replace(/\/+$/, "");
    const trackingUrl = `${appPublicUrl}/p/${order.token_publico}`;
    const totalSoles = formatPen(BigInt(order.total_centavos ?? "0"));
    const numeroStr = `#${order.numero}`;

    // Construir mensaje según plantilla de la sección 8 de 06-VOCERO_CRM.md
    let textToSend: string | null = null;

    switch (row.tipo) {
      case "PEDIDO_CREADO": {
        textToSend = ` Recibimos tu pedido ${numeroStr} por ${totalSoles} en *${order.sucursal_nombre}*. Seguimiento en vivo: ${trackingUrl}`;
        break;
      }
      case "PEDIDO_ESTADO_CAMBIADO": {
        const nuevo = String(datos.estado_nuevo ?? order.estado_operativo);
        if (nuevo === "CONFIRMADO") {
          textToSend = ` Tu pedido ${numeroStr} fue confirmado por *${order.sucursal_nombre}* y pronto entrará a preparación.`;
        } else if (nuevo === "EN_PREPARACION") {
          textToSend = ` Tu pedido ${numeroStr} ya está en preparación en *${order.sucursal_nombre}*.`;
        } else if (nuevo === "LISTO") {
          textToSend = ` Tu pedido ${numeroStr} está listo y empacado. Estamos coordinando la salida con el repartidor.`;
        } else if (nuevo === "EN_CAMINO") {
          textToSend = ` ¡Tu pedido ${numeroStr} está en camino! Síguelo en vivo aquí: ${trackingUrl}`;
        } else if (nuevo === "ENTREGADO") {
          textToSend = ` Pedido ${numeroStr} entregado. ¡Muchas gracias por tu preferencia!`;
        } else if (nuevo === "ENTREGA_FALLIDA") {
          textToSend = ` No pudimos concretar la entrega de tu pedido ${numeroStr}. Nuestro equipo de soporte se está comunicando contigo para coordinar.`;
        } else if (nuevo === "CANCELADO") {
          textToSend = ` Tu pedido ${numeroStr} fue cancelado.${datos.motivo ? ` Motivo: ${datos.motivo}` : ""}`;
        }
        break;
      }
      case "REPARTIDOR_ASIGNADO": {
        const riderName =
          datos.nombre_repartidor ||
          order.repartidor_nombre ||
          "nuestro repartidor";
        textToSend = ` Tu pedido ${numeroStr} va con *${riderName}*. Puedes ver su estado aquí: ${trackingUrl}`;
        break;
      }
      case "PAGO_VALIDADO": {
        textToSend = ` Confirmamos tu pago de ${totalSoles} para el pedido ${numeroStr}. ¡Gracias!`;
        break;
      }
      case "PAGO_RECHAZADO": {
        textToSend = ` No pudimos validar el comprobante de tu pedido ${numeroStr}. Por favor envíanos un nuevo comprobante por este chat.`;
        break;
      }
      default:
        break;
    }

    // 1. Actualizar siempre la ficha del cliente en Vocero CRM (Sección 7 de 06-VOCERO_CRM.md)
    const fichaRes = await this.voceroClient.updateFicha(
      conversationId,
      {
        zeroDeliveryCustomerId: order.cliente_id,
        nombreCliente: order.cliente_nombre,
        segmentoZeroDelivery: order.segmento ?? "NUEVO",
        ultimoPedidoNumero: numeroStr,
        ultimoPedidoEstado:
          ESTADO_PEDIDO_ETIQUETA_ES[order.estado_operativo] ??
          order.estado_operativo,
        ultimoPedidoTotal: totalSoles,
        sucursalPreferida: order.sucursal_nombre,
        repartidorAsignado: order.repartidor_nombre ?? null,
      },
      true,
    );

    // 2. Enviar mensaje de notificación si aplica
    if (textToSend) {
      const msgRes = await this.voceroClient.sendMessage(
        conversationId,
        textToSend,
        true,
      );
      if (!msgRes.ok) {
        if (msgRes.status === 404) {
          await this.markSent(row.id);
          return;
        }
        await this.handleFailure(
          row,
          msgRes.errorReason ?? "Error enviando mensaje a Vocero CRM",
          msgRes.status,
        );
        return;
      }
    } else if (!fichaRes.ok) {
      if (fichaRes.status === 404) {
        await this.markSent(row.id);
        return;
      }
      await this.handleFailure(
        row,
        fichaRes.errorReason ?? "Error actualizando ficha en Vocero CRM",
        fichaRes.status,
      );
      return;
    }

    await this.markSent(row.id);
  }

  private async markSent(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE eventos_salida
SET estado = 'ENVIADO', procesado_en = now(), intentos = intentos + 1, ultimo_error = NULL
WHERE id = $1`,
      [id],
    );
  }

  private async handleFailure(
    row: {
      id: string;
      inquilino_id: string;
      tipo: string;
      datos: Record<string, any>;
      intentos: number;
    },
    errorReason: string,
    httpStatus?: number,
  ): Promise<void> {
    const nextAttempts = (row.intentos ?? 0) + 1;
    // Si es un 4xx de negocio (salvo 429) o se agotaron los intentos -> MUERTO y alerta INTEGRATION_DEAD_LETTER
    const isNonRetryable4xx =
      typeof httpStatus === "number" &&
      httpStatus >= 400 &&
      httpStatus < 500 &&
      httpStatus !== 429;

    if (nextAttempts >= MAX_OUTBOX_ATTEMPTS || isNonRetryable4xx) {
      await this.dataSource.query(
        `UPDATE eventos_salida
SET estado = 'MUERTO', intentos = $1, ultimo_error = $2, procesado_en = now()
WHERE id = $3`,
        [nextAttempts, errorReason, row.id],
      );

      await this.voceroBotService.createBotEscalationAlert({
        tenantId: row.inquilino_id,
        tipo: "INTEGRATION_DEAD_LETTER",
        severidad: "CRITICO",
        pedidoId:
          typeof row.datos?.pedido_id === "string" ? row.datos.pedido_id : null,
        clienteNombre: "Sistema Outbox Vocero",
        clienteTelefono: "",
        mensajeCliente: `Evento ${row.tipo} (${row.id})`,
        motivoEscalado: `Evento saliente a Vocero CRM pasó a cola muerta tras ${nextAttempts} intentos: ${errorReason}`,
        sugerenciaAccion:
          "Verificar que Vocero CRM esté en línea y presionar 'Reintentar' en la pestaña Cola Saliente del Centro de Control del Bot.",
      });
      return;
    }

    // Backoff exponencial: 15s, 30s, 60s, 120s
    const backoffSeconds = Math.min(300, Math.pow(2, nextAttempts) * 10);
    await this.dataSource.query(
      `UPDATE eventos_salida
SET estado = 'FALLIDO',
intentos = $1,
ultimo_error = $2,
proximo_intento_en = now() + ($3 || ' seconds')::interval
WHERE id = $4`,
      [nextAttempts, errorReason, String(backoffSeconds), row.id],
    );
  }
}
