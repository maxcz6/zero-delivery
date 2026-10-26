import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  RestauranteEntity,
  SucursalEntity,
  CategoriaEntity,
  ProductoEntity,
  GrupoModificadoresEntity,
  OpcionModificadorEntity,
} from "@zero-delivery/database";
import { ActorContext } from "@zero-delivery/shared-types";

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(RestauranteEntity)
    private readonly restauranteRepo: Repository<RestauranteEntity>,
    @InjectRepository(SucursalEntity)
    private readonly sucursalRepo: Repository<SucursalEntity>,
    @InjectRepository(CategoriaEntity)
    private readonly categoriaRepo: Repository<CategoriaEntity>,
    @InjectRepository(ProductoEntity)
    private readonly productoRepo: Repository<ProductoEntity>,
    @InjectRepository(GrupoModificadoresEntity)
    private readonly grupoModificadoresRepo: Repository<GrupoModificadoresEntity>,
    @InjectRepository(OpcionModificadorEntity)
    private readonly opcionModificadorRepo: Repository<OpcionModificadorEntity>
  ) {}

  /**
   * Obtiene todos los restaurantes activos del inquilino.
   */
  async getRestaurants(actor: ActorContext): Promise<RestauranteEntity[]> {
    return this.restauranteRepo.find({
      where: { inquilino_id: actor.tenantId, esta_activo: true },
      order: { nombre: "ASC" },
    });
  }

  /**
   * Crea un nuevo restaurante.
   */
  async createRestaurant(
    actor: ActorContext,
    data: {
      nombre: string;
      razon_social?: string;
      ruc?: string;
    }
  ): Promise<RestauranteEntity> {
    const restaurant = this.restauranteRepo.create({
      inquilino_id: actor.tenantId,
      nombre: data.nombre,
      razon_social: data.razon_social ?? null,
      ruc: data.ruc ?? null,
      esta_activo: true,
    });
    return this.restauranteRepo.save(restaurant);
  }

  /**
   * Obtiene las sucursales del inquilino, filtrando por alcance si el actor es ENCARGADO.
   */
  async getBranches(
    actor: ActorContext,
    restauranteId?: string
  ): Promise<SucursalEntity[]> {
    const query = this.sucursalRepo
      .createQueryBuilder("s")
      .where("s.inquilino_id = :tenantId", { tenantId: actor.tenantId })
      .andWhere("s.esta_activo = true");

    if (restauranteId) {
      query.andWhere("s.restaurante_id = :restauranteId", { restauranteId });
    }

    if (actor.role === "BRANCH_MANAGER" && actor.branchIds.length > 0) {
      query.andWhere("s.id IN (:...branchIds)", { branchIds: actor.branchIds });
    }

    return query.orderBy("s.nombre", "ASC").getMany();
  }

  /**
   * Conmuta la apertura de una sucursal (apertura_manual).
   */
  async toggleBranch(
    actor: ActorContext,
    branchId: string,
    aperturaManual: boolean
  ): Promise<SucursalEntity> {
    if (
      actor.role === "BRANCH_MANAGER" &&
      !actor.branchIds.includes(branchId)
    ) {
      throw new ForbiddenException(
        "No tiene autorización sobre esta sucursal específica"
      );
    }

    const branch = await this.sucursalRepo.findOne({
      where: { id: branchId, inquilino_id: actor.tenantId },
    });

    if (!branch) {
      throw new NotFoundException("Sucursal no encontrada");
    }

    branch.apertura_manual = aperturaManual;
    return this.sucursalRepo.save(branch);
  }

  /**
   * Obtiene las categorías del catálogo para el inquilino.
   */
  async getCategories(
    actor: ActorContext,
    restauranteId?: string
  ): Promise<CategoriaEntity[]> {
    const query = this.categoriaRepo
      .createQueryBuilder("c")
      .where("c.inquilino_id = :tenantId", { tenantId: actor.tenantId });

    if (restauranteId) {
      query.andWhere("c.restaurante_id = :restauranteId", { restauranteId });
    }

    return query.orderBy("c.orden", "ASC").getMany();
  }

  /**
   * Obtiene los productos del catálogo con su categoría.
   */
  async getProducts(
    actor: ActorContext,
    categoriaId?: string,
    incluirInactivos = false
  ): Promise<ProductoEntity[]> {
    const query = this.productoRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.categoria", "cat")
      .where("p.inquilino_id = :tenantId", { tenantId: actor.tenantId });

    if (!incluirInactivos) {
      query.andWhere("p.esta_activo = true");
    }

    if (categoriaId) {
      query.andWhere("p.categoria_id = :categoriaId", { categoriaId });
    }

    return query.orderBy("p.nombre", "ASC").getMany();
  }

  /**
   * Crea un nuevo producto respetando la especificación canónica (precio en céntimos y es_fragil).
   */
  async createProduct(
    actor: ActorContext,
    data: {
      restaurante_id: string;
      categoria_id: string;
      nombre: string;
      descripcion?: string;
      precio_base_centavos: string;
      empaque_centavos?: string;
      es_fragil?: boolean;
    }
  ): Promise<ProductoEntity> {
    const producto = this.productoRepo.create({
      inquilino_id: actor.tenantId,
      restaurante_id: data.restaurante_id,
      categoria_id: data.categoria_id,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      precio_base_centavos: data.precio_base_centavos,
      empaque_centavos: data.empaque_centavos ?? "0",
      es_fragil: data.es_fragil ?? false,
      esta_activo: true,
    });

    return this.productoRepo.save(producto);
  }

  /**
   * Actualiza el estado activo del producto.
   */
  async updateProductStatus(
    actor: ActorContext,
    productId: string,
    estaActivo: boolean
  ): Promise<ProductoEntity> {
    const producto = await this.productoRepo.findOne({
      where: { id: productId, inquilino_id: actor.tenantId },
    });

    if (!producto) {
      throw new NotFoundException("Producto no encontrado");
    }

    producto.esta_activo = estaActivo;
    return this.productoRepo.save(producto);
  }

  /**
   * Actualiza el precio del producto en céntimos enteros (requiere permiso product.price.edit).
   */
  async updateProductPrice(
    actor: ActorContext,
    productId: string,
    nuevoPrecioCentavos: string
  ): Promise<ProductoEntity> {
    const producto = await this.productoRepo.findOne({
      where: { id: productId, inquilino_id: actor.tenantId },
    });

    if (!producto) {
      throw new NotFoundException("Producto no encontrado");
    }

    producto.precio_base_centavos = nuevoPrecioCentavos;
    return this.productoRepo.save(producto);
  }

  /**
   * Archiva un producto (borrado lógico: esta_activo = false, archivado_en = now()) preservando integridad referencial.
   */
  async archiveProduct(actor: ActorContext, productId: string): Promise<void> {
    const producto = await this.productoRepo.findOne({
      where: { id: productId, inquilino_id: actor.tenantId },
    });

    if (!producto) {
      throw new NotFoundException("Producto no encontrado");
    }

    producto.esta_activo = false;
    producto.archivado_en = new Date();
    await this.productoRepo.save(producto);
  }
}
