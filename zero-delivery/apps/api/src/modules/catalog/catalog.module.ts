import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  RestauranteEntity,
  SucursalEntity,
  CategoriaEntity,
  ProductoEntity,
  GrupoModificadoresEntity,
  OpcionModificadorEntity,
} from "@zero-delivery/database";
import { CatalogService } from "./catalog.service";
import { CatalogController } from "./catalog.controller";
import { IdentityModule } from "../identity/identity.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestauranteEntity,
      SucursalEntity,
      CategoriaEntity,
      ProductoEntity,
      GrupoModificadoresEntity,
      OpcionModificadorEntity,
    ]),
    IdentityModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
