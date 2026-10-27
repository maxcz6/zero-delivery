import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  AccesoUsuarioSucursalEntity,
  UsuarioEntity,
} from "@zero-delivery/database";
import { ActorContext, RolUsuarioDb } from "@zero-delivery/shared-types";
import { ScryptService } from "./scrypt.service";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
    @InjectRepository(AccesoUsuarioSucursalEntity)
    private readonly accesoRepo: Repository<AccesoUsuarioSucursalEntity>,
    private readonly scryptService: ScryptService
  ) {}

  async listUsers(actor: ActorContext) {
    // Limpiar cualquier vínculo residual de usuarios globales (ADMIN, COORDINADOR, SOPORTE, REPARTIDOR)
    await this.accesoRepo.manager
      .query(
        `DELETE FROM acceso_usuario_sucursal
          WHERE usuario_id IN (
            SELECT id FROM usuarios
             WHERE inquilino_id = $1 AND rol <> 'ENCARGADO_SUCURSAL'
          )`,
        [actor.tenantId]
      )
      .catch(() => null);

    const usuarios = await this.usuarioRepo.find({
      where: { inquilino_id: actor.tenantId },
      order: { creado_en: "ASC" },
    });

    if (usuarios.length === 0) return [];

    const accesos = await this.accesoRepo.find({
      where: { usuario_id: In(usuarios.map((u) => u.id)) },
      relations: ["sucursal"],
    });

    return usuarios.map((usuario) => ({
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      nombre_mostrado: usuario.nombre_mostrado,
      rol: usuario.rol,
      esta_activo: usuario.esta_activo,
      ultimo_acceso_en: usuario.ultimo_acceso_en,
      creado_en: usuario.creado_en,
      // Solo los Encargados de Sucursal (ENCARGADO_SUCURSAL) pertenecen a sucursales específicas.
      // Admin, Coordinador y Soporte NO pertenecen a ninguna sucursal individual.
      sucursales:
        usuario.rol === "ENCARGADO_SUCURSAL"
          ? accesos
              .filter((acceso) => acceso.usuario_id === usuario.id)
              .map((acceso) => ({
                id: acceso.sucursal_id,
                nombre: acceso.sucursal?.nombre ?? "",
              }))
          : [],
    }));
  }

  async setStatus(actor: ActorContext, userId: string, estaActivo: boolean) {
    if (typeof estaActivo !== "boolean") {
      throw new BadRequestException("esta_activo debe ser booleano");
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: userId, inquilino_id: actor.tenantId },
    });
    if (!usuario) {
      throw new NotFoundException("Usuario no encontrado");
    }
    if (usuario.id === actor.userId && !estaActivo) {
      throw new BadRequestException("No puedes desactivar tu propia cuenta");
    }

    usuario.esta_activo = estaActivo;
    const guardado = await this.usuarioRepo.save(usuario);
    return {
      id: guardado.id,
      nombre_usuario: guardado.nombre_usuario,
      esta_activo: guardado.esta_activo,
    };
  }

  /**
   * Asigna las sucursales que administra un usuario con rol ENCARGADO_SUCURSAL (`branch_demo`, `kitchen_demo`, etc.).
   * Si el usuario no es ENCARGADO_SUCURSAL, rechaza la asignación porque Admin, Coordinador y Soporte no pertenecen a ninguna sucursal.
   */
  async setUserBranches(
    actor: ActorContext,
    userId: string,
    branchIds: string[]
  ) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: userId, inquilino_id: actor.tenantId },
    });
    if (!usuario) {
      throw new NotFoundException("Usuario no encontrado");
    }

    if (usuario.rol !== "ENCARGADO_SUCURSAL") {
      throw new BadRequestException(
        "Solo los usuarios con rol Encargado de Sucursal pertenecen a sucursales específicas. Admin, Coordinador y Soporte son globales."
      );
    }

    if (actor.role === "BRANCH_MANAGER") {
      const allInScope = branchIds.every((id) => actor.branchIds.includes(id));
      if (!allInScope) {
        throw new ForbiddenException(
          "Solo puedes asignar personal a tu propia sucursal"
        );
      }
    }

    await this.accesoRepo.delete({ usuario_id: usuario.id });

    const uniqueBranchIds = Array.from(new Set(branchIds.filter(Boolean)));
    for (const branchId of uniqueBranchIds) {
      await this.accesoRepo.save(
        this.accesoRepo.create({
          usuario_id: usuario.id,
          sucursal_id: branchId,
        })
      );
    }

    return {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      branchIds: uniqueBranchIds,
    };
  }

  /**
   * Crea un nuevo usuario en el inquilino (o un nuevo Encargado/Personal para una sucursal).
   */
  async createUser(
    actor: ActorContext,
    input: {
      nombre_usuario: string;
      nombre_mostrado: string;
      password: string;
      rol: RolUsuarioDb;
      sucursal_ids?: string[];
    }
  ) {
    const username = input.nombre_usuario?.trim().toLowerCase();
    const displayName = input.nombre_mostrado?.trim();
    const password = input.password?.trim();

    if (!username || username.length < 3) {
      throw new BadRequestException(
        "El nombre de usuario debe tener al menos 3 caracteres"
      );
    }
    if (!displayName || displayName.length < 2) {
      throw new BadRequestException("El nombre mostrado es obligatorio");
    }
    if (!password || password.length < 6) {
      throw new BadRequestException(
        "La contraseña debe tener al menos 6 caracteres"
      );
    }

    if (actor.role === "BRANCH_MANAGER") {
      if (input.rol !== "ENCARGADO_SUCURSAL") {
        throw new ForbiddenException(
          "El encargado de sucursal solo puede crear cuentas de personal de sucursal (ENCARGADO_SUCURSAL)"
        );
      }
    } else if (actor.role !== "ADMIN") {
      throw new ForbiddenException("Solo el Administrador o Encargado pueden crear usuarios");
    }

    const exists = await this.usuarioRepo.findOne({
      where: { inquilino_id: actor.tenantId, nombre_usuario: username },
    });
    if (exists) {
      throw new BadRequestException(`El usuario @${username} ya existe`);
    }

    const hash = await this.scryptService.hash(password);
    const created = await this.usuarioRepo.save(
      this.usuarioRepo.create({
        inquilino_id: actor.tenantId,
        nombre_usuario: username,
        nombre_mostrado: displayName,
        hash_contrasena: hash,
        rol: input.rol,
        esta_activo: true,
      })
    );

    if (input.rol === "ENCARGADO_SUCURSAL" && Array.isArray(input.sucursal_ids)) {
      const validBranches =
        actor.role === "BRANCH_MANAGER"
          ? input.sucursal_ids.filter((id) => actor.branchIds.includes(id))
          : input.sucursal_ids;
      for (const bId of Array.from(new Set(validBranches))) {
        await this.accesoRepo.save(
          this.accesoRepo.create({
            usuario_id: created.id,
            sucursal_id: bId,
          })
        );
      }
    }

    return {
      id: created.id,
      nombre_usuario: created.nombre_usuario,
      nombre_mostrado: created.nombre_mostrado,
      rol: created.rol,
      esta_activo: created.esta_activo,
    };
  }
}
