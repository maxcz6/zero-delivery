import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  RepartidorEntity,
  PedidoEntity,
  MovimientoBilleteraEntity,
  LiquidacionEntity,
  EventoSalidaEntity,
  DetallePedidoEntity,
  ProductoEntity,
  ConfiguracionEntity,
} from "@zero-delivery/database";
import { LogisticsService } from "./logistics.service";
import { LogisticsController } from "./logistics.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RepartidorEntity,
      PedidoEntity,
      MovimientoBilleteraEntity,
      LiquidacionEntity,
      EventoSalidaEntity,
      DetallePedidoEntity,
      ProductoEntity,
      ConfiguracionEntity,
    ]),
    IdentityModule,
  ],
  controllers: [LogisticsController],
  providers: [LogisticsService],
  exports: [LogisticsService],
})
export class LogisticsModule {}
