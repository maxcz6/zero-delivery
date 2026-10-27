import { Public } from "../../common/decorators/public.decorator";
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

  @Post("branches")
  @RequirePermission("restaurant.manage")
  async createBranch(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      nombre: string;
      direccion: string;
      telefono?: string;
      latitud?: number | null;
      longitud?: number | null;
      razon_social?: string;
      ruc?: string;
      foto_url?: string;
      encargado_ids?: string[];
    }
  ) {
    const item = await this.catalogService.createBranch(actor, body);
    return { ok: true, data: item };
  }

  @Patch("branches/:branchId")
  @RequirePermission("branch.toggle")
  async updateBranch(
    @CurrentActor() actor: ActorContext,
    @Param("branchId") branchId: string,
    @Body()
    body: {
      nombre?: string;
      direccion?: string;
      telefono?: string | null;
      latitud?: number | null;
      longitud?: number | null;
      apertura_manual?: boolean;
      foto_url?: string | null;
      razon_social?: string | null;
      ruc?: string | null;
      encargado_ids?: string[];
    }
  ) {
    const item = await this.catalogService.updateBranch(actor, branchId, body);
    return { ok: true, data: item };
  }

  @Post("categories")
  @RequirePermission("product.create")
  async createCategory(
    @CurrentActor() actor: ActorContext,
    @Body() body: { restaurante_id: string; nombre: string }
  ) {
    const item = await this.catalogService.createCategory(actor, body);
    return { ok: true, data: item };
  }

  @Patch("categories/:categoryId")
  @RequirePermission("product.create")
  async updateCategory(
    @CurrentActor() actor: ActorContext,
    @Param("categoryId") categoryId: string,
    @Body() body: { nombre?: string; orden?: number }
  ) {
    const item = await this.catalogService.updateCategory(actor, categoryId, body);
    return { ok: true, data: item };
  }

  @Delete("categories/:categoryId")
  @RequirePermission("product.create")
  async deleteCategory(
    @CurrentActor() actor: ActorContext,
    @Param("categoryId") categoryId: string
  ) {
    await this.catalogService.deleteCategory(actor, categoryId);
    return { ok: true, message: "Categoría eliminada" };
  }

  @Public()
  @Get("public/branches")
  async getPublicBranches() {
    const data = await this.catalogService.getPublicBranches();
    return { ok: true, data };
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
    @Query("incluirInactivos") incluirInactivos?: string,
    @Query("restauranteId") restauranteId?: string
  ) {
    const list = await this.catalogService.getProducts(
      actor,
      categoriaId,
      incluirInactivos === "true",
      restauranteId
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
      imagen_url?: string | null;
    }
  ) {
    const item = await this.catalogService.createProduct(actor, body);
    return { ok: true, data: item };
  }

  @Patch("products/:productId")
  @RequirePermission("product.price.edit")
  async updateProduct(
    @CurrentActor() actor: ActorContext,
    @Param("productId") productId: string,
    @Body()
    body: {
      nombre?: string;
      descripcion?: string | null;
      categoria_id?: string;
      precio_base_centavos?: string;
      empaque_centavos?: string;
      es_fragil?: boolean;
      imagen_url?: string | null;
      esta_activo?: boolean;
    }
  ) {
    const item = await this.catalogService.updateProduct(actor, productId, body);
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

  @Public()
  @Get("public/menu/:slug")
  async getPublicMenu(@Param("slug") slug: string) {
    const data = await this.catalogService.getPublicMenuBySlug(slug);
    return { ok: true, data };
  }
}
