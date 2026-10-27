import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { Response } from "express";
import { ActorContext } from "@zero-delivery/shared-types";
import { AuthGuard } from "../../common/guards/auth.guard";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ReportingService } from "./reporting.service";

@Controller("reports")
@UseGuards(AuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  private assertReportingAccess(actor: ActorContext): void {
    const allowed = [
      "ADMIN",
      "COORDINATOR",
      "SUPPORT_AGENT",
      "ADMIN_SISTEMA",
      "COORDINADOR",
      "AGENTE_SOPORTE",
    ];
    if (!allowed.includes(actor.role)) {
      throw new ForbiddenException(
        "Solo el Administrador o Coordinador pueden exportar reportes administrativos"
      );
    }
  }

  private sendCsv(res: Response, filename: string, csvContent: string): void {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(csvContent);
  }

  /**
   * Resumen JSON de ventas por sucursal independiente y contadores de Hito 5.
   */
  @Get("summary")
  async getSummary(@CurrentActor() actor: ActorContext) {
    this.assertReportingAccess(actor);
    const data = await this.reportingService.getReportsSummary(actor);
    return { ok: true, data };
  }

  /**
   * 1. Exportación CSV de Ventas Globales y por Sucursal (con UTF-8 BOM para Excel).
   */
  @Get(["sales", "sales.csv"])
  async exportSalesCsv(
    @CurrentActor() actor: ActorContext,
    @Res() res: Response,
    @Query("sucursal_id") sucursalId?: string,
    @Query("desde") desde?: string,
    @Query("hasta") hasta?: string
  ) {
    this.assertReportingAccess(actor);
    const csv = await this.reportingService.generateSalesCsv(actor, {
      sucursal_id: sucursalId,
      desde,
      hasta,
    });
    const dateStamp = new Date().toISOString().slice(0, 10);
    this.sendCsv(res, `reporte_ventas_sucursales_${dateStamp}.csv`, csv);
  }

  /**
   * 2. Exportación CSV de Liquidaciones, Garantías y Comisiones de Repartidores (con UTF-8 BOM).
   */
  @Get(["settlements", "settlements.csv"])
  async exportSettlementsCsv(
    @CurrentActor() actor: ActorContext,
    @Res() res: Response
  ) {
    this.assertReportingAccess(actor);
    const csv = await this.reportingService.generateSettlementsCsv(actor);
    const dateStamp = new Date().toISOString().slice(0, 10);
    this.sendCsv(res, `reporte_liquidaciones_repartidores_${dateStamp}.csv`, csv);
  }

  /**
   * 3. Exportación CSV de Registro de Auditoría Inmutable (con UTF-8 BOM).
   */
  @Get(["audit", "audit.csv"])
  async exportAuditCsv(
    @CurrentActor() actor: ActorContext,
    @Res() res: Response
  ) {
    this.assertReportingAccess(actor);
    const csv = await this.reportingService.generateAuditCsv(actor);
    const dateStamp = new Date().toISOString().slice(0, 10);
    this.sendCsv(res, `reporte_auditoria_inmutable_${dateStamp}.csv`, csv);
  }

  /**
   * 4. Exportación CSV de Historial de Decisiones del Bot Vocero CRM (con UTF-8 BOM).
   */
  @Get(["bot", "bot.csv"])
  async exportBotDecisionsCsv(
    @CurrentActor() actor: ActorContext,
    @Res() res: Response
  ) {
    this.assertReportingAccess(actor);
    const csv = await this.reportingService.generateBotDecisionsCsv(actor);
    const dateStamp = new Date().toISOString().slice(0, 10);
    this.sendCsv(res, `reporte_decisiones_bot_vocero_${dateStamp}.csv`, csv);
  }
}
