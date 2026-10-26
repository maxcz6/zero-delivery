import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  PagoEntity,
  EventoPagoEntity,
  PagoRestauranteEntity,
  PedidoEntity,
  EventoSalidaEntity,
} from "@zero-delivery/database";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PagoEntity,
      EventoPagoEntity,
      PagoRestauranteEntity,
      PedidoEntity,
      EventoSalidaEntity,
    ]),
    IdentityModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
