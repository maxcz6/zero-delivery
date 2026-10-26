import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfiguracionEntity } from "@zero-delivery/database";
import { ActorContext } from "@zero-delivery/shared-types";
import { AuditService } from "../audit/audit.service";

export interface ConfiguracionView {
  clave: string;
  valor: unknown;
  es_marcador: boolean;
  actualizado_en: Date;
  actualizado_por: string | null;
}

/**
 * Lectura y actualización de `configuraciones` por inquilino.
 *
 * Las claves se siembran con `sembrar_configuracion_predeterminada(uuid)` del DDL;
 * aquí no se inventan claves nuevas (una clave desconocida → 404) para que la
 * configuración siga siendo un contrato auditable.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ConfiguracionEntity)
    private readonly configuracionRepo: Repository<ConfiguracionEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(actor: ActorContext): Promise<ConfiguracionView[]> {
    const filas = await this.configuracionRepo.find({
      where: { inquilino_id: actor.tenantId },
      order: { clave: "ASC" },
    });

    return filas.map((fila) => this.toView(fila));
  }

  async get(actor: ActorContext, clave: string): Promise<ConfiguracionView> {
    const fila = await this.configuracionRepo.findOne({
      where: { inquilino_id: actor.tenantId, clave },
    });

    if (!fila) {
      throw new NotFoundException(
        `La clave de configuración "${clave}" no existe en este inquilino`
      );
    }

    return this.toView(fila);
  }

  async set(
    actor: ActorContext,
    clave: string,
    valor: unknown,
    contexto: { ip?: string | null; idSolicitud?: string | null } = {}
  ): Promise<ConfiguracionView> {
    const fila = await this.configuracionRepo.findOne({
      where: { inquilino_id: actor.tenantId, clave },
    });

    if (!fila) {
      throw new NotFoundException(
        `La clave de configuración "${clave}" no existe en este inquilino`
      );
    }

    if (JSON.stringify(fila.valor) === JSON.stringify(valor)) {
      return this.toView(fila);
    }

    const antes = { clave, valor: fila.valor, es_marcador: fila.es_marcador };

    fila.valor = valor;
    fila.actualizado_por = actor.userId;
    await this.configuracionRepo.save(fila);

    await this.auditService.record({
      tenantId: actor.tenantId,
      actorId: actor.userId,
      rolActor: actor.role,
      accion: "settings.update",
      tipoObjeto: "configuracion",
      objetoId: fila.id,
      antes,
      despues: { clave, valor: fila.valor, es_marcador: fila.es_marcador },
      ip: contexto.ip ?? null,
      idSolicitud: contexto.idSolicitud ?? null,
    });

    return this.toView(fila);
  }

  private toView(fila: ConfiguracionEntity): ConfiguracionView {
    return {
      clave: fila.clave,
      valor: fila.valor,
      es_marcador: fila.es_marcador,
      actualizado_en: fila.actualizado_en,
      actualizado_por: fila.actualizado_por,
    };
  }
}
