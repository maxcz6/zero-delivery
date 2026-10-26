import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { AuthGuard } from "../../common/guards/auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ActorContext } from "@zero-delivery/shared-types";

@Controller("catalog")
@UseGuards(AuthGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("restaurants")
  async getRestaurants(@CurrentActor() actor: ActorContext) {
    const list = await this.catalogService.getRestaurants(actor);
    return { ok: true, data: list };
  }

  @Post("restaurants")
  @RequirePermission("restaurant.manage")
  async createRestaurant(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      nombre: string;
      razon_social?: string;
      ruc?: string;
    }
  ) {
    const item = await this.catalogService.createRestaurant(actor, body);
    return { ok: true, data: item };
  }

  @Get("branches")
  async getBranches(
    @CurrentActor() actor: ActorContext,
    @Query("restauranteId") restauranteId?: string
  ) {
    const list = await this.catalogService.getBranches(actor, restauranteId);
    return { ok: true, data: list };
  }

  @Patch("branches/:branchId/toggle")
  @RequirePermission("branch.toggle")
  async toggleBranch(
    @CurrentActor() actor: ActorContext,
    @Param("branchId") branchId: string,
    @Body("apertura_manual") aperturaManual: boolean
  ) {
    const branch = await this.catalogService.toggleBranch(
      actor,
      branchId,
      aperturaManual
    );
    return { ok: true, data: branch };
  }

  @Get("categories")
  async getCategories(
    @CurrentActor() actor: ActorContext,
    @Query("restauranteId") restauranteId?: string
  ) {
    const list = await this.catalogService.getCategories(actor, restauranteId);
    return { ok: true, data: list };
  }

  @Get("products")
  async getProducts(
    @CurrentActor() actor: ActorContext,
    @Query("categoriaId") categoriaId?: string,
    @Query("incluirInactivos") incluirInactivos?: string
  ) {
    const list = await this.catalogService.getProducts(
      actor,
      categoriaId,
      incluirInactivos === "true"
    );
    return { ok: true, data: list };
  }

  @Post("products")
  @RequirePermission("product.create")
  async createProduct(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      restaurante_id: string;
      categoria_id: string;
      nombre: string;
      descripcion?: string;
      precio_base_centavos: string;
      empaque_centavos?: string;
      es_fragil?: boolean;
    }
  ) {
    const item = await this.catalogService.createProduct(actor, body);
    return { ok: true, data: item };
  }

  @Patch("products/:productId/status")
  @RequirePermission("product.availability.edit")
  async updateStatus(
    @CurrentActor() actor: ActorContext,
    @Param("productId") productId: string,
    @Body("esta_activo") estaActivo: boolean
  ) {
    const item = await this.catalogService.updateProductStatus(
      actor,
      productId,
      estaActivo
    );
    return { ok: true, data: item };
  }

  @Patch("products/:productId/price")
  @RequirePermission("product.price.edit")
  async updatePrice(
    @CurrentActor() actor: ActorContext,
    @Param("productId") productId: string,
    @Body("precio_base_centavos") nuevoPrecio: string
  ) {
    const item = await this.catalogService.updateProductPrice(
      actor,
      productId,
      nuevoPrecio
    );
    return { ok: true, data: item };
  }

  @Delete("products/:productId")
  @RequirePermission("product.create")
  async archiveProduct(
    @CurrentActor() actor: ActorContext,
    @Param("productId") productId: string
  ) {
    await this.catalogService.archiveProduct(actor, productId);
    return { ok: true, message: "Producto archivado correctamente" };
  }
}
