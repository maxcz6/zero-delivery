import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import { RegistroAuditoriaEntity } from "@zero-delivery/database";
import { ActorContext } from "@zero-delivery/shared-types";

export interface AuditRecordInput {
  tenantId: string;
  actorId?: string | null;
  rolActor?: string | null;
  accion: string;
  tipoObjeto: string;
  objetoId?: string | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
  idSolicitud?: string | null;
}

export interface AuditListFilters {
  accion?: string;
  tipoObjeto?: string;
  objetoId?: string;
  desde?: Date;
  hasta?: Date;
  limite?: number;
  desplazamiento?: number;
}

/**
 * Registro de auditoría append-only (`registro_auditoria`).
 *
 * La tabla tiene un trigger que prohíbe UPDATE y DELETE: este servicio solo
 * inserta. La lectura se filtra siempre por inquilino.
 */
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(RegistroAuditoriaEntity)
    private readonly auditoriaRepo: Repository<RegistroAuditoriaEntity>
  ) {}

  async record(input: AuditRecordInput): Promise<RegistroAuditoriaEntity> {
    const fila = this.auditoriaRepo.create({
      inquilino_id: input.tenantId,
      actor_id: input.actorId ?? null,
      rol_actor: input.rolActor ?? null,
      accion: input.accion,
      tipo_objeto: input.tipoObjeto,
      objeto_id: input.objetoId ?? null,
      antes: input.antes ?? null,
      despues: input.despues ?? null,
      ip: input.ip ?? null,
      id_solicitud: input.idSolicitud ?? null,
    });

    return this.auditoriaRepo.save(fila);
  }

  async list(actor: ActorContext, filtros: AuditListFilters = {}) {
    const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 200);
    const desplazamiento = Math.max(filtros.desplazamiento ?? 0, 0);

    const where: Record<string, unknown> = { inquilino_id: actor.tenantId };

    if (filtros.accion) where["accion"] = filtros.accion;
    if (filtros.tipoObjeto) where["tipo_objeto"] = filtros.tipoObjeto;
    if (filtros.objetoId) where["objeto_id"] = filtros.objetoId;

    if (filtros.desde && filtros.hasta) {
      where["creado_en"] = Between(filtros.desde, filtros.hasta);
    } else if (filtros.desde) {
      where["creado_en"] = MoreThanOrEqual(filtros.desde);
    } else if (filtros.hasta) {
      where["creado_en"] = LessThanOrEqual(filtros.hasta);
    }

    const [filas, total] = await this.auditoriaRepo.findAndCount({
      where,
      order: { creado_en: "DESC" },
      take: limite,
      skip: desplazamiento,
    });

    return {
      data: filas.map((fila) => ({
        id: fila.id,
        actor_id: fila.actor_id,
        rol_actor: fila.rol_actor,
        accion: fila.accion,
        tipo_objeto: fila.tipo_objeto,
        objeto_id: fila.objeto_id,
        antes: fila.antes,
        despues: fila.despues,
        ip: fila.ip,
        id_solicitud: fila.id_solicitud,
        creado_en: fila.creado_en,
      })),
      total,
      limite,
      desplazamiento,
    };
  }
}
