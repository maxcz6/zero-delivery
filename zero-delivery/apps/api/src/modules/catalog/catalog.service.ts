import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  RestauranteEntity,
  SucursalEntity,
  CategoriaEntity,
  ProductoEntity,
  GrupoModificadoresEntity,
  OpcionModificadorEntity,
  ArchivoEntity,
  UsuarioEntity,
  AccesoUsuarioSucursalEntity,
  ConfiguracionEntity,
  InquilinoEntity,
} from "@zero-delivery/database";
import { ActorContext } from "@zero-delivery/shared-types";

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

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
    private readonly opcionModificadorRepo: Repository<OpcionModificadorEntity>,
    @InjectRepository(ArchivoEntity)
    private readonly archivoRepo: Repository<ArchivoEntity>,
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
    @InjectRepository(AccesoUsuarioSucursalEntity)
    private readonly accesoSucursalRepo: Repository<AccesoUsuarioSucursalEntity>,
    @InjectRepository(ConfiguracionEntity)
    private readonly configRepo: Repository<ConfiguracionEntity>,
    @InjectRepository(InquilinoEntity)
    private readonly inquilinoRepo: Repository<InquilinoEntity>
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const tenant = await this.inquilinoRepo.findOne({
        where: {},
        order: { creado_en: "ASC" },
      });
      if (!tenant) return;

      // 1. Limpiar cualquier asignación de sucursal en roles globales (ADMINISTRADOR, COORDINADOR, SOPORTE, REPARTIDOR)
      await this.sucursalRepo.manager.query(
        `DELETE FROM acceso_usuario_sucursal
          WHERE usuario_id IN (
            SELECT id FROM usuarios
             WHERE inquilino_id = $1 AND rol <> 'ENCARGADO_SUCURSAL'
          )`,
        [tenant.id]
      );

      // 2. Corregir nombres de categoría con signos de interrogación heredados ("Hamburguesas Cl??sicas")
      await this.sucursalRepo.manager.query(
        `UPDATE categorias
            SET nombre = 'Hamburguesas Clásicas'
          WHERE inquilino_id = $1 AND nombre LIKE 'Hamburguesas Cl%sicas'`,
        [tenant.id]
      );

      // 3. Garantizar que existan al menos 2 sucursales independientes para que branch_demo y kitchen_demo
      //    administren cada uno su propia sucursal sin mezclar productos.
      let branches = await this.sucursalRepo.find({
        where: { inquilino_id: tenant.id, esta_activo: true },
        order: { creado_en: "ASC" },
      });

      if (branches.length < 2) {
        const rest2 = await this.restauranteRepo.save(
          this.restauranteRepo.create({
            inquilino_id: tenant.id,
            nombre: "Sucursal Miraflores · Pollería & Brasa",
            razon_social: "Miraflores Brasa S.A.C.",
            ruc: "20609876541",
            esta_activo: true,
          })
        );

        const catBrasa = await this.categoriaRepo.save(
          this.categoriaRepo.create({
            inquilino_id: tenant.id,
            restaurante_id: rest2.id,
            nombre: "Pollos a la Brasa y Parrillas",
            orden: 0,
          })
        );

        const catBebidas = await this.categoriaRepo.save(
          this.categoriaRepo.create({
            inquilino_id: tenant.id,
            restaurante_id: rest2.id,
            nombre: "Bebidas y Guarniciones",
            orden: 1,
          })
        );

        await this.productoRepo.save([
          this.productoRepo.create({
            inquilino_id: tenant.id,
            restaurante_id: rest2.id,
            categoria_id: catBrasa.id,
            nombre: "1/2 Pollo a la Brasa con Papas y Ensalada",
            descripcion: "Medio pollo crocante con papas fritas nativas, ensalada fresca y cremas de la casa.",
            precio_base_centavos: "4200",
            empaque_centavos: "200",
            es_fragil: false,
            esta_activo: true,
          }),
          this.productoRepo.create({
            inquilino_id: tenant.id,
            restaurante_id: rest2.id,
            categoria_id: catBrasa.id,
            nombre: "1/4 Pollo a la Brasa Clásico",
            descripcion: "Cuarto de pollo jugoso con porción generosa de papas fritas y ensalada.",
            precio_base_centavos: "2400",
            empaque_centavos: "150",
            es_fragil: false,
            esta_activo: true,
          }),
          this.productoRepo.create({
            inquilino_id: tenant.id,
            restaurante_id: rest2.id,
            categoria_id: catBebidas.id,
            nombre: "Limonada Frozen 1 Litro",
            descripcion: "Jarra de limonada frozen recién preparada.",
            precio_base_centavos: "1400",
            empaque_centavos: "100",
            es_fragil: true,
            esta_activo: true,
          }),
        ]);

        const suc2 = await this.sucursalRepo.save(
          this.sucursalRepo.create({
            inquilino_id: tenant.id,
            restaurante_id: rest2.id,
            nombre: "Sucursal Miraflores",
            slug: "sucursal-miraflores",
            direccion: "Av. José Larco 740, Miraflores",
            telefono: "+51987111222",
            latitud: -12.1219,
            longitud: -77.0297,
            apertura_manual: true,
            esta_activo: true,
          })
        );

        branches = [...branches, suc2];
      }

      // 4. Asegurar asignación independiente de encargados:
      //    branch_demo -> Sucursal 1
      //    kitchen_demo -> Sucursal 2
      const branchDemo = await this.usuarioRepo.findOne({
        where: { inquilino_id: tenant.id, nombre_usuario: "branch_demo" },
      });
      const kitchenDemo = await this.usuarioRepo.findOne({
        where: { inquilino_id: tenant.id, nombre_usuario: "kitchen_demo" },
      });

      if (branchDemo && branches[0]) {
        const existingB1 = await this.accesoSucursalRepo.find({
          where: { usuario_id: branchDemo.id },
        });
        if (existingB1.length === 0) {
          await this.accesoSucursalRepo.save(
            this.accesoSucursalRepo.create({
              usuario_id: branchDemo.id,
              sucursal_id: branches[0].id,
            })
          );
        }
      }

      if (kitchenDemo && branches[1]) {
        const existingK2 = await this.accesoSucursalRepo.find({
          where: { usuario_id: kitchenDemo.id },
        });
        // Si kitchen_demo estaba apuntando a la sucursal 1 por defecto, reasignarlo a la sucursal 2
        const onlyPointsToFirst =
          existingK2.length === 1 && existingK2[0]?.sucursal_id === branches[0]?.id;
        if (existingK2.length === 0 || onlyPointsToFirst) {
          await this.accesoSucursalRepo.delete({ usuario_id: kitchenDemo.id });
          await this.accesoSucursalRepo.save(
            this.accesoSucursalRepo.create({
              usuario_id: kitchenDemo.id,
              sucursal_id: branches[1].id,
            })
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Error inicializando sucursales y encargados: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Verifica que un Encargado de Sucursal (`BRANCH_MANAGER`) tenga acceso a la sucursal o restaurante indicado.
   */
  private async assertBranchOrRestaurantAccess(
    actor: ActorContext,
    params: { branchId?: string; restauranteId?: string }
  ): Promise<SucursalEntity | null> {
    let branch: SucursalEntity | null = null;
    if (params.branchId) {
      branch = await this.sucursalRepo.findOne({
        where: { id: params.branchId, inquilino_id: actor.tenantId },
        relations: ["restaurante"],
      });
      if (!branch) throw new NotFoundException("Sucursal no encontrada");
    } else if (params.restauranteId) {
      branch = await this.sucursalRepo.findOne({
        where: { restaurante_id: params.restauranteId, inquilino_id: actor.tenantId },
        relations: ["restaurante"],
      });
    }

    if (actor.role === "BRANCH_MANAGER") {
      if (!branch || !actor.branchIds.includes(branch.id)) {
        throw new ForbiddenException(
          "Solo puedes administrar los platos, categorías y datos de tu propia sucursal asignada"
        );
      }
    } else if (actor.role !== "ADMIN" && actor.role !== "COORDINATOR") {
      throw new ForbiddenException("No tiene permisos para modificar el catálogo de sucursales");
    }

    return branch;
  }

  private async getBranchPhotosMap(tenantId: string): Promise<Map<string, string>> {
    const rows = await this.configRepo
      .createQueryBuilder("c")
      .where("c.inquilino_id = :tenantId", { tenantId })
      .andWhere("c.clave LIKE 'sucursal.foto.%'")
      .getMany()
      .catch(() => []);

    const map = new Map<string, string>();
    for (const r of rows) {
      const branchId = r.clave.replace("sucursal.foto.", "");
      const val = r.valor;
      if (typeof val === "string" && val.trim()) {
        map.set(branchId, val.trim());
      } else if (val && typeof val === "object" && typeof (val as any).url === "string") {
        map.set(branchId, (val as any).url);
      }
    }
    return map;
  }

  private async setBranchPhoto(
    tenantId: string,
    branchId: string,
    fotoUrl: string | null,
    userId: string
  ): Promise<void> {
    const clave = `sucursal.foto.${branchId}`;
    if (!fotoUrl || !fotoUrl.trim()) {
      await this.configRepo.delete({ inquilino_id: tenantId, clave });
      return;
    }
    await this.sucursalRepo.manager.query(
      `INSERT INTO configuraciones (inquilino_id, clave, valor, es_marcador, actualizado_por, actualizado_en)
       VALUES ($1, $2, $3::jsonb, false, $4, now())
       ON CONFLICT (inquilino_id, clave)
       DO UPDATE SET valor = EXCLUDED.valor, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
      [tenantId, clave, JSON.stringify({ url: fotoUrl.trim() }), userId]
    );
  }

  /**
   * Obtiene todos los restaurantes activos del inquilino (filtrados por sucursal si es ENCARGADO).
   */
  async getRestaurants(actor: ActorContext): Promise<RestauranteEntity[]> {
    if (actor.role === "BRANCH_MANAGER") {
      if (actor.branchIds.length === 0) return [];
      const branches = await this.sucursalRepo.find({
        where: { id: In(actor.branchIds), inquilino_id: actor.tenantId, esta_activo: true },
      });
      const restIds = branches.map((b) => b.restaurante_id);
      if (restIds.length === 0) return [];
      return this.restauranteRepo.find({
        where: { id: In(restIds), inquilino_id: actor.tenantId, esta_activo: true },
        order: { nombre: "ASC" },
      });
    }

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
   * Obtiene las sucursales del inquilino:
   * - ADMIN / COORDINATOR / SUPPORT_AGENT: ven TODAS las sucursales creadas.
   * - BRANCH_MANAGER (`branch_demo`, `kitchen_demo`): ven únicamente las sucursales que administran.
   * Incluye los encargados asignados, datos del restaurante y foto de cada sucursal.
   */
  async getBranches(
    actor: ActorContext,
    restauranteId?: string
  ): Promise<Array<Record<string, unknown>>> {
    const query = this.sucursalRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.restaurante", "r")
      .where("s.inquilino_id = :tenantId", { tenantId: actor.tenantId })
      .andWhere("s.esta_activo = true");

    if (restauranteId) {
      query.andWhere("s.restaurante_id = :restauranteId", { restauranteId });
    }

    if (actor.role === "BRANCH_MANAGER") {
      if (actor.branchIds.length === 0) return [];
      query.andWhere("s.id IN (:...branchIds)", { branchIds: actor.branchIds });
    }

    const branches = await query.orderBy("s.creado_en", "ASC").getMany();
    if (branches.length === 0) return [];

    const photosMap = await this.getBranchPhotosMap(actor.tenantId);

    // Obtener los encargados asignados a cada sucursal
    const accesos = await this.accesoSucursalRepo.find({
      where: { sucursal_id: In(branches.map((b) => b.id)) },
      relations: ["usuario"],
    });

    return branches.map((b) => {
      const encargados = accesos
        .filter(
          (a) =>
            a.sucursal_id === b.id &&
            a.usuario &&
            a.usuario.rol === "ENCARGADO_SUCURSAL" &&
            a.usuario.esta_activo
        )
        .map((a) => ({
          id: a.usuario!.id,
          nombre_usuario: a.usuario!.nombre_usuario,
          nombre_mostrado: a.usuario!.nombre_mostrado,
        }));

      return {
        id: b.id,
        inquilino_id: b.inquilino_id,
        restaurante_id: b.restaurante_id,
        nombre: b.nombre,
        slug: b.slug,
        direccion: b.direccion,
        telefono: b.telefono,
        latitud: b.latitud === null ? null : Number(b.latitud),
        longitud: b.longitud === null ? null : Number(b.longitud),
        apertura_manual: b.apertura_manual,
        esta_activo: b.esta_activo,
        razon_social: b.restaurante?.razon_social ?? null,
        ruc: b.restaurante?.ruc ?? null,
        foto_url: photosMap.get(b.id) ?? null,
        encargados,
        creado_en: b.creado_en,
        actualizado_en: b.actualizado_en,
      };
    });
  }

  /**
   * Crea una sucursal independiente: cada sucursal nace con su propio restaurante lógico
   * (carta, categorías y platos propios), sin depender ni mezclar datos con otra sucursal.
   */
  async createBranch(
    actor: ActorContext,
    data: {
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
    const nombre = data.nombre?.trim();
    const direccion = data.direccion?.trim();
    if (!nombre || nombre.length < 2) {
      throw new BadRequestException("El nombre de la sucursal es obligatorio");
    }
    if (!direccion || direccion.length < 3) {
      throw new BadRequestException("La dirección de la sucursal es obligatoria");
    }
    if (data.ruc && !/^[0-9]{11}$/.test(data.ruc)) {
      throw new BadRequestException("El RUC debe tener 11 dígitos");
    }

    const base =
      nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "sucursal";

    const createdBranch = await this.sucursalRepo.manager.transaction(async (manager) => {
      const sucRepo = manager.getRepository(SucursalEntity);
      let slug = base;
      let n = 1;
      while (await sucRepo.findOne({ where: { inquilino_id: actor.tenantId, slug } })) {
        n += 1;
        slug = `${base}-${n}`;
      }

      const restRepo = manager.getRepository(RestauranteEntity);
      const restaurante = await restRepo.save(
        restRepo.create({
          inquilino_id: actor.tenantId,
          nombre,
          razon_social: data.razon_social?.trim() || null,
          ruc: data.ruc?.trim() || null,
          esta_activo: true,
        })
      );

      const catRepo = manager.getRepository(CategoriaEntity);
      await catRepo.save([
        catRepo.create({
          inquilino_id: actor.tenantId,
          restaurante_id: restaurante.id,
          nombre: "Platos Principales",
          orden: 0,
        }),
        catRepo.create({
          inquilino_id: actor.tenantId,
          restaurante_id: restaurante.id,
          nombre: "Bebidas y Complementos",
          orden: 1,
        }),
      ]);

      const sucursal = await sucRepo.save(
        sucRepo.create({
          inquilino_id: actor.tenantId,
          restaurante_id: restaurante.id,
          nombre,
          slug,
          direccion,
          telefono: data.telefono?.trim() || null,
          latitud: data.latitud ?? null,
          longitud: data.longitud ?? null,
          apertura_manual: true,
          esta_activo: true,
        })
      );

      if (Array.isArray(data.encargado_ids) && data.encargado_ids.length > 0) {
        const accRepo = manager.getRepository(AccesoUsuarioSucursalEntity);
        for (const uid of Array.from(new Set(data.encargado_ids.filter(Boolean)))) {
          await accRepo.save(
            accRepo.create({
              usuario_id: uid,
              sucursal_id: sucursal.id,
            })
          );
        }
      }

      return sucursal;
    });

    if (data.foto_url?.trim()) {
      await this.setBranchPhoto(actor.tenantId, createdBranch.id, data.foto_url.trim(), actor.userId);
    }

    return createdBranch;
  }

  /**
   * Actualiza todos los datos de una sucursal (nombre, dirección, teléfono, ubicación GPS,
   * RUC, razón social, foto y encargados asignados).
   * Permitido tanto para el Administrador como para el Encargado asignado a esa sucursal.
   */
  async updateBranch(
    actor: ActorContext,
    branchId: string,
    data: {
      nombre?: string;
      direccion?: string;
      telefono?: string | null;
      latitud?: number | null;
      longitud?: number | null;
      apertura_manual?: boolean;
      razon_social?: string | null;
      ruc?: string | null;
      foto_url?: string | null;
      encargado_ids?: string[];
    }
  ) {
    const branch = await this.assertBranchOrRestaurantAccess(actor, { branchId });
    if (!branch) throw new NotFoundException("Sucursal no encontrada");

    if (typeof data.nombre === "string" && data.nombre.trim().length >= 2) {
      branch.nombre = data.nombre.trim();
    }
    if (typeof data.direccion === "string" && data.direccion.trim().length >= 3) {
      branch.direccion = data.direccion.trim();
    }
    if (data.telefono !== undefined) {
      branch.telefono = data.telefono?.trim() || null;
    }
    if (data.latitud !== undefined) {
      branch.latitud = data.latitud;
    }
    if (data.longitud !== undefined) {
      branch.longitud = data.longitud;
    }
    if (typeof data.apertura_manual === "boolean") {
      branch.apertura_manual = data.apertura_manual;
    }

    await this.sucursalRepo.save(branch);

    // Sincronizar datos del restaurante lógico propio de la sucursal
    if (branch.restaurante_id) {
      const rest = await this.restauranteRepo.findOne({
        where: { id: branch.restaurante_id, inquilino_id: actor.tenantId },
      });
      if (rest) {
        if (typeof data.nombre === "string" && data.nombre.trim().length >= 2) {
          rest.nombre = data.nombre.trim();
        }
        if (data.razon_social !== undefined) {
          rest.razon_social = data.razon_social?.trim() || null;
        }
        if (data.ruc !== undefined) {
          if (data.ruc && !/^[0-9]{11}$/.test(data.ruc.trim())) {
            throw new BadRequestException("El RUC debe tener 11 dígitos");
          }
          rest.ruc = data.ruc?.trim() || null;
        }
        await this.restauranteRepo.save(rest);
      }
    }

    if (data.foto_url !== undefined) {
      await this.setBranchPhoto(actor.tenantId, branch.id, data.foto_url, actor.userId);
    }

    if (Array.isArray(data.encargado_ids) && actor.role === "ADMIN") {
      await this.accesoSucursalRepo.delete({ sucursal_id: branch.id });
      const validUsers = await this.usuarioRepo.find({
        where: {
          id: In(data.encargado_ids.filter(Boolean)),
          inquilino_id: actor.tenantId,
          rol: "ENCARGADO_SUCURSAL",
        },
      });
      for (const u of validUsers) {
        await this.accesoSucursalRepo.save(
          this.accesoSucursalRepo.create({
            usuario_id: u.id,
            sucursal_id: branch.id,
          })
        );
      }
    }

    const updatedList = await this.getBranches(actor);
    return updatedList.find((b) => b["id"] === branch.id) ?? branch;
  }

  /**
   * Crea una categoría en la carta de una sucursal (restaurante lógico).
   */
  async createCategory(
    actor: ActorContext,
    data: { restaurante_id: string; nombre: string }
  ): Promise<CategoriaEntity> {
    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: data.restaurante_id,
    });

    const nombre = data.nombre?.trim();
    if (!nombre) throw new BadRequestException("El nombre de la categoría es obligatorio");
    const rest = await this.restauranteRepo.findOne({
      where: { id: data.restaurante_id, inquilino_id: actor.tenantId },
    });
    if (!rest) throw new NotFoundException("Sucursal / Restaurante no encontrado");
    const count = await this.categoriaRepo.count({ where: { restaurante_id: rest.id } });
    return this.categoriaRepo.save(
      this.categoriaRepo.create({
        inquilino_id: actor.tenantId,
        restaurante_id: rest.id,
        nombre,
        orden: count,
      })
    );
  }

  /**
   * Renombra o actualiza una categoría de la sucursal.
   */
  async updateCategory(
    actor: ActorContext,
    categoryId: string,
    data: { nombre?: string; orden?: number }
  ): Promise<CategoriaEntity> {
    const cat = await this.categoriaRepo.findOne({
      where: { id: categoryId, inquilino_id: actor.tenantId },
    });
    if (!cat) throw new NotFoundException("Categoría no encontrada");

    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: cat.restaurante_id,
    });

    if (typeof data.nombre === "string" && data.nombre.trim()) {
      cat.nombre = data.nombre.trim();
    }
    if (typeof data.orden === "number") {
      cat.orden = data.orden;
    }
    return this.categoriaRepo.save(cat);
  }

  /**
   * Elimina una categoría de la sucursal (desvinculando productos o validando).
   */
  async deleteCategory(actor: ActorContext, categoryId: string): Promise<void> {
    const cat = await this.categoriaRepo.findOne({
      where: { id: categoryId, inquilino_id: actor.tenantId },
    });
    if (!cat) throw new NotFoundException("Categoría no encontrada");

    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: cat.restaurante_id,
    });

    await this.categoriaRepo.delete({ id: cat.id });
  }

  /**
   * Lista pública de sucursales activas para que el cliente elija dónde pedir.
   */
  async getPublicBranches() {
    const list = await this.sucursalRepo.find({
      where: { esta_activo: true },
      relations: ["restaurante"],
      order: { creado_en: "ASC" },
    });
    const tenantId = list[0]?.inquilino_id;
    const photosMap = tenantId ? await this.getBranchPhotosMap(tenantId) : new Map<string, string>();

    return list.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      slug: s.slug,
      direccion: s.direccion,
      telefono: s.telefono,
      latitud: s.latitud === null ? null : Number(s.latitud),
      longitud: s.longitud === null ? null : Number(s.longitud),
      abierta: s.apertura_manual,
      restaurante: s.restaurante?.nombre ?? s.nombre,
      foto_url: photosMap.get(s.id) ?? null,
    }));
  }

  /**
   * Conmuta la apertura de una sucursal (apertura_manual).
   */
  async toggleBranch(
    actor: ActorContext,
    branchId: string,
    aperturaManual: boolean
  ): Promise<SucursalEntity> {
    await this.assertBranchOrRestaurantAccess(actor, { branchId });

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
   * Obtiene las categorías del catálogo para el inquilino (filtradas por sucursal si es ENCARGADO).
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
    } else if (actor.role === "BRANCH_MANAGER") {
      if (actor.branchIds.length === 0) return [];
      const branches = await this.sucursalRepo.find({
        where: { id: In(actor.branchIds), inquilino_id: actor.tenantId },
      });
      const restIds = branches.map((b) => b.restaurante_id);
      if (restIds.length === 0) return [];
      query.andWhere("c.restaurante_id IN (:...restIds)", { restIds });
    }

    return query.orderBy("c.orden", "ASC").getMany();
  }

  /**
   * Obtiene los productos del catálogo con su categoría e imagen.
   * Si el actor es ENCARGADO (`branch_demo` / `kitchen_demo`), restringe estrictamente a su sucursal.
   */
  async getProducts(
    actor: ActorContext,
    categoriaId?: string,
    incluirInactivos = false,
    restauranteId?: string
  ): Promise<Array<Record<string, unknown>>> {
    const query = this.productoRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.categoria", "cat")
      .leftJoinAndSelect("p.archivo_imagen", "img")
      .where("p.inquilino_id = :tenantId", { tenantId: actor.tenantId })
      .andWhere("p.archivado_en IS NULL");

    if (!incluirInactivos) {
      query.andWhere("p.esta_activo = true");
    }

    if (categoriaId) {
      query.andWhere("p.categoria_id = :categoriaId", { categoriaId });
    }

    if (restauranteId) {
      if (actor.role === "BRANCH_MANAGER") {
        await this.assertBranchOrRestaurantAccess(actor, { restauranteId });
      }
      query.andWhere("p.restaurante_id = :restauranteId", { restauranteId });
    } else if (actor.role === "BRANCH_MANAGER") {
      if (actor.branchIds.length === 0) return [];
      const branches = await this.sucursalRepo.find({
        where: { id: In(actor.branchIds), inquilino_id: actor.tenantId },
      });
      const restIds = branches.map((b) => b.restaurante_id);
      if (restIds.length === 0) return [];
      query.andWhere("p.restaurante_id IN (:...restIds)", { restIds });
    }

    const items = await query.orderBy("p.nombre", "ASC").getMany();
    return items.map((p) => ({
      ...p,
      imagen_url: p.archivo_imagen?.clave_almacenamiento ?? null,
    }));
  }

  private async saveOrUpdateProductImage(
    tenantId: string,
    userId: string,
    existingArchivoId: string | null,
    imagenUrl?: string | null
  ): Promise<string | null> {
    if (imagenUrl === undefined) return existingArchivoId;
    const clean = imagenUrl?.trim() || "";
    if (!clean) return null;

    if (existingArchivoId) {
      const existing = await this.archivoRepo.findOne({
        where: { id: existingArchivoId, inquilino_id: tenantId },
      });
      if (existing) {
        existing.clave_almacenamiento = clean;
        existing.tamano_bytes = String(Buffer.byteLength(clean, "utf8"));
        await this.archivoRepo.save(existing);
        return existing.id;
      }
    }

    const created = await this.archivoRepo.save(
      this.archivoRepo.create({
        inquilino_id: tenantId,
        clave_almacenamiento: clean,
        tipo_mime: clean.startsWith("data:image/png") ? "image/png" : "image/jpeg",
        tamano_bytes: String(Buffer.byteLength(clean, "utf8")),
        subido_por: userId,
      })
    );
    return created.id;
  }

  /**
   * Crea un nuevo producto dentro de la sucursal seleccionada (precio en céntimos, foto y es_fragil).
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
      imagen_url?: string | null;
    }
  ) {
    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: data.restaurante_id,
    });

    const archivoImagenId = await this.saveOrUpdateProductImage(
      actor.tenantId,
      actor.userId,
      null,
      data.imagen_url
    );

    const producto = await this.productoRepo.save(
      this.productoRepo.create({
        inquilino_id: actor.tenantId,
        restaurante_id: data.restaurante_id,
        categoria_id: data.categoria_id,
        nombre: data.nombre.trim(),
        descripcion: data.descripcion?.trim() || null,
        archivo_imagen_id: archivoImagenId,
        precio_base_centavos: data.precio_base_centavos,
        empaque_centavos: data.empaque_centavos ?? "0",
        es_fragil: data.es_fragil ?? false,
        esta_activo: true,
      })
    );

    return {
      ...producto,
      imagen_url: data.imagen_url?.trim() || null,
    };
  }

  /**
   * Actualiza integralmente un plato de la sucursal (nombre, descripción, categoría, precio, empaque, foto, fragilidad).
   */
  async updateProduct(
    actor: ActorContext,
    productId: string,
    data: {
      nombre?: string;
      descripcion?: string | null;
      categoria_id?: string;
      precio_base_centavos?: string;
      empaque_centavos?: string;
      es_fragil?: boolean;
      esta_activo?: boolean;
      imagen_url?: string | null;
    }
  ) {
    const producto = await this.productoRepo.findOne({
      where: { id: productId, inquilino_id: actor.tenantId },
      relations: ["categoria", "archivo_imagen"],
    });
    if (!producto) {
      throw new NotFoundException("Producto no encontrado");
    }

    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: producto.restaurante_id,
    });

    if (typeof data.nombre === "string" && data.nombre.trim().length >= 2) {
      producto.nombre = data.nombre.trim();
    }
    if (data.descripcion !== undefined) {
      producto.descripcion = data.descripcion?.trim() || null;
    }
    if (typeof data.categoria_id === "string" && data.categoria_id) {
      producto.categoria_id = data.categoria_id;
    }
    if (typeof data.precio_base_centavos === "string") {
      producto.precio_base_centavos = data.precio_base_centavos;
    }
    if (typeof data.empaque_centavos === "string") {
      producto.empaque_centavos = data.empaque_centavos;
    }
    if (typeof data.es_fragil === "boolean") {
      producto.es_fragil = data.es_fragil;
    }
    if (typeof data.esta_activo === "boolean") {
      producto.esta_activo = data.esta_activo;
    }
    if (data.imagen_url !== undefined) {
      producto.archivo_imagen_id = await this.saveOrUpdateProductImage(
        actor.tenantId,
        actor.userId,
        producto.archivo_imagen_id,
        data.imagen_url
      );
    }

    const saved = await this.productoRepo.save(producto);
    return {
      ...saved,
      imagen_url:
        data.imagen_url !== undefined
          ? data.imagen_url?.trim() || null
          : producto.archivo_imagen?.clave_almacenamiento ?? null,
    };
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

    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: producto.restaurante_id,
    });

    producto.esta_activo = estaActivo;
    return this.productoRepo.save(producto);
  }

  /**
   * Actualiza el precio del producto en céntimos enteros.
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

    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: producto.restaurante_id,
    });

    producto.precio_base_centavos = nuevoPrecioCentavos;
    return this.productoRepo.save(producto);
  }

  /**
   * Archiva un producto (borrado lógico: esta_activo = false, archivado_en = now()).
   */
  async archiveProduct(actor: ActorContext, productId: string): Promise<void> {
    const producto = await this.productoRepo.findOne({
      where: { id: productId, inquilino_id: actor.tenantId },
    });

    if (!producto) {
      throw new NotFoundException("Producto no encontrado");
    }

    await this.assertBranchOrRestaurantAccess(actor, {
      restauranteId: producto.restaurante_id,
    });

    producto.esta_activo = false;
    producto.archivado_en = new Date();
    await this.productoRepo.save(producto);
  }

  /**
   * Obtiene la carta pública de una sucursal por su slug (sin autenticación requerida).
   */
  async getPublicMenuBySlug(slug: string) {
    const sucursal = await this.sucursalRepo.findOne({
      where: { slug, esta_activo: true },
      relations: ["restaurante"],
    });

    if (!sucursal) {
      throw new NotFoundException(`Sucursal con slug '${slug}' no encontrada`);
    }

    const photosMap = await this.getBranchPhotosMap(sucursal.inquilino_id);

    const categorias = await this.categoriaRepo.find({
      where: { restaurante_id: sucursal.restaurante_id },
      order: { orden: "ASC" },
    });

    const productos = await this.productoRepo.find({
      where: { restaurante_id: sucursal.restaurante_id, esta_activo: true },
      relations: ["archivo_imagen"],
      order: { nombre: "ASC" },
    });

    return {
      sucursal: {
        id: sucursal.id,
        nombre: sucursal.nombre,
        slug: sucursal.slug,
        direccion: sucursal.direccion,
        telefono: sucursal.telefono,
        latitud: sucursal.latitud === null ? null : Number(sucursal.latitud),
        longitud: sucursal.longitud === null ? null : Number(sucursal.longitud),
        apertura_manual: sucursal.apertura_manual,
        foto_url: photosMap.get(sucursal.id) ?? null,
      },
      restaurante: sucursal.restaurante
        ? {
            id: sucursal.restaurante.id,
            nombre: sucursal.restaurante.nombre,
          }
        : null,
      categorias,
      productos: productos.map((p) => ({
        ...p,
        imagen_url: p.archivo_imagen?.clave_almacenamiento ?? null,
      })),
    };
  }
}
