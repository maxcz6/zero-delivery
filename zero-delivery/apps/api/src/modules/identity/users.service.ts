import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  AccesoUsuarioSucursalEntity,
  UsuarioEntity,
} from "@zero-delivery/database";
import { ActorContext } from "@zero-delivery/shared-types";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarioRepo: Repository<UsuarioEntity>,
    @InjectRepository(AccesoUsuarioSucursalEntity)
    private readonly accesoRepo: Repository<AccesoUsuarioSucursalEntity>
  ) {}

  async listUsers(actor: ActorContext) {
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
      sucursales: accesos
        .filter((acceso) => acceso.usuario_id === usuario.id)
        .map((acceso) => ({
          id: acceso.sucursal_id,
          nombre: acceso.sucursal?.nombre ?? "",
        })),
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
}
