import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AlertaEntity,
  ClienteEntity,
  ConfiguracionEntity,
  EventoEntradaEntity,
  EventoSalidaEntity,
  InquilinoEntity,
  PedidoEntity,
  ProductoEntity,
  RegistroAuditoriaEntity,
  RepartidorEntity,
  SucursalEntity,
} from "@zero-delivery/database";
import { IdentityModule } from "../../identity/identity.module";
import { OrdersModule } from "../../orders/orders.module";
import { LogisticsModule } from "../../logistics/logistics.module";
import { VoceroClientService } from "./vocero-client.service";
import { VoceroBotService } from "./vocero-bot.service";
import { OutboxProcessorService } from "./outbox-processor.service";
import { VoceroWebhookController } from "./vocero-webhook.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertaEntity,
      ClienteEntity,
      ConfiguracionEntity,
      EventoEntradaEntity,
      EventoSalidaEntity,
      InquilinoEntity,
      PedidoEntity,
      ProductoEntity,
      RegistroAuditoriaEntity,
      RepartidorEntity,
      SucursalEntity,
    ]),
    IdentityModule,
    OrdersModule,
    LogisticsModule,
  ],
  controllers: [VoceroWebhookController],
  providers: [VoceroClientService, VoceroBotService, OutboxProcessorService],
  exports: [VoceroClientService, VoceroBotService, OutboxProcessorService],
})
export class VoceroIntegrationModule {}
