import { Public } from "../../common/decorators/public.decorator";
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Query,
  UseGuards,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  crearPedidoManualSchema,
  CrearPedidoManualInput,
  EstadoOperativoPedidoDb,
  ActorContext,
} from "@zero-delivery/shared-types";

@Controller("orders")
@UseGuards(AuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePermission("order.create_manual")
  async createManualOrder(
    @CurrentActor() actor: ActorContext,
    @Body(new ZodValidationPipe(crearPedidoManualSchema))
    body: CrearPedidoManualInput,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const order = await this.ordersService.createManualOrder(
      actor,
      body,
      idempotencyKey
    );
    return { ok: true, data: order };
  }

  @Public()
  @Post("public")
  async createPublicOrder(@Body() body: Parameters<OrdersService["createPublicOrder"]>[0]) {
    const data = await this.ordersService.createPublicOrder(body);
    return { ok: true, data };
  }

  @Get("active")
  @RequirePermission("order.view")
  async getActiveOrders(
    @CurrentActor() actor: ActorContext,
    @Query("sucursalId") sucursalId?: string
  ) {
    const orders = await this.ordersService.getActiveOrders(actor, sucursalId);
    return { ok: true, data: orders };
  }

  @Get(":orderId")
  @RequirePermission("order.view")
  async getOrder(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string
  ) {
    const order = await this.ordersService.getOrderById(actor, orderId);
    return { ok: true, data: order };
  }

  @Post(":orderId/transition")
  @RequirePermission("order.view")
  async transitionOrder(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string,
    @Body()
    body: {
      nuevo_estado: EstadoOperativoPedidoDb;
      motivo?: string;
      version?: number;
    }
  ) {
    const order = await this.ordersService.transitionOrder(
      actor,
      orderId,
      body.nuevo_estado,
      body.motivo,
      body.version
    );
    return { ok: true, data: order };
  }

  @Post(":orderId/handoff")
  @RequirePermission("order.handoff_to_rider")
  async registerHandoff(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string
  ) {
    const order = await this.ordersService.registerHandoff(actor, orderId);
    return { ok: true, data: order };
  }

  @Public()
  @Get("public/track/:token")
  async getPublicOrder(@Param("token") token: string) {
    const data = await this.ordersService.getPublicOrderByToken(token);
    return { ok: true, data };
  }

  @Get("stats/overview")
  @RequirePermission("order.view")
  async getStatsOverview(@CurrentActor() actor: ActorContext) {
    const data = await this.ordersService.getStatsOverview(actor);
    return { ok: true, data };
  }
}
