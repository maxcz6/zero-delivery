import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  PedidoEntity,
  DetallePedidoEntity,
  ModificadorDetallePedidoEntity,
  HistorialEstadosPedidoEntity,
  EventoSalidaEntity,
  ClienteEntity,
  SucursalEntity,
  ProductoEntity,
  OpcionModificadorEntity,
  ConfiguracionEntity,
} from "@zero-delivery/database";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PedidoEntity,
      DetallePedidoEntity,
      ModificadorDetallePedidoEntity,
      HistorialEstadosPedidoEntity,
      EventoSalidaEntity,
      ClienteEntity,
      SucursalEntity,
      ProductoEntity,
      OpcionModificadorEntity,
      ConfiguracionEntity,
    ]),
    IdentityModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
