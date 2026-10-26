import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { LogisticsService } from "./logistics.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext } from "@zero-delivery/shared-types";

@Controller("logistics")
@UseGuards(AuthGuard, PermissionsGuard)
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Get("riders")
  @RequirePermission("rider.manage")
  async getRiders(@CurrentActor() actor: ActorContext) {
    const riders = await this.logisticsService.getRiders(actor);
    return { ok: true, data: riders };
  }

  @Get("riders/:riderId/wallet")
  @RequirePermission("wallet.view_any")
  async getRiderWallet(
    @CurrentActor() actor: ActorContext,
    @Param("riderId") riderId: string
  ) {
    const wallet = await this.logisticsService.getRiderWalletBalance(
      actor,
      riderId
    );
    return { ok: true, data: wallet };
  }

  @Post("orders/:orderId/assign-rider")
  @RequirePermission("order.assign_rider")
  async assignRider(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string,
    @Body("repartidor_id") riderId: string
  ) {
    const order = await this.logisticsService.assignRiderToOrder(
      actor,
      orderId,
      riderId
    );
    return { ok: true, data: order };
  }

  @Post("orders/:orderId/collect-cash")
  @RequirePermission("delivery.update_own")
  async collectCash(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string
  ) {
    const result = await this.logisticsService.collectCashOnDelivery(
      actor,
      orderId
    );
    return { ok: true, data: result };
  }

  @Post("riders/:riderId/deposit-guarantee")
  @RequirePermission("wallet.adjust")
  async depositGuarantee(
    @CurrentActor() actor: ActorContext,
    @Param("riderId") riderId: string,
    @Body() body: { monto_centavos: string; motivo?: string }
  ) {
    const mov = await this.logisticsService.depositGuarantee(
      actor,
      riderId,
      body.monto_centavos,
      body.motivo
    );
    return { ok: true, data: mov };
  }

  @Post("settlements")
  @RequirePermission("settlement.confirm")
  async confirmSettlement(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      repartidor_id: string;
      fecha_operativa: string;
      efectivo_recibido_centavos: string;
      tarifa_pagable_centavos: string;
      motivo_ajuste?: string;
    }
  ) {
    const liq = await this.logisticsService.confirmSettlement(
      actor,
      body.repartidor_id,
      body.fecha_operativa,
      body.efectivo_recibido_centavos,
      body.tarifa_pagable_centavos,
      body.motivo_ajuste
    );
    return { ok: true, data: liq };
  }
}
