import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  UsuarioEntity,
  InquilinoEntity,
  SesionEntity,
  AccesoUsuarioSucursalEntity,
  RepartidorEntity,
} from "@zero-delivery/database";
import { ScryptService } from "./scrypt.service";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsuarioEntity,
      InquilinoEntity,
      SesionEntity,
      AccesoUsuarioSucursalEntity,
      RepartidorEntity,
    ]),
  ],
  controllers: [AuthController, UsersController],
  providers: [ScryptService, AuthService, UsersService],
  exports: [ScryptService, AuthService],
})
export class IdentityModule {}
