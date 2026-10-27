import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  UsuarioEntity,
  InquilinoEntity,
  SesionEntity,
  AccesoUsuarioSucursalEntity,
  RepartidorEntity,
} from "@zero-delivery/database";
import { ActorContext, dbRoleToRole, RolUsuarioDb } from "@zero-delivery/shared-types";
import { ScryptService } from "./scrypt.service";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
    @InjectRepository(InquilinoEntity)
    private readonly inquilinoRepo: Repository<InquilinoEntity>,
    @InjectRepository(SesionEntity)
    private readonly sesionRepo: Repository<SesionEntity>,
    @InjectRepository(AccesoUsuarioSucursalEntity)
    private readonly accesoSucursalRepo: Repository<AccesoUsuarioSucursalEntity>,
    @InjectRepository(RepartidorEntity)
    private readonly repartidorRepo: Repository<RepartidorEntity>,
    private readonly scryptService: ScryptService
  ) {}

  /**
   * Autenticación con Inquilino, Nombre de usuario y Contraseña (scrypt).
   * Protección contra fuerza bruta con bloqueo tras 5 intentos fallidos por 15 minutos.
   */
  async login(
    tenantSlug: string,
    nombreUsuario: string,
    passwordPlain: string,
    ipOrigen?: string,
    agenteUsuario?: string
  ): Promise<{ rawToken: string; expiraEn: Date; usuario: UsuarioEntity; inquilino: InquilinoEntity }> {
    const inquilino = await this.inquilinoRepo.findOne({
      where: { slug: tenantSlug.trim().toLowerCase(), estado: "ACTIVO" },
    });

    if (!inquilino) {
      throw new UnauthorizedException({
        message: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS",
      });
    }

    const usuario = await this.usuarioRepo
      .createQueryBuilder("u")
      .addSelect("u.hash_contrasena")
      .where("u.inquilino_id = :inquilinoId", { inquilinoId: inquilino.id })
      .andWhere("LOWER(u.nombre_usuario) = LOWER(:nombreUsuario)", {
        nombreUsuario: nombreUsuario.trim(),
      })
      .getOne();

    if (!usuario) {
      throw new UnauthorizedException({
        message: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS",
      });
    }

    if (!usuario.esta_activo) {
      throw new ForbiddenException({
        message:
          "La cuenta de usuario está desactivada. Contacte al administrador.",
        code: "USER_INACTIVE",
      });
    }

    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
      const minutosRestantes = Math.ceil(
        (usuario.bloqueado_hasta.getTime() - Date.now()) / 60000
      );
      throw new HttpException(
        {
          message: `Cuenta temporalmente bloqueada por exceso de intentos fallidos. Intente en ${minutosRestantes} minuto(s)`,
          code: "ACCOUNT_LOCKED",
          bloqueado_hasta: usuario.bloqueado_hasta,
        },
        HttpStatus.LOCKED
      );
    }

    const isValidPassword = await this.scryptService.verify(
      passwordPlain,
      usuario.hash_contrasena
    );

    if (!isValidPassword) {
      const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;
      usuario.intentos_fallidos = nuevosIntentos;

      if (nuevosIntentos >= 5) {
        usuario.bloqueado_hasta = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.usuarioRepo.save(usuario);
      throw new UnauthorizedException({
        message: "Credenciales inválidas",
        code: "INVALID_CREDENTIALS",
      });
    }

    usuario.intentos_fallidos = 0;
    usuario.bloqueado_hasta = null;
    usuario.ultimo_acceso_en = new Date();
    await this.usuarioRepo.save(usuario);

    const rawToken = randomBytes(32).toString("hex");
    const hashToken = createHash("sha256").update(rawToken).digest("hex");
    const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const sesion = this.sesionRepo.create({
      usuario_id: usuario.id,
      hash_token: hashToken,
      expira_en: expiraEn,
      ip: ipOrigen ?? null,
      agente_usuario: agenteUsuario ?? null,
    });

    await this.sesionRepo.save(sesion);

    return {
      rawToken,
      expiraEn,
      usuario,
      inquilino,
    };
  }

  /**
   * Cierre de sesión invalidando el hash en la base de datos (revocado_en).
   */
  async logout(rawToken: string): Promise<void> {
    const hashToken = createHash("sha256").update(rawToken).digest("hex");
    const sesion = await this.sesionRepo.findOne({
      where: { hash_token: hashToken },
    });

    if (sesion && !sesion.revocado_en) {
      sesion.revocado_en = new Date();
      await this.sesionRepo.save(sesion);
    }
  }

  /**
   * Valida el token recibido y construye el ActorContext tipado para la solicitud.
   */
  async validateSession(rawToken: string): Promise<ActorContext> {
    const hashToken = createHash("sha256").update(rawToken).digest("hex");

    const sesion = await this.sesionRepo
      .createQueryBuilder("s")
      .innerJoinAndSelect("s.usuario", "u")
      .innerJoinAndSelect("u.inquilino", "inq")
      .where("s.hash_token = :hashToken", { hashToken })
      .andWhere("s.revocado_en IS NULL")
      .andWhere("s.expira_en > NOW()")
      .getOne();

    if (!sesion || !sesion.usuario || !sesion.usuario.inquilino) {
      throw new UnauthorizedException("Sesión no válida o expirada");
    }

    if (!sesion.usuario.esta_activo || sesion.usuario.inquilino.estado !== "ACTIVO") {
      throw new UnauthorizedException("Usuario o inquilino inactivo");
    }

    const tenantId = sesion.usuario.inquilino_id;

    // Obtener alcance de sucursales exclusivamente para Encargados de Sucursal (ENCARGADO_SUCURSAL).
    // El Administrador, Coordinador y Soporte son roles globales y NO pertenecen a una sucursal específica.
    let branchIds: string[] = [];
    if (sesion.usuario.rol === "ENCARGADO_SUCURSAL") {
      const accesos = await this.accesoSucursalRepo.find({
        where: {
          usuario_id: sesion.usuario_id,
        },
      });
      branchIds = accesos.map((a) => a.sucursal_id);
    }

    let riderId: string | undefined = undefined;
    if (sesion.usuario.rol === "REPARTIDOR") {
      const rider = await this.repartidorRepo.findOne({
        where: {
          inquilino_id: tenantId,
          usuario_id: sesion.usuario_id,
        },
      });
      riderId = rider?.id;
    }

    const domainRole = dbRoleToRole[sesion.usuario.rol as RolUsuarioDb];

    return {
      tenantId,
      userId: sesion.usuario_id,
      role: domainRole,
      branchIds,
      riderId,
      requestId: randomUUID(),
    };
  }
}
