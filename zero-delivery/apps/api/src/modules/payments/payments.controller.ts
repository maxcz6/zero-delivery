import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext, EstadoPagoDb } from "@zero-delivery/shared-types";

@Controller("payments")
@UseGuards(AuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":paymentId/validate")
  @RequirePermission("payment.validate")
  async validatePayment(
    @CurrentActor() actor: ActorContext,
    @Param("paymentId") paymentId: string,
    @Body() body: { referencia?: string; motivo?: string }
  ) {
    const pago = await this.paymentsService.validatePayment(
      actor,
      paymentId,
      body.referencia,
      body.motivo
    );
    return { ok: true, data: pago };
  }

  @Post("restaurant/:pagoRestauranteId/confirm")
  @RequirePermission("payout.restaurant.confirm")
  async confirmRestaurantPayout(
    @CurrentActor() actor: ActorContext,
    @Param("pagoRestauranteId") pagoRestauranteId: string,
    @Body() body: { metodo?: string; referencia?: string }
  ) {
    const pagoRest = await this.paymentsService.confirmRestaurantPayout(
      actor,
      pagoRestauranteId,
      body.metodo,
      body.referencia
    );
    return { ok: true, data: pagoRest };
  }

  @Post(":paymentId/correct")
  @RequirePermission("payment.correct")
  async correctPayment(
    @CurrentActor() actor: ActorContext,
    @Param("paymentId") paymentId: string,
    @Body()
    body: {
      nuevo_monto_centavos?: string;
      nuevo_estado?: EstadoPagoDb;
      motivo: string;
    }
  ) {
    const pago = await this.paymentsService.correctPayment(
      actor,
      paymentId,
      body
    );
    return { ok: true, data: pago };
  }

  @Get("order/:orderId")
  @RequirePermission("order.view")
  async getPaymentsByOrder(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string
  ) {
    const pagos = await this.paymentsService.getPaymentsByOrder(actor, orderId);
    return { ok: true, data: pagos };
  }

  @Get("restaurant/order/:orderId")
  @RequirePermission("payout.restaurant.confirm")
  async getRestaurantPaymentByOrder(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string
  ) {
    const pagoRestaurante =
      await this.paymentsService.getRestaurantPaymentByOrder(actor, orderId);
    return { ok: true, data: pagoRestaurante };
  }
}
